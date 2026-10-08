# What the `users` table needs for better-auth to reuse it

better-auth needs two fields on whatever table it treats as its "user"
model. The reference project reuses its existing `users` table (uuid PK)
instead of a separate better-auth-owned table — do the same unless there's
a reason not to.

Minimum required on `users`:
- `id` — **uuid**, not a serial/bigserial. If this project's `users.id` is
  already a different type, either migrate it to uuid or accept that
  better-auth's own tables (`sessions`/`accounts`/`verifications`, all
  uuid-keyed, see `db/schema/authSchema.ts`) will use a different id shape
  than `users` — simplest to just make `users.id` uuid if it isn't already.
- `email_verified` — boolean, not null, default false. New column if it
  doesn't exist.
- An avatar/photo column to map as better-auth's `image` field — the
  reference project reuses an existing `avatar` text column via
  `user.fields.image: "avatar"` in `auth.ts`. Add one if there isn't a
  photo column yet.
- `name`, `email` — almost certainly already exist on any `users` table.

In `lib/auth.ts`'s `user.fields`, map every one of these to this project's
actual column names (the template assumes `email_verified`/`avatar`/
`created_at`/`updated_at` — change the right-hand side of each mapping to
match reality, don't rename this project's columns to match the template).

If `users` doesn't exist at all yet, create it with (at minimum):
```ts
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  email_verified: boolean("email_verified").notNull().default(false),
  avatar: text("avatar"),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
]);
```
