import { type SQL, sql } from 'drizzle-orm'

// `pg_trgm`'s own built-in default — also what the `%` operator below
// reads from the `pg_trgm.similarity_threshold` database setting. Pin it
// explicitly once per database rather than trusting every Postgres
// instance's default to actually be this:
//
//   ALTER DATABASE <db> SET pg_trgm.similarity_threshold = 0.3;
//
// (session-level `SET`/`set_limit()` isn't reliable here — every query runs
// on whichever connection the pool currently hands out, not a dedicated one
// this app controls end to end.)
export const TRIGRAM_SIMILARITY_THRESHOLD = 0.3

/**
 * Turns free-typed search text into a safe `to_tsquery` operand: every word
 * OR'd together (any one matching is enough — `plainto_tsquery`'s default
 * AND-every-word makes short/partial input match nothing) with the last
 * word treated as a prefix (`:*`) so results start appearing before the
 * user finishes typing it. Tokenized/escaped here in JS rather than handed
 * to Postgres as-is — `to_tsquery` treats `&|!():*` as real operators, so
 * raw user input isn't safe to interpolate directly. Returns `''` if
 * nothing survives sanitization (pure punctuation, etc.) — callers treat
 * that as "no tsvector match possible," not a syntax error.
 */
export function buildSearchTsQuery(search: string): string {
	const tokens = search
		.split(/\s+/)
		.map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
		.filter(Boolean)
	if (tokens.length === 0) return ''
	return tokens
		.map((word, i) => (i === tokens.length - 1 ? `${word}:*` : word))
		.join(' | ')
}

// Wraps a column/expression in the one-time `normalize_farsi_text(...)` SQL
// function (see migration notes) before lowercasing — Dari/Pashto text
// commonly mixes Arabic- and Persian-form codepoints for the same visual
// letter (e.g. Arabic Yeh U+064A vs Farsi Yeh U+06CC) depending on which
// keyboard/OS typed it, plus optional diacritics (tashkeel) and the
// decorative tatweel elongation character — all of which trigram similarity
// and even plain tsvector word-matching treat as genuinely different
// characters unless both the indexed column and the typed query are
// canonicalized through the same normalization first. Every expression
// here (and the matching GIN index expressions in productSchema.ts) must
// call this identically, or matching silently gets worse for Dari/Pashto
// titles without erroring.
function normalized(expr: SQL): SQL {
	return sql`normalize_farsi_text(lower(${expr}))`
}

export interface FuzzySearchTarget {
	/** every tsvector-searched column, already wrapped in `coalesce` by the
	 * caller if nullable — concatenated with a space so a hit in any one
	 * column counts as a match. Must exactly match the expression a GIN
	 * `to_tsvector('simple', normalize_farsi_text(lower(...)))` index was
	 * built on for this to stay index-accelerated instead of a sequential
	 * scan. */
	textColumns: SQL[]
	/** the single column trigram similarity (typo tolerance) runs against —
	 * needs a matching `normalize_farsi_text(lower(col)) gin_trgm_ops` GIN
	 * index (not a plain `col gin_trgm_ops` one) since this always compares
	 * normalized+lowercased. */
	similarityColumn: SQL
}

/**
 * Hybrid match: a real word/prefix hit via tsvector, OR the similarity
 * column being close enough by trigram similarity to survive a misspelling
 * (e.g. "iphon" still finding "iPhone"). `rank` combines both into one score
 * so relevance ordering surfaces the best match of either kind first, not
 * just whichever path happened to match.
 *
 * Uses the `%` operator (not the `similarity()` function call) for the
 * actual filter — `similarity(a, b) > const` is a plain function call the
 * planner can't map to the trigram GIN index, only `a % b` is registered
 * against `gin_trgm_ops`. `similarity()` is still used for `rank`, which is
 * fine there since it only ever runs on the rows the index already
 * narrowed down to.
 */
export function buildFuzzySearch(search: string, target: FuzzySearchTarget) {
	const normalizedColumns = target.textColumns.map(normalized)
	const tsvectorExpr = sql`to_tsvector('simple', ${sql.join(normalizedColumns, sql` || ' ' || `)})`
	const similarityExpr = normalized(target.similarityColumn)
	const searchExpr = normalized(sql`${search}`)
	const tsQuery = buildSearchTsQuery(search)

	const condition = tsQuery
		? sql`(${tsvectorExpr} @@ to_tsquery('simple', ${tsQuery}) OR ${similarityExpr} % ${searchExpr})`
		: sql`${similarityExpr} % ${searchExpr}`
	const rank = tsQuery
		? sql`GREATEST(ts_rank(${tsvectorExpr}, to_tsquery('simple', ${tsQuery})), similarity(${similarityExpr}, ${searchExpr}))`
		: sql`similarity(${similarityExpr}, ${searchExpr})`

	return { condition, rank }
}
