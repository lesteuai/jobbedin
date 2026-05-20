# JobbedIn

An AI-assisted job application tool that researches companies and generates personalized cover letters and recruitment messages using an agentic AI workflow.

## Purpose

JobbedIn helps job seekers apply more effectively by automating research and personalization. It ingests a resume and job description, deploys agents to research the target company, cross-references candidate experience against job requirements, critiques the resume, and generates a comprehensive analysis report. Based on these findings, it drafts personalized cover letters and 100-word recruitment summaries.

The application prioritizes Computer Science roles as its domain of expertise.

## Architecture Overview

JobbedIn is a Next.js 16 full-stack application with a Yahoo Messenger (2000s) design aesthetic. The architecture combines a client-centric React frontend with an emerging backend infrastructure for data persistence and AI processing.

**Data flow:**
1. User signs in/up on the login page via better-auth (email/password authentication)
2. Middleware validates session; unauthenticated requests to /resumes or /jobs redirect to /
3. User uploads/selects resumes on /resumes page (scoped to their userId)
4. User navigates to /jobs to add job descriptions (pasted as text; scoped to their userId)
5. System displays job analysis tabs: Company research, JD match scoring, resume feedback, and AI chat for iterative generation of cover letters and messages
6. UI renders mock analysis data and provides chat interface for refining outputs
7. Backend persists all data to PostgreSQL with userId association; async job processing is planned

**Key architectural layers:**
- **Frontend**: Client-side React components with `use client` directives (all user-facing pages and interactive components)
- **Authentication**: better-auth with email/password flow and Drizzle ORM adapter; session validation via Next.js middleware
- **State management**: React Context (AppStore) for cross-page state synchronization; synced to backend API on mount and after mutations
- **Styling**: Tailwind CSS v4 with unified Yahoo Messenger design system (`ym-` class prefix)
- **Backend database**: PostgreSQL with Drizzle ORM for type-safe schema and migrations
- **API layer**: Next.js App Router API routes for resume/job CRUD, analysis data insertion, and chat persistence; all routes validate session and scope data to userId
- **AI processing**: Planned LangGraph agents and OpenAI API integration

## Key Entry Points

- `app/layout.tsx` — Root layout with metadata and AppStoreProvider wrapper
- `app/page.tsx` — Login page with better-auth sign-in/sign-up integration
- `app/resumes/page.tsx` — Resume management and preview (protected by middleware; userId-scoped)
- `app/jobs/page.tsx` — Job management, analysis tabs, and AI generation chat interface (protected; userId-scoped)
- `app/lib/app-store.tsx` — React Context providing global resume/job state and CRUD operations
- `app/lib/auth.ts` — better-auth server configuration with Drizzle ORM adapter
- `app/lib/auth-client.ts` — better-auth client exports (signIn, signUp, signOut, useSession hook)
- `middleware.ts` — Route protection for /resumes and /jobs; redirects unauthenticated users to /

## Directory Structure

```
jobbedin/
├── app/                          # Next.js App Router pages and server-side logic
│   ├── api/                      # API routes (all with session validation and userId scoping)
│   │   ├── auth/
│   │   │   └── [...all]/
│   │   │       └── route.ts      # better-auth handler for sign-in, sign-up, sign-out
│   │   ├── resumes/
│   │   │   ├── route.ts          # GET list resumes, POST upload resume (userId-scoped)
│   │   │   └── [id]/
│   │   │       └── route.ts      # DELETE resume by id (userId-scoped)
│   │   ├── jobs/
│   │   │   ├── route.ts          # GET jobs by resumeId, POST create job (userId-scoped)
│   │   │   └── [id]/
│   │   │       ├── route.ts      # DELETE job by id (userId-scoped)
│   │   │       ├── analyze/
│   │   │       │   └── route.ts  # POST - inserts static analysis data (userId-scoped)
│   │   │       ├── analysis/
│   │   │       │   └── route.ts  # GET - returns company/jdMatch/feedback (userId-scoped)
│   │   │       └── chat/
│   │   │           └── route.ts  # GET/POST - chat history persistence (userId-scoped)
│   │   └── hello/route.ts        # Test endpoint (POST/GET)
│   ├── components/
│   │   └── ym/                   # Yahoo Messenger UI component library
│   │       ├── AppFrame.tsx      # Main app shell with titlebar; sign-out calls authClient.signOut()
│   │       ├── Sidebar.tsx       # Reusable sidebar for list management
│   │       ├── YmButton.tsx      # Styled button (default/primary variants)
│   │       ├── YmModal.tsx       # Confirmation dialog
│   │       └── MarkdownPanel.tsx # Markdown renderer for content display
│   ├── lib/
│   │   ├── app-store.tsx         # React Context for resume/job state management; API-backed
│   │   ├── auth.ts               # better-auth server configuration with Drizzle ORM adapter
│   │   ├── auth-client.ts        # better-auth client exports for frontend consumption
│   │   ├── utils.ts              # Utility: cn() for class merging (clsx + tailwind-merge)
│   │   └── db/
│   │       ├── index.ts          # Drizzle ORM initialization and PostgreSQL client
│   │       └── schema.ts          # Database schema (user, session, account, verification + data tables)
│   ├── hooks/
│   │   └── use-mobile.tsx        # Mobile breakpoint detection hook
│   ├── layout.tsx                # Root layout with AppStoreProvider
│   ├── globals.css               # Yahoo Messenger design system styles
│   ├── page.tsx                  # Login page with better-auth sign-in/sign-up
│   ├── resumes/page.tsx          # Resume management page (protected by middleware)
│   ├── jobs/page.tsx             # Job analysis and generation page (protected by middleware)
│   └── favicon.ico
├── middleware.ts                 # Route protection for /resumes and /jobs; session validation
├── docs/                          # Reference and design documentation
│   ├── frontend/                 # Design system and style guides
│   ├── lovable/                  # Lovable AI assistant context
│   └── LangGraph multi agent.pdf # Future agent orchestration reference
├── references/                    # Reference documents and agent outputs
├── future_jobs/                  # Future feature planning and pipelines
├── drizzle/                      # Migration files
│   └── 0004_colorful_klaw.sql    # Schema updates (name fields, jobId PK)
├── drizzle.config.ts             # Drizzle Kit migration configuration
├── next.config.ts                # Next.js configuration (standalone output)
├── tsconfig.json                 # TypeScript configuration with @ alias
├── postcss.config.mjs            # PostCSS with Tailwind v4
├── eslint.config.mjs             # ESLint config using flat config API
├── .env.example                  # Environment variable template (PostgreSQL, better-auth, origin)
├── package.json                  # Next.js 16, React 19, Tailwind, TypeScript, Drizzle ORM, better-auth
├── pnpm-lock.yaml                # Lockfile (pnpm workspace)
└── README.md                     # High-level project overview
```

## Key Files

- `middleware.ts` — Next.js middleware for route protection; validates session and redirects unauthenticated users from /resumes and /jobs to /
- `app/layout.tsx` — Entry point for all pages; wraps children with AppStoreProvider
- `app/page.tsx` — Login page with better-auth sign-in/sign-up forms; public (no middleware protection)
- `app/lib/auth.ts` — better-auth server initialization with Drizzle ORM adapter; uses BETTER_AUTH_SECRET and ORIGIN env vars
- `app/lib/auth-client.ts` — better-auth client library exports (signIn, signUp, signOut, useSession hook) for frontend use
- `app/lib/app-store.tsx` — Defines Item type and Store context; fetches resumes/jobs from API on mount; CRUD operations backed by API endpoints (now userId-scoped)
- `app/lib/db/schema.ts` — Drizzle ORM table definitions: better-auth tables (user, session, account, verification) + data tables (resumes, resume_jobs, companies, job_description_match, resume_feedbacks, cover_letter_history, message_gen_history, process); all non-auth tables have userId FK and updatedAt $onUpdate
- `app/lib/db/index.ts` — PostgreSQL client initialization with environment variable validation and Drizzle ORM schema setup
- `app/resumes/page.tsx` — Resume list, selection, markdown preview; protected by middleware; file upload triggers userId-scoped API POST and state refresh
- `app/jobs/page.tsx` — Central hub for job analysis: tabs for Company, JDMatch, Feedback, and Generate (chat); protected by middleware; all operations userId-scoped
- `app/api/auth/[...all]/route.ts` — better-auth handler; routes all /api/auth/* requests through better-auth
- `app/api/resumes/route.ts` — GET all resumes (userId-scoped), POST upload resume with name (userId-scoped); validates session
- `app/api/resumes/[id]/route.ts` — DELETE resume by id (userId-scoped); validates session
- `app/api/jobs/route.ts` — GET jobs filtered by resumeId (userId-scoped), POST create job with description (userId-scoped); validates session
- `app/api/jobs/[id]/route.ts` — DELETE job by id (userId-scoped); validates session
- `app/api/jobs/[id]/analyze/route.ts` — POST to insert static analysis data (userId-scoped); validates session
- `app/api/jobs/[id]/analysis/route.ts` — GET analysis data for a job (userId-scoped); validates session
- `app/api/jobs/[id]/chat/route.ts` — GET chat history, POST new chat message (userId-scoped); validates session
- `app/globals.css` — Complete Yahoo Messenger design system (300+ lines of CSS variables, primitives, and component styles)
- `app/components/ym/*.tsx` — Modular UI primitives for consistent theming
- `drizzle.config.ts` — Drizzle Kit configuration for schema migrations and introspection
- `.env.example` — PostgreSQL connection credentials + better-auth configuration (BETTER_AUTH_SECRET, ORIGIN, ORIGIN_DEV)

## Dependencies & Integrations

**Frontend framework:**
- Next.js 16.2.6 (App Router, SSR, image optimization)
- React 19.2.4 (hooks, context, client components)
- react-dom 19.2.4

**Styling:**
- Tailwind CSS v4 with @tailwindcss/postcss plugin
- No CSS modules; all styling via globals.css and inline styles
- Color palette uses OKLch color space for precise control

**UI libraries:**
- react-markdown 10.1.0 (for rendering job descriptions and analysis text)
- clsx 2.1.1 (class name utilities)
- tailwind-merge 3.5.0 (merge conflicting Tailwind classes)

**Authentication:**
- better-auth 0.x (authentication framework with email/password flow)
- @better-auth/pg-adapter (Drizzle ORM adapter for better-auth tables)

**Database & ORM:**
- PostgreSQL 3.4.9 (database client)
- Drizzle ORM 0.45.2 (type-safe schema and query builder)
- Drizzle Kit 0.31.10 (schema migrations and introspection)

**Backend & utilities:**
- dotenv 17.4.2 (environment variable management)
- tsx 4.22.1 (TypeScript execution for scripts)

**Developer tools:**
- TypeScript 5
- ESLint 9 with Next.js config
- pnpm (workspace enabled)

**Backend (future integration):**
- LangGraph (agent orchestration for AI workflows)
- OpenAI-compatible APIs (company research, JD analysis, critique, generation)

## Conventions

**Naming:**
- Component files: PascalCase (e.g., `YmButton.tsx`)
- React Context: `Ctx` internally; exported as `use<Name>` hooks
- Event handlers: Prefix with `handle` (e.g., `handleSubmit`, `handleSelect`)
- Enum/discriminated union types: State types named by scope (e.g., `Mode`, `View`, `Tab`)
- Prefixed classes: `ym-` for all Yahoo Messenger design system primitives

**Code organization:**
- Pages live in app router directories, not colocated with components
- Component library isolated under `app/components/ym/`
- Utilities, state, and database logic in `app/lib/`; hooks in `app/hooks/`
- Database schema (`app/lib/db/schema.ts`) defines all tables, enums, and relationships
- Database client (`app/lib/db/index.ts`) initializes Drizzle ORM with environment validation
- State type definitions at top of store context file
- Sample data (`SAMPLE_RESUME`, `SAMPLE_JOB`, `MOCK`, `SEED`, `PLACEHOLDER`) defined as constants near where they're used

**React patterns:**
- All pages and interactive components use `'use client'` directive
- Context consumed via `useAppStore()` hook; throws if outside provider
- Local state (form inputs, modal visibility, view modes) kept in component
- No prop drilling; context for cross-page concerns only
- Controlled inputs with onChange handlers

**Styling:**
- Inline styles for layout (flexbox, positioning, sizing)
- Class names for theming and state-dependent styles (`.ym-btn`, `.ym-btn:hover`, `[data-active="true"]`)
- Color variables defined in :root; no hardcoded colors except in gradients
- CSS Grid/Flexbox for layout; no CSS-in-JS library (Tailwind handles responsive)

**Type safety:**
- Strict TypeScript mode enabled
- Type definitions colocated with their use (e.g., `Item`, `Store`, `Mode`, `Tab`)
- HTML5 semantic elements where possible; fallback to div for layout

**Authentication with better-auth:**
Session validation is done at two levels: (1) middleware protects /resumes and /jobs routes by checking session headers and redirecting unauthenticated users to /; (2) all data API routes (resumes, jobs, analysis, chat) explicitly validate session and scope all queries to the authenticated user's userId. Session tokens are managed by better-auth and stored in the database. The sign-out endpoint calls `authClient.signOut()` on the frontend, which clears the session cookie.

**Backend API integration & userId scoping:**
All resumes, jobs, and analysis data are persisted to PostgreSQL and scoped to the authenticated user's userId. On mount, `useAppStore()` calls API endpoints to fetch the user's resumes and jobs. CRUD operations (create, delete) trigger API calls which update both the database and the React Context. State survives page refresh. All API routes validate the session before executing queries.

**Analysis data is static (backend-provided):**
The `/api/jobs/[id]/analyze` endpoint inserts hardcoded analysis data (company research, JD match scoring, resume feedback) into the database. These are not yet generated by AI agents; they are placeholder data for testing the analysis data flow. Chat responses are generated by the UI; actual AI generation is planned via LangGraph agents.

**Database in production:**
PostgreSQL schema includes better-auth tables (user, session, account, verification) plus JobbedIn data tables (resumes, resume_jobs, companies, job_description_match, resume_feedbacks, cover_letter_history, message_gen_history, process). Migrations are tracked in `drizzle/`. Environment variables must be set: PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DATABASE (PostgreSQL), and BETTER_AUTH_SECRET, ORIGIN, ORIGIN_DEV (better-auth).

**File handling:**
Resume upload via hidden file input in `app/resumes/page.tsx`. Files are stored by name in the database; actual file content (PDF/DOCX parsing) is not yet implemented (UI labels this as "mock").

**Yahoo Messenger design system:**
The entire visual language is intentionally retro (2000s Windows XP). This is not a limitation but a deliberate aesthetic choice. All components follow this design. New components must respect the `ym-` class naming and color palette.

**Migration from Vite to Next.js:**
The codebase was recently migrated from Vite + TanStack Router to Next.js App Router (see git history). Some patterns may still reflect that transition. The old Vite structure (`nextjs-migrate/`) is marked for deletion in git status.

**Keyboard interaction:**
The Yahoo Messenger design expects keyboard-friendly navigation. No buttons are disabled by default except when form validation fails. Tab order is implicit (DOM order).

## Development Workflow

**Setup:**
```bash
pnpm install
```

**Environment setup:**
Copy `.env.example` to `.env.local` and fill in all values:
- PostgreSQL credentials: PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DATABASE
- better-auth secret: BETTER_AUTH_SECRET (generate a random string for development; use a secure secret in production)
- Origin URLs: ORIGIN (production domain), ORIGIN_DEV (http://localhost:3000 for development)

**Development server:**
```bash
pnpm dev
```
Runs on http://localhost:3000 by default (configured in next.config.ts).

**Build:**
```bash
pnpm build
```
Produces `standalone` output (suitable for Docker and serverless deployment).

**Start production server:**
```bash
pnpm start
```

**Lint:**
```bash
pnpm lint
```
Runs ESLint with Next.js and TypeScript rules.

**Database migrations (Drizzle Kit):**
```bash
pnpm db:generate
```
Generates migration files from schema changes.

```bash
pnpm db:push
```
Pushes schema to PostgreSQL database (creates/alters tables).

```bash
pnpm db:migrate
```
Runs pending migrations.

**Test database connection:**
```bash
pnpm test-db
```
Executes `app/lib/db/index.ts` with environment validation (requires PG_* env vars set).

**Type check:**
```bash
npx tsc --noEmit
```
(Not in package.json; run manually if needed)

## Module Detail Docs

- [UI Components & Design System](claude-docs/ui-components.md) — Yahoo Messenger primitive components and theming strategy
- [State Management & Store](claude-docs/state-management.md) — AppStore context, item management, and cross-page state sync
- [Pages & Routing](claude-docs/pages-routing.md) — Route structure, data flow between pages, view states
- [Styling & Theming](claude-docs/styling-theming.md) — Color system, CSS organization, design token usage
- [Database & Backend (todo)](claude-docs/database-backend.md) — Drizzle ORM schema, PostgreSQL tables, async job processing, API routes
