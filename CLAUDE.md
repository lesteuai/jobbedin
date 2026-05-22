# JobbedIn

An AI-assisted job application tool that researches companies and generates personalized cover letters and recruitment messages using an agentic AI workflow.

## Purpose

JobbedIn helps job seekers apply more effectively by automating research and personalization. It ingests a resume and job description, deploys agents to research the target company, cross-references candidate experience against job requirements, critiques the resume, and generates a comprehensive analysis report. Based on these findings, it drafts personalized cover letters and 100-word recruitment summaries.

CS-focused job application assistant with AI-powered analysis workflow.

## Architecture Overview

JobbedIn is a Next.js 16 full-stack application with a Yahoo Messenger (2000s) design aesthetic. The architecture combines a client-centric React frontend with an emerging backend infrastructure for data persistence and AI processing.

**Data flow:**
1. User signs in/up on the login page via better-auth (email/password authentication)
2. User navigates to /resumes page; API calls validate session and return 401 if not authenticated
3. User uploads resumes (PDF, TXT, MD) on /resumes page (scoped to their userId); PDF content is extracted via pdf-parse
4. User clicks "To Job" button, navigating to `/resumes/[resumeId]` which calls selectResume(resumeId) on mount
5. User adds job descriptions on /resumes/[resumeId] page (pasted as text; scoped to their userId)
6. User clicks "Analyze" to trigger the job analysis workflow
7. Frontend POST to `/api/jobs/[id]/analyze` returns 202 immediately and workflow starts asynchronously
8. LangGraph workflow (app/lib/workflow.ts) executes five nodes in parallel and sequential stages:
   - Stage 1 (parallel): ResearchCompany (Tavily search + agent), CrossRef (JD vs resume match), ResumeFeedback (critical review)
   - Stage 2 (depends on Company + CrossRef): GenerateLetter and GenerateMsg nodes run in parallel
   - Each node writes results to PostgreSQL and updates its process status
9. Frontend polls `/api/jobs/[id]/analysis` every 1 second to display results incrementally
10. When all 5 process statuses are Done, UI loads complete analysis and generated cover letter/message from database
11. UI provides chat interface for iterative refinement of cover letter and message outputs
12. User sends message via chat, frontend POSTs `{ mode, userMessage }` to `/api/jobs/[id]/chat`, LLM generates reply using full conversation history, returns `{ reply }`, and persists updated conversation to database

**Key architectural layers:**
- **Frontend**: Client-side React components with `use client` directives (all user-facing pages and interactive components)
- **Authentication**: better-auth 1.6.11 with email/password flow and Drizzle ORM adapter; session validation via API route handlers (removed Next.js middleware)
- **State management**: React Context (AppStore) for cross-page state synchronization; synced to backend API on mount and after mutations
- **Styling**: Tailwind CSS v4 with unified Yahoo Messenger design system (`ym-` class prefix)
- **Backend database**: PostgreSQL with Drizzle ORM for type-safe schema and migrations
- **API layer**: Next.js App Router API routes for resume/job CRUD, analysis data insertion, and chat persistence; all routes validate session via `auth.api.getSession()` and scope data to userId
- **File handling**: PDF extraction via pdf-parse; TXT and Markdown files read as plain text
- **AI processing**: LangGraph multi-agent workflow (app/lib/workflow.ts) with 5 nodes orchestrating company research, resume critique, JD matching, cover letter generation, and message generation via OpenRouter API (Llama 3.1 models)

## Key Entry Points

- `app/layout.tsx` — Root layout with metadata and AppStoreProvider wrapper
- `app/page.tsx` — Login page with better-auth sign-in/sign-up integration
- `app/resumes/page.tsx` — Resume management and preview (API-protected; userId-scoped); "To Job" button navigates to `/resumes/[resumeId]`
- `app/resumes/[id]/page.tsx` — Job management, analysis tabs, and AI generation chat interface for a selected resume (API-protected; userId-scoped); calls selectResume(resumeId) on mount via useParams()
- `app/lib/app-store.tsx` — React Context providing global resume/job state and CRUD operations
- `app/lib/auth.ts` — better-auth server configuration with Drizzle ORM adapter
- `app/lib/auth-client.ts` — better-auth client exports (signIn, signUp, signOut, useSession hook)

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
│   │   ├── workflow.ts           # LangGraph multi-agent workflow: 5 nodes orchestrating analysis, research, generation
│   │   └── db/
│   │       ├── index.ts          # Drizzle ORM initialization and PostgreSQL client
│   │       └── schema.ts          # Database schema (user, session, account, verification + data tables + process tracking)
│   ├── hooks/
│   │   └── use-mobile.tsx        # Mobile breakpoint detection hook
│   ├── layout.tsx                # Root layout with AppStoreProvider
│   ├── globals.css               # Yahoo Messenger design system styles
│   ├── page.tsx                  # Login page with better-auth sign-in/sign-up
│   ├── resumes/
│   │   ├── page.tsx              # Resume management page (API-protected via session validation)
│   │   └── [id]/
│   │       └── page.tsx          # Job analysis page for selected resume (API-protected; selectResume on mount)
│   └── favicon.ico
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

- `app/layout.tsx` — Entry point for all pages; wraps children with AppStoreProvider
- `app/page.tsx` — Login page with better-auth sign-in/sign-up forms; public (no middleware protection)
- `app/lib/auth.ts` — better-auth server initialization with Drizzle ORM adapter; uses BETTER_AUTH_SECRET and ORIGIN env vars
- `app/lib/auth-client.ts` — better-auth client library exports (signIn, signUp, signOut, useSession hook) for frontend use
- `app/lib/app-store.tsx` — Defines Item type and Store context; fetches resumes/jobs from API on mount; CRUD operations backed by API endpoints (now userId-scoped)
- `app/lib/workflow.ts` — LangGraph multi-agent workflow; exports runWorkflow() which orchestrates ResearchCompany, CrossRef, ResumeFeedback (parallel from START) -> GenerateLetter, GenerateMsg (depend on Company + CrossRef); each node writes to DB and updates process status; uses OpenRouter API via Llama 3.1 models and Tavily search
- `app/lib/db/schema.ts` — Drizzle ORM table definitions: better-auth tables (user, session, account, verification) + data tables (resumes, resume_jobs, companies, job_description_match, resume_feedbacks, cover_letter_history, message_gen_history, process); all non-auth tables have userId FK and updatedAt $onUpdate
- `app/lib/db/index.ts` — PostgreSQL client initialization with environment variable validation and Drizzle ORM schema setup
- `app/resumes/page.tsx` — Resume list, selection, markdown preview; file upload triggers userId-scoped API POST and state refresh; supports .pdf, .txt, .md; "To Job" button navigates to `/resumes/${selectedResumeId}`
- `app/resumes/[id]/page.tsx` — Job analysis hub for a selected resume: accepts resumeId from URL via useParams(), calls selectResume(resumeId) on mount; tabs for Company, JDMatch, Feedback, and Generate (chat); all operations userId-scoped; contains job list, add/delete, analysis, and chat interface; chat UI shows optimistic user messages, typing indicator with animated dots while AI responds, and auto-scrolls to bottom on new messages
- `app/api/auth/[...all]/route.ts` — better-auth handler; routes all /api/auth/* requests through better-auth
- `app/api/resumes/route.ts` — GET all resumes (userId-scoped), POST upload resume with name (userId-scoped); validates session
- `app/api/resumes/[id]/route.ts` — DELETE resume by id (userId-scoped); validates session
- `app/api/jobs/route.ts` — GET jobs filtered by resumeId (userId-scoped), POST create job with description (userId-scoped); validates session
- `app/api/jobs/[id]/route.ts` — DELETE job by id (userId-scoped); validates session
- `app/api/jobs/[id]/analyze/route.ts` — POST to trigger workflow start (userId-scoped); validates session, checks if already analyzed, clears old results, creates 5 process records with Processing/Pending status, fire-and-forgets runWorkflow() in background, returns 202 immediately
- `app/api/jobs/[id]/analysis/route.ts` — GET analysis data for a job (userId-scoped); returns company research, jdMatch, feedback, letterConversation, messageConversation, and array of 5 process statuses; used for polling during workflow execution
- `app/api/jobs/[id]/chat/route.ts` — GET chat history (userId-scoped); POST accepts `{ mode, userMessage }` to invoke ChatOpenAI LLM, fetches company research, JD match, and resume content in parallel, appends all context to system prompt, builds full message history, generates reply, persists updated conversation, returns `{ reply }`; legacy path `{ mode, conversation }` still supported for clearing (userId-scoped); validates session
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
- better-auth 1.6.11 (authentication framework with email/password flow)
- better-call 2.0.3 (utility library)
- @better-auth/pg-adapter (Drizzle ORM adapter for better-auth tables)

**Database & ORM:**
- PostgreSQL 3.4.9 (database client)
- Drizzle ORM 0.45.2 (type-safe schema and query builder)
- Drizzle Kit 0.31.10 (schema migrations and introspection)

**Backend & utilities:**
- dotenv 17.4.2 (environment variable management)
- tsx 4.22.1 (TypeScript execution for scripts)
- pdf-parse 2.4.5 (PDF text extraction)

**AI & LLM libraries:**
- @langchain/langgraph (multi-agent workflow orchestration; StateGraph, START, END, Annotation)
- @langchain/core (ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, StringOutputParser, tool decorator, z schema validation)
- @langchain/openai (ChatOpenAI client for LLM interaction)
- @langchain/tavily (TavilySearch tool for web research)
- openrouter API (via OPENROUTER_API_KEY env var; uses Llama 3.1 8B instruct models)

**Developer tools:**
- TypeScript 5
- ESLint 9 with Next.js config
- pnpm (workspace enabled)

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
All data API routes (resumes, jobs, analysis, chat) explicitly validate session via `auth.api.getSession({ headers: request.headers })` and scope all queries to the authenticated user's userId. If session is missing, routes return 401 Unauthorized. Session tokens are managed by better-auth and stored in the database. The sign-out endpoint calls `authClient.signOut()` on the frontend, which clears the session cookie. Pages are client-rendered without server-side route protection; API-level validation is the security boundary.

**Backend API integration & userId scoping:**
All resumes, jobs, and analysis data are persisted to PostgreSQL and scoped to the authenticated user's userId. On mount, `useAppStore()` calls API endpoints to fetch the user's resumes and jobs. CRUD operations (create, delete) trigger API calls which update both the database and the React Context. State survives page refresh. All API routes validate the session before executing queries.

**Analysis data is AI-generated via LangGraph workflow:**
The `/api/jobs/[id]/analyze` endpoint triggers `runWorkflow()` asynchronously, which:
1. Deletes prior analysis results for the job
2. Creates 5 process records (Company, JDMatch, ResumeFeedback, Letter, Message) with status tracking
3. Spawns the LangGraph StateGraph concurrently:
   - ResearchCompany: Tavily search agent that researches company mission, culture, hiring news; writes to `company` table
   - CrossRef: LLM-based analysis comparing resume vs JD; writes to `jobDescriptionMatch` table
   - ResumeFeedback: LLM-based critical review of resume; writes to `resumeFeedback` table
   - GenerateLetter: LLM-based cover letter writer (depends on Company + CrossRef); writes to `coverLetterHistory` table (conversation: [{ role: 'ai', text: result }])
   - GenerateMsg: LLM-based recruiter message writer (depends on Company + CrossRef); writes to `messageGenHistory` table (conversation: [{ role: 'ai', text: result }])
Each node updates its process status to Done or Failed upon completion. The workflow is fire-and-forget; the API returns 202 immediately. Frontend polls `/api/jobs/[id]/analysis` to check process statuses and display results as they complete.

**Database in production:**
PostgreSQL schema includes better-auth tables (user, session, account, verification) plus JobbedIn data tables (resumes, resume_jobs, companies, job_description_match, resume_feedbacks, cover_letter_history, message_gen_history, process). Migrations are tracked in `drizzle/`. Environment variables must be set: PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DATABASE (PostgreSQL), and BETTER_AUTH_SECRET, ORIGIN, ORIGIN_DEV (better-auth).

**File handling:**
Resume upload via hidden file input in `app/resumes/page.tsx`. Supports PDF, TXT, and Markdown files. PDF content is extracted to plain text using pdf-parse; TXT and MD files are decoded as UTF-8. File names (without extension) and content are stored in PostgreSQL. API route validates file type and returns 400 for unsupported formats.

**Yahoo Messenger design system:**
The entire visual language is intentionally retro (2000s Windows XP). This is not a limitation but a deliberate aesthetic choice. All components follow this design. New components must respect the `ym-` class naming and color palette.

**Architecture evolution:**
- Initial migration from Vite + TanStack Router to Next.js App Router completed (see git history)
- Middleware-based route protection was recently removed (commit 540145d); now API-only session validation
- PDF parsing via pdf-parse was added to support resume extraction from PDF files

**Keyboard interaction:**
The Yahoo Messenger design expects keyboard-friendly navigation. No buttons are disabled by default except when form validation fails. Tab order is implicit (DOM order).

**Frontend polling and incremental result display:**
When the user clicks "Analyze", the frontend POSTs to `/api/jobs/[id]/analyze` and receives 202. It then sets `isAnalyzing=true` and calls `startPolling(jobId)` which spawns a setInterval polling loop (every 1 second) that fetches `/api/jobs/[id]/analysis`. The analysis endpoint returns all process statuses, which the frontend displays to show progress (e.g., "Company: Processing", "JDMatch: Done"). As workflow nodes complete, the endpoint also returns their generated content (company, jdMatch, feedback, letterConversation, messageConversation). The polling loop terminates when all 5 processes reach Done or Failed status. This pattern allows real-time visibility into asynchronous workflow progress.

**Chat interface and LLM-driven refinement:**
In the "Generate" tab, users switch between "Cover Letter" and "Message" modes and iteratively refine generated content. Each mode has its own conversation history persisted to the database. When user sends a message via the chat input, `handleSend()` adds the user message to the local chat state immediately (optimistic update), sets `isAiTyping=true`, POSTs `{ mode, userMessage }` to `/api/jobs/[id]/chat`. While awaiting response, a typing indicator displays animated cycling dots (`.`, `..`, `...` every 400ms). The chat container auto-scrolls to the bottom on new messages. The API route fetches the existing conversation from database, company research, JD match content, and resume content in parallel, converts all prior messages to LangChain message objects (HumanMessage and AIMessage), appends all available context to the system prompt (company summary, cross-ref insights, resume, job description), appends the new user message, calls ChatOpenAI via OpenRouter, receives the AI reply, and returns `{ reply }`. The frontend receives the reply, appends it to the chat state, and persists the updated conversation (history + user message + ai reply) back to the database for next load. Legacy support: POSTing `{ mode, conversation }` clears and replaces the entire conversation (used by Clear button).

## Gotchas & Notes

**No middleware route protection:**
The middleware.ts file was removed. Pages like /resumes and /jobs are now publicly accessible but will fail to load data if session is missing (API returns 401). To add back server-side protection, implement a middleware.ts that checks session before allowing access to protected routes.

**API session validation pattern:**
Every API route uses `auth.api.getSession({ headers: request.headers })` to validate. This must be called before any database query. If missing, the route is vulnerable to unauthenticated access. All data queries must also use `eq(table.userId, session.user.id)` to prevent cross-user data leaks.

**PDF parsing errors:**
pdf-parse can fail on certain encrypted or malformed PDFs. The API returns 400 on parse failure, but does not retry or fallback. Large PDFs may timeout; consider implementing chunked processing for production.

**File naming:**
Resume files are stored by name (without extension). If two files have the same name, the second upload will create a duplicate entry with the same name but different UUID. Consider enforcing unique names per user or appending a timestamp.

**Better-auth session management:**
Session cookies are set by better-auth automatically. Logout via `authClient.signOut()` clears cookies on the client but does not invalidate the database record. Expired sessions are still present in the database (expiresAt timestamp is the source of truth).

**No environment variable validation on app startup:**
Database initialization happens at import time. Missing PG_* or BETTER_AUTH_SECRET env vars will crash the server. The app does not validate all required env vars at startup; only when db/auth modules are imported.

**LangGraph workflow environment variables:**
The workflow requires OPENROUTER_API_KEY and optionally REASONING_MODEL and WRITING_MODEL env vars. If OPENROUTER_API_KEY is missing, runWorkflow() will fail. Default models are 'meta-llama/llama-3.1-8b-instruct:free' on OpenRouter. Missing env vars will cause the async workflow to fail silently (the process status will be set to Failed but the API call already returned 202).

**Tavily search tool requires credentials:**
The TavilySearch tool in workflow.ts requires a TAVILY_API_KEY env var (implicit in @langchain/tavily). If missing, company research node will fail. No fallback is implemented.

**Fire-and-forget workflow execution:**
The `/api/jobs/[id]/analyze` endpoint calls `void runWorkflow()` without awaiting or error handling beyond what's inside runWorkflow(). If the workflow crashes, the frontend will see process status "Failed" on next poll, but the error is only logged to server console, not returned to the client.

**Process status tracking is per-node:**
Each workflow node independently updates its own process record in the database. If multiple nodes fail, their statuses will be Failed independently. The frontend polls and displays all 5 statuses, but there is no aggregated error summary or retry mechanism at the node level.

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
- OpenRouter API: OPENROUTER_API_KEY (required for LangGraph workflow; get from https://openrouter.ai)
- Tavily search: TAVILY_API_KEY (required for company research node; get from https://tavily.com)
- LLM model override (optional): REASONING_MODEL, WRITING_MODEL (default: 'meta-llama/llama-3.1-8b-instruct:free' on OpenRouter)

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
- [Database & Backend](claude-docs/database-backend.md) — Drizzle ORM schema, PostgreSQL tables, API routes, session validation
- [LangGraph Workflow & AI Agents](claude-docs/workflow-agents.md) — Multi-agent orchestration, node definitions, LLM prompts, Tavily research, process tracking
