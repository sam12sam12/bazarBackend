// Config for the `drizzle-kit` CLI (the tool that creates migrations and
// pushes your schema to the real database). This file is only used by the
// `bun run db:*` commands, not by your running app.

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle", // where generated SQL migration files go
  // Point at the barrel file, not the folder — this drizzle-kit version globs
  // every .ts file in a directory independently, which double-counts tables
  // that are also re-exported through index.ts.
  schema: "./src/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
