---
description: Comprehensive backend project workflow and AI context
---

## Project Overview

- **Name**: `afghan-bazar-backend`
- **Runtime**: Bun (native TypeScript support)
- **Framework**: [Hono](https://hono.dev/)
- **Database**: PostgreSQL (via Drizzle ORM)
- **Validation**: [Zod](https://zod.dev/) & `drizzle-zod`

## Architecture: Controller-Service-DB

We follow a strict layered architecture:
1. **Routes** (`src/routes/`): Define Hono endpoints and mount middlewares.
2. **Controllers** (`src/controllers/`): Extract request payloads, validate using Zod, call services, and return standard JSON.
3. **Services** (`src/services/`): Handle business logic and database queries via Drizzle.
4. **Database** (`src/db/`): Schema definitions (`src/db/schema/`) and validation schemas (`src/db/validation.ts`).

## Database & Schema Highlights

- **Categories**: Hierarchical tree structure using PostgreSQL `ltree`.
- **Products**: Stored images and specifications inside `JSONB` columns to minimize JOINs.
- **Afghan Market Context**: Phone numbers (`07xxxxxxxx` or `+937xxxxxxxx`) are the primary user identifier, and pricing supports `AFN` / `USD`.

## Seeding & Development

- Mock data is maintained in the `seedData/` folder.
- Run database seeding with `bun run seed.ts` (modifying `seed.ts` when adding new seed files).

## Assistant Rules

1. **Validation-First**: Always validate request payloads (POST/PUT/PATCH) using Zod schemas in `src/db/validation.ts`.
2. **Lean Controllers**: Keep controllers thin. Implement all query/mutation logic in the service layer.
3. **JSONB Efficiency**: Use atomic operators or precise updates on JSONB columns where applicable.
