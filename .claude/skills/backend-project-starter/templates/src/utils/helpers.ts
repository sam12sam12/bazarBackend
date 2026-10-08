import type { SQL } from "drizzle-orm";

// Small, generic, framework/schema-agnostic helpers shared across services —
// nothing here is specific to one resource, which is what earns a spot in
// this file instead of living next to the one service that happened to need
// it first.

// A partial update body (every field optional, "send only what changed")
// needs its `undefined` keys stripped before hitting Drizzle's `.set()` —
// `.set({ title: undefined })` would overwrite the column with `NULL`,
// which isn't what "the client didn't send this field" means. `null` is
// kept, not stripped: several update schemas use `null` on purpose to mean
// "clear this field" (e.g. `image: null`), a real value distinct from
// "omitted" — see updateStoreSchema's comment. This is the one place that
// distinction is resolved, instead of a `field !== undefined && { field }`
// spread repeated per field at every call site.
export function definedFields<T extends object>(fields: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(fields) as (keyof T)[]) {
    if (fields[key] !== undefined) result[key] = fields[key];
  }
  return result;
}

// Builds one optional filter condition for a `withCursor(...)` list —
// `undefined`/`null` means "not supplied, skip it", any other value
// (including `false`) builds the condition. One line per filter, each
// independently type-checked (`build`'s argument is inferred from `value`,
// no `as any`), instead of a config-driven map over the filters object or a
// `? build(...) : undefined` ternary repeated per field.
//
// Trusts the caller's `value` already passed through Zod validation (every
// real caller is a field off `c.get('validated')`) — no extra guard against
// e.g. an empty string, since a schema with `.min(1)` already makes that
// impossible by the time it reaches here.
export function when<T>(
  value: T | undefined | null,
  build: (value: T) => SQL,
): SQL | undefined {
  return value != null ? build(value) : undefined;
}
