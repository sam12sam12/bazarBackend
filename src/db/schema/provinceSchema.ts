import { bigserial, jsonb, pgTable, text } from 'drizzle-orm/pg-core'

export type ProvinceName = {
	en: string
	ps: string
	fa: string
}

export const provinces = pgTable('provinces', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	name: jsonb('name').$type<ProvinceName>().notNull(), // { en: "Kandahar", ps: "کندهار", fa: "قندهار" }
	code: text('code').notNull().unique(), // "knd", "kbl", "hrt" – very useful for frontend selects & APIs
})
