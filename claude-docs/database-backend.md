# Database & Backend Infrastructure

## Purpose

This module manages data persistence and backend processing for JobbedIn. It provides type-safe database access via Drizzle ORM, PostgreSQL schema definitions, and async job processing for AI workflows. Currently, the database is configured and ready but not yet wired to the frontend state management.

## Location

- `app/lib/db/index.ts` — Drizzle ORM client initialization
- `app/lib/db/schema.ts` — PostgreSQL table definitions, enums, and relationships
- `app/api/` — Next.js API routes (emerging layer for backend endpoints)
- `drizzle.config.ts` — Drizzle Kit migration configuration
- `.env.example` — PostgreSQL connection credentials template

## Entry Points

- `app/lib/db/index.ts` — Import `db` and `client` to query database from API routes or server functions
- `app/lib/db/schema.ts` — Import table definitions and enums when defining queries or migrations
- `drizzle.config.ts` — Configuration for `pnpm db:generate`, `pnpm db:push`, `pnpm db:migrate`

## Architecture / Key Components

### Database Connection
**File:** `app/lib/db/index.ts`

```typescript
const dbUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;
export const client = postgres(dbUrl, { prepare: false });
export const db = drizzle(client);
```

- Postgres client initialized with connection string from environment variables
- Drizzle ORM wraps the client for type-safe queries
- Currently commented-out: `import * as schema from './schema'` (will be uncommented when queries are written)
- Throws if any PG_* environment variable is missing

### Schema Overview
**File:** `app/lib/db/schema.ts`

#### Enums
- **ProcessStatus**: `pending`, `processing`, `done`, `failed` — tracks async job execution state
- **JobType**: `company`, `jdmatch`, `feedback`, `letter`, `message` — types of analysis tasks

#### Tables

**resumes**
- `id: uuid` (primary key) — Resume identifier
- `content: text` — Full resume markdown/text

**resume_jobs** (m-to-m join: a resume linked to a job description)
- `id: uuid` (primary key)
- `resumeId: uuid` (FK to resumes, cascade delete)
- `content: text` — Job description text pasted by user

**companies** (analysis result: company research)
- `id: uuid` (primary key)
- `jobId: uuid` (FK to resume_jobs, cascade delete)
- `content: text` — Company research markdown output

**job_description_match** (analysis result: JD match scoring)
- `id: uuid` (primary key)
- `jobId: uuid` (FK to resume_jobs, cascade delete)
- `content: text` — Match analysis markdown output

**resume_feedbacks** (analysis result: resume critique)
- `id: uuid` (primary key)
- `jobId: uuid` (FK to resume_jobs, cascade delete)
- `content: text` — Resume feedback markdown output

**cover_letter_history** (conversation history)
- `jobId: uuid` (FK to resume_jobs, cascade delete)
- `conversation: json` — Array of messages (user + AI) for cover letter generation

**message_gen_history** (conversation history)
- `jobId: uuid` (FK to resume_jobs, cascade delete)
- `conversation: json` — Array of messages (user + AI) for recruitment message generation

**process** (async job tracking)
- `id: uuid` (primary key)
- `jobId: uuid` (FK to resume_jobs, cascade delete)
- `jobType: ProcessJobType enum` — Which type of analysis (company, jdmatch, etc.)
- `status: ProcessStatus enum` (default: pending) — Current state (pending, processing, done, failed)

### Relationships

```
resumes (1)
  ├── resume_jobs (N) [cascade delete]
      ├── companies (N) [cascade delete]
      ├── job_description_match (N) [cascade delete]
      ├── resume_feedbacks (N) [cascade delete]
      ├── cover_letter_history (N) [cascade delete]
      ├── message_gen_history (N) [cascade delete]
      └── process (N) [cascade delete]
```

All child tables cascade delete when resume_jobs is deleted. This ensures referential integrity and cleans up orphaned analysis results.

## Data Flow

```
Frontend (React Context)
  ↓ (when integration complete)
API Route (app/api/*/route.ts)
  ↓
Database Layer (app/lib/db/index.ts)
  ↓
PostgreSQL
  ↓ (async job pickup)
LangGraph Agent
  ↓
Update process.status → done
Update analysis table with results
  ↓
Frontend polls/subscribes to results
```

Currently:
1. Frontend stores everything in React Context (no database sync)
2. Database is configured but has no wired API endpoints or queries
3. Async job processing is designed but not yet implemented

## Dependencies

**Internal:**
- `app/lib/db/schema.ts` — Table and enum definitions
- Environment variables: `PG_USER`, `PG_PASSWORD`, `PG_HOST`, `PG_PORT`, `PG_DATABASE`

**External:**
- `postgres` 3.4.9 — PostgreSQL client
- `drizzle-orm` 0.45.2 — Type-safe ORM
- `drizzle-kit` 0.31.10 — Schema migration tooling
- `dotenv` 17.4.2 — Environment variable loading

## Consumers

**Current:**
- None (database is configured but not yet queried by frontend or API routes)

**Expected (future):**
- `app/api/resumes/*` — Resume CRUD endpoints
- `app/api/jobs/*` — Job/analysis endpoints
- `app/api/process/*` — Async job polling/webhook endpoints
- `app/lib/app-store.tsx` — When refactored to sync with backend

## Patterns & Conventions

**Environment variables:**
All PostgreSQL connection details are environment-driven. Required variables are:
- `PG_USER` — PostgreSQL username
- `PG_PASSWORD` — PostgreSQL password
- `PG_HOST` — Hostname (e.g., localhost, AWS RDS endpoint)
- `PG_PORT` — Port (e.g., 5432)
- `PG_DATABASE` — Database name

Missing variables throw an error at runtime (checked in `app/lib/db/index.ts` and `drizzle.config.ts`).

**Primary keys:**
All tables use `uuid()` primary keys. UUIDs are not auto-generated by Drizzle; callers must provide them (can use `crypto.randomUUID()` in Node.js or a UUID library on the client).

**Cascade delete:**
All foreign keys use `onDelete: 'cascade'`, ensuring that deleting a resume deletes all associated jobs, analyses, and process records. This simplifies cleanup.

**JSON columns:**
`cover_letter_history` and `message_gen_history` store conversations as JSON arrays. Each conversation is a flat array of message objects (not nested). Example:
```json
[
  { "role": "user", "content": "Make it shorter" },
  { "role": "assistant", "content": "Here's a shorter version..." }
]
```

**Async process tracking:**
The `process` table tracks background jobs. When a user requests analysis, a process record is created with status=pending. A background job (LangGraph agent) picks it up, sets status=processing, runs the analysis, then writes results to the appropriate analysis table (company, job_description_match, etc.) and sets status=done (or failed).

## Gotchas & Non-Obvious Logic

**No migrations exist yet:**
The schema is defined but no migration files have been generated. To push to a real database:
1. Set .env variables
2. Run `pnpm db:generate` to create initial migration
3. Run `pnpm db:push` to apply it
4. If schema changes, run `pnpm db:generate` again (non-destructive)

**UUID generation is manual:**
Drizzle does not auto-generate UUIDs (unlike serial IDs). Callers must use `crypto.randomUUID()` or a library like `uuid` when inserting. This is intentional to support client-side ID generation if needed.

**Cascade delete is permanent:**
Deleting a resume deletes everything. There's no soft delete or archive. If this becomes a requirement (e.g., audit trails), consider adding:
```typescript
deletedAt: timestamp('deleted_at')
```
And filtering out deleted rows in queries.

**Schema is commented-out in index.ts:**
The line `import * as schema from './schema'` is commented. When writing queries, uncomment it:
```typescript
import * as schema from './schema';
const resumes = await db.select().from(schema.resume);
```

**No indexes defined:**
Schema has primary keys and foreign keys but no additional indexes (e.g., on jobId for fast lookups). Add indexes as performance testing reveals bottlenecks:
```typescript
.createIndex('idx_resume_jobs_resume_id').on(resumeJob.resumeId)
```

**ProcessStatus enum mismatch:**
The TypeScript enum `ProcessStatus` and PostgreSQL enum `processStatusEnum` must stay in sync. If you add a status (e.g., `Cancelled = 'cancelled'`), update both:
```typescript
export enum ProcessStatus { ..., Cancelled = 'cancelled' }
export const processStatusEnum = pgEnum('process_status', [..., ProcessStatus.Cancelled]);
```

## Open Questions

- Should resumes/jobs have timestamps (createdAt, updatedAt)?
- Should process table track error messages (e.g., `error: text` field)?
- Should conversation history be versioned or immutable?
- What's the retention policy for old analyses (purge after 30 days, keep forever)?
- Should userId be added to support multi-user (currently no auth)?
- How will background jobs (LangGraph) be triggered (webhooks, polling, message queue)?
