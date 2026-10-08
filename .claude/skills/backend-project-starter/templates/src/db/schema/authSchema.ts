import { foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./userSchema";

// better-auth's "session" model — mapped in auth.ts (`session.modelName:
// "sessions"` + `fields`). Every column here is explicit snake_case to match
// this project's convention (see CLAUDE.md's "Drizzle" section), unlike
// better-auth's own CLI-generated schema, which would default to camelCase
// JS keys for these — that's the one deliberate deviation from the
// reference backend's generated output in this whole file.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    user_id: uuid("user_id").notNull(),
    token: text("token").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    ip_address: text("ip_address"),
    user_agent: text("user_agent"),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
      name: "sessions_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    // FK columns aren't auto-indexed by Postgres.
    index("sessions_user_id_idx").on(table.user_id),

    // Every request's session lookup is by token — this is the hot path.
    uniqueIndex("sessions_token_unique").on(table.token),
  ],
);

// better-auth's "account" model — one row per linked login method (Google,
// future providers, or a local password) for a user. `password` lives here,
// not on `users`, because better-auth treats email/password as just another
// provider row (`provider_id = "credential"`) rather than a column on the
// user itself.
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    user_id: uuid("user_id").notNull(),

    // The id better-auth receives from the provider (Google's `sub` claim
    // for `provider_id = "google"`) — not this table's own `id`.
    account_id: text("account_id").notNull(),
    provider_id: text("provider_id").notNull(),

    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    id_token: text("id_token"),
    access_token_expires_at: timestamp("access_token_expires_at", { withTimezone: true, precision: 3 }),
    refresh_token_expires_at: timestamp("refresh_token_expires_at", { withTimezone: true, precision: 3 }),
    scope: text("scope"),
    password: text("password"),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
      name: "accounts_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    index("accounts_user_id_idx").on(table.user_id),

    // The same provider account (e.g. the same Google `sub`) can't link to
    // two different users.
    uniqueIndex("accounts_provider_id_account_id_unique").on(table.provider_id, table.account_id),
  ],
);

// better-auth's "verification" model — short-lived tokens for email
// verification / password reset / the OAuth state round-trip. Not FK'd to
// `users`: `identifier` is a free-form string (an email, a user id, ...)
// chosen by whichever better-auth flow writes the row.
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),

    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);
