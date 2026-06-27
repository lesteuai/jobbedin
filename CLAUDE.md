# JobbedIn

An AI-assisted job application tool that researches companies and generates personalized cover letters and recruitment messages using an agentic AI workflow.

## Quick Overview

JobbedIn is a Next.js 16 full-stack application with a Yahoo Messenger (2000s) design aesthetic. Users upload resumes, add job descriptions, and the app deploys a 5-node LangGraph workflow to research companies, critique resumes, match JD requirements, and generate personalized cover letters and recruiter messages. The chat interface enables iterative refinement of outputs.

**Data flow:** Login → Upload Resume → Add Job → Analyze (async workflow + SSE stream) → View Results → Chat to Refine

**Key tech stack:** Next.js 16, React 19, Tailwind CSS v4, TypeScript, PostgreSQL, Drizzle ORM, better-auth, LangGraph, OpenRouter LLMs, Tavily search

## Architecture Layers

- **Frontend**: React components with `use client`, AppStore context for state, Yahoo Messenger design system (`ym-` classes)
- **Authentication**: better-auth 1.6.11 with email/password flow; session validation on all API routes
- **Database**: PostgreSQL + Drizzle ORM; all data scoped to userId; migrations in `drizzle/`
- **API**: Next.js App Router routes; `handleAsync` wrapper for global error handling; all routes return 401 if session invalid
- **AI Workflow**: LangGraph StateGraph with 5 parallel/sequential nodes (ResearchCompany, CrossRef, ResumeFeedback → GenerateLetter, GenerateMsg); fire-and-forget execution; results and process status streamed to client via SSE (Server-Sent Events)

## Directory Structure

```
app/
├── api/                    # Session-validated, userId-scoped routes
├── lib/
│   ├── components/         # AnalysisReport, ym/ UI primitives
│   │   └── ym/             # Yahoo Messenger design system components
│   ├── hooks/              # useChat hook
│   ├── auth/               # better-auth configuration
│   ├── db/                 # Drizzle schema and database client
│   ├── api-handler.ts      # Error handling and session validation
│   ├── app-store.tsx       # Global state management
│   ├── workflow.ts         # LangGraph workflow definition
│   └── system-prompt.ts    # Centralized LLM prompts
├── resumes/                # [id]/ job analysis hub
└── page.tsx, layout.tsx    # Login page and root layout
```

See full tree and entry points in [Pages & Routing](claude-docs/pages-routing.md).

## Module Documentation

- [UI Components & Design System](claude-docs/ui-components.md) — Primitives, color system, theming
- [State Management](claude-docs/state-management.md) — AppStore context, CRUD operations, lazy job loading
- [Pages & Routing](claude-docs/pages-routing.md) — Route structure, data flow, entry points
- [Styling & Theming](claude-docs/styling-theming.md) — Color palette, CSS organization, tokens
- [Database & Backend](claude-docs/database-backend.md) — Schema, migrations, API routes, session validation
- [LangGraph Workflow & Agents](claude-docs/workflow-agents.md) — Node definitions, LLM prompts, Tavily, process tracking
- [Conventions & Patterns](claude-docs/conventions.md) — Naming, code org, React patterns, authentication
- [Gotchas & Troubleshooting](claude-docs/gotchas.md) — Known issues, debugging, environment setup

## Development

**Setup:**
```bash
pnpm install
cp .env.example .env.local
# Fill in: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, BETTER_AUTH_SECRET, ORIGIN, OPENROUTER_API_KEY, TAVILY_API_KEY
pnpm dev
```

**Database:**
```bash
pnpm db:generate  # After schema changes
pnpm db:push      # Push to PostgreSQL
pnpm test-db      # Validate connection
```

**Lint & Build:**
```bash
pnpm lint
pnpm build  # standalone output
```

See [Conventions & Patterns](claude-docs/conventions.md) for naming, code org, and authentication patterns.
