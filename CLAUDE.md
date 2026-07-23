# JobbedIn

An AI-assisted job application tool that researches companies and generates personalized cover letters and recruitment messages using an agentic AI workflow.

## Quick Overview

JobbedIn is a Next.js 16 full-stack application with a Yahoo Messenger (2000s) design aesthetic. Users upload resumes, add job descriptions, and the app deploys a 5-node LangGraph workflow to research companies, critique resumes, match JD requirements, and generate personalized cover letters and recruiter messages. The chat interface enables iterative refinement with custom AI instructions, and outputs render with markdown styling.

**Data flow:** Login → Upload Resume → Add Job → Analyze (async workflow + SSE stream) → View Results → Chat to Refine (with custom AI prompts) → Settings (manage password, custom AI prompts, and optional OpenRouter API key)

**Key tech stack:** Next.js 16, React 19, Tailwind CSS v4, TypeScript, PostgreSQL, Drizzle ORM, better-auth, LangGraph, OpenRouter LLMs, Tavily search, ReactMarkdown

## Architecture Layers

- **Frontend**: React components with `use client`, AppStore context for state, Yahoo Messenger design system (`ym-` classes); chat and analysis display use ReactMarkdown for styled content rendering
- **Authentication**: better-auth 1.6.11 with email/password flow; email verification (optional via EMAIL_ENABLED flag); password reset via emailed token; account deletion with optional email confirmation; password change for authenticated users; resend email controls with 30s cooldown; session validation on all API routes
- **Database**: PostgreSQL + Drizzle ORM; all data scoped to userId; migrations in `drizzle/`; userSettings table for per-user AI customization (custom prompts, encrypted OpenRouter API key); process table tracks per-node status and failure reasons (e.g., 'out_of_credit' for HTTP 402 errors)
- **API**: Next.js App Router routes; `handleAsync` and `handleAsyncAuth` wrappers for error handling and session validation; all routes return 401 if session invalid; settings API supports PUT with partial updates (preserves unmodified fields)
- **AI Workflow**: LangGraph StateGraph with 5 parallel/sequential nodes (ResearchCompany, CrossRef, ResumeFeedback → GenerateLetter, GenerateMsg); fire-and-forget execution; results and process status streamed to client via SSE (Server-Sent Events); custom user instructions and per-user API keys loaded from userSettings; out-of-credit (HTTP 402) detection marks processes with statusReason and ensures stream reaches terminal state even if upstream node fails; LLM factories support optional user-provided OpenRouter key with fallback to server key

## Directory Structure

```
app/
├── api/                    # Session-validated, userId-scoped routes
├── lib/
│   ├── components/         # AnalysisReport, MarkdownPanel, ym/ UI primitives
│   │   └── ym/             # Yahoo Messenger design system components
│   ├── hooks/              # useChat hook
│   ├── auth/               # better-auth configuration
│   ├── db/                 # Drizzle schema and database client
│   ├── api-handler.ts      # Error handling and session validation (handleAsync, handleAsyncAuth)
│   ├── app-store.tsx       # Global state management
│   ├── workflow.ts         # LangGraph workflow definition with custom prompt loading and out-of-credit handling
│   ├── system-prompt.ts    # Centralized LLM prompts with custom instruction support
│   ├── openrouter.ts       # LLM factories (createReasoningLlm, createWritingLlm) and HTTP 402 detection
│   └── crypto.ts           # Encryption/decryption (AES-256-GCM) for storing user API keys
├── resumes/                # [id]/ job analysis hub
├── settings/               # User settings: password change, custom AI prompts, OpenRouter API key
├── page.tsx                # Login page (with resend email controls + 30s cooldown)
└── layout.tsx              # Root layout
```

See full tree and entry points in [Pages & Routing](agent-docs/pages-routing.md).

## Module Documentation

- [UI Components & Design System](agent-docs/ui-components.md) — Primitives, color system, theming
- [State Management](agent-docs/state-management.md) — AppStore context, CRUD operations, lazy job loading
- [Pages & Routing](agent-docs/pages-routing.md) — Route structure, data flow, entry points
- [Styling & Theming](agent-docs/styling-theming.md) — Color palette, CSS organization, tokens
- [Database & Backend](agent-docs/database-backend.md) — Schema, migrations, API routes, session validation
- [LangGraph Workflow & Agents](agent-docs/workflow-agents.md) — Node definitions, LLM prompts, Tavily, process tracking
- [Conventions & Patterns](agent-docs/conventions.md) — Naming, code org, React patterns, authentication
- [Gotchas & Troubleshooting](agent-docs/gotchas.md) — Known issues, debugging, environment setup

## Development

**Setup:**
```bash
pnpm install
cp .env.example .env.local
# Fill in: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, BETTER_AUTH_SECRET (used for sessions AND encrypted API key storage), ORIGIN, OPENROUTER_API_KEY, TAVILY_API_KEY
# Optional: EMAIL_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (leave EMAIL_ENABLED=false for local dev without email)
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

See [Conventions & Patterns](agent-docs/conventions.md) for naming, code org, and authentication patterns.
