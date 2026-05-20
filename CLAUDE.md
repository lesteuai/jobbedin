# JobbedIn

An AI-assisted job application tool that researches companies and generates personalized cover letters and recruitment messages using an agentic AI workflow.

## Purpose

JobbedIn helps job seekers apply more effectively by automating research and personalization. It ingests a resume and job description, deploys agents to research the target company, cross-references candidate experience against job requirements, critiques the resume, and generates a comprehensive analysis report. Based on these findings, it drafts personalized cover letters and 100-word recruitment summaries.

The application prioritizes Computer Science roles as its domain of expertise.

## Architecture Overview

JobbedIn is a Next.js 16 full-stack application with a Yahoo Messenger (2000s) design aesthetic. The architecture combines a client-centric React frontend with an emerging backend infrastructure for data persistence and AI processing.

**Data flow:**
1. User logs in to the login page (mock auth redirects to /resumes)
2. User uploads/selects resumes on /resumes page
3. User navigates to /jobs to add job descriptions (pasted as text)
4. System displays job analysis tabs: Company research, JD match scoring, resume feedback, and AI chat for iterative generation of cover letters and messages
5. UI renders mock analysis data and provides chat interface for refining outputs
6. Backend processes async jobs and persists results to PostgreSQL

**Key architectural layers:**
- **Frontend**: Client-side React components with `use client` directives (all user-facing pages and interactive components)
- **State management**: React Context (AppStore) for cross-page state synchronization of resumes and jobs (currently client-only, no persistence)
- **Styling**: Tailwind CSS v4 with unified Yahoo Messenger design system (`ym-` class prefix)
- **Backend database**: PostgreSQL with Drizzle ORM for type-safe schema and migrations
- **API layer**: Next.js App Router API routes for backend operations
- **AI processing**: Planned LangGraph agents and OpenAI API integration

## Key Entry Points

- `app/layout.tsx` — Root layout with metadata and AppStoreProvider wrapper
- `app/page.tsx` — Login page (signin/signup/forgot password modes)
- `app/resumes/page.tsx` — Resume management and preview
- `app/jobs/page.tsx` — Job management, analysis tabs, and AI generation chat interface
- `app/lib/app-store.tsx` — React Context providing global resume/job state and CRUD operations

## Directory Structure

```
jobbedin/
├── app/                          # Next.js App Router pages and server-side logic
│   ├── api/                      # API routes (Next.js server functions)
│   │   └── hello/route.ts        # Test endpoint (POST/GET)
│   ├── components/
│   │   └── ym/                   # Yahoo Messenger UI component library
│   │       ├── AppFrame.tsx      # Main app shell with titlebar and sign-out
│   │       ├── Sidebar.tsx       # Reusable sidebar for list management
│   │       ├── YmButton.tsx      # Styled button (default/primary variants)
│   │       ├── YmModal.tsx       # Confirmation dialog
│   │       └── MarkdownPanel.tsx # Markdown renderer for content display
│   ├── lib/
│   │   ├── app-store.tsx         # React Context for resume/job state management
│   │   ├── utils.ts              # Utility: cn() for class merging (clsx + tailwind-merge)
│   │   └── db/
│   │       ├── index.ts          # Drizzle ORM initialization and PostgreSQL client
│   │       └── schema.ts          # Database schema (tables, enums, relationships)
│   ├── hooks/
│   │   └── use-mobile.tsx        # Mobile breakpoint detection hook
│   ├── layout.tsx                # Root layout with AppStoreProvider
│   ├── globals.css               # Yahoo Messenger design system styles
│   ├── page.tsx                  # Login page
│   ├── resumes/page.tsx          # Resume management page
│   ├── jobs/page.tsx             # Job analysis and generation page
│   └── favicon.ico
├── docs/                          # Reference and design documentation
│   ├── frontend/                 # Design system and style guides
│   ├── lovable/                  # Lovable AI assistant context
│   └── LangGraph multi agent.pdf # Future agent orchestration reference
├── references/                    # Reference documents and agent outputs
├── future_jobs/                  # Future feature planning and pipelines
├── drizzle.config.ts             # Drizzle Kit migration configuration
├── next.config.ts                # Next.js configuration (standalone output)
├── tsconfig.json                 # TypeScript configuration with @ alias
├── postcss.config.mjs            # PostCSS with Tailwind v4
├── eslint.config.mjs             # ESLint config using flat config API
├── .env.example                  # Environment variable template (PostgreSQL credentials)
├── package.json                  # Next.js 16, React 19, Tailwind, TypeScript, Drizzle ORM
├── pnpm-lock.yaml                # Lockfile (pnpm workspace)
└── README.md                     # High-level project overview
```

## Key Files

- `app/layout.tsx` — Entry point for all pages; wraps children with AppStoreProvider
- `app/lib/app-store.tsx` — Defines Item type and Store context; seed data for resumes and jobs; CRUD operations (currently client-only)
- `app/lib/db/schema.ts` — Drizzle ORM table definitions: resumes, resume_jobs, companies, job_description_match, resume_feedbacks, cover_letter_history, message_gen_history, process tracking
- `app/lib/db/index.ts` — PostgreSQL client initialization with environment variable validation
- `app/resumes/page.tsx` — Resume list, selection, and markdown preview with navigation to jobs
- `app/jobs/page.tsx` — Central hub for job analysis: tabs for Company, JDMatch, Feedback, and Generate (chat); handles view states (idle, view, add, report)
- `app/globals.css` — Complete Yahoo Messenger design system (300+ lines of CSS variables, primitives, and component styles)
- `app/components/ym/*.tsx` — Modular UI primitives for consistent theming
- `drizzle.config.ts` — Drizzle Kit configuration for schema migrations and introspection
- `.env.example` — PostgreSQL connection credentials template

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
- Supabase (auth and optional additional services)

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

## Gotchas & Notes

**Frontend-only state (client-side state not yet synced to backend):**
The app currently stores resumes and jobs entirely in React Context with no backend persistence. Refreshing the page loses all state. Sample data is hardcoded and regenerated on mount. The database schema and ORM are in place but not yet wired to the UI. This is a temporary placeholder awaiting backend API integration.

**Database infrastructure in place:**
PostgreSQL schema is defined via Drizzle ORM (resumes, resume_jobs, companies, job_description_match, resume_feedbacks, cover_letter_history, message_gen_history, process). Environment variables (PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DATABASE) must be set in .env for the database client to initialize. No migrations have been run yet; this is setup awaiting deployment.

**Mock data throughout:**
- `app/jobs/page.tsx` contains `MOCK` object with hardcoded analysis for Company, JDMatch, and Feedback tabs
- Chat responses are mock strings; no actual AI calls
- Resume and job management is CRUD-only; no parsing of .pdf or .docx files (noted in UI as "mock")

**Yahoo Messenger design system:**
The entire visual language is intentionally retro (2000s Windows XP). This is not a limitation but a deliberate aesthetic choice. All components follow this design. New components must respect the `ym-` class naming and color palette.

**No authentication:**
Login page exists but redirects directly to /resumes without validating credentials. This is a placeholder for future Supabase integration.

**Migration from Vite to Next.js:**
The codebase was recently migrated from Vite + TanStack Router to Next.js App Router (see git history). Some patterns may still reflect that transition. The old Vite structure (`nextjs-migrate/`) is marked for deletion in git status.

**Keyboard interaction:**
The Yahoo Messenger design expects keyboard-friendly navigation. No buttons are disabled by default except when form validation fails. Tab order is implicit (DOM order).

## Development Workflow

**Setup:**
```bash
pnpm install
```

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
