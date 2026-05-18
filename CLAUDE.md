# JobbedIn

An agentic AI system that researches company details to personalize cover letters and messages to hiring personnel. This frontend prototype demonstrates the application's user interaction model for resume management, job opportunity tracking, and AI-assisted content generation.

## Purpose

JobbedIn solves the problem of personalizing job application materials at scale. Rather than composing generic cover letters, the system:
1. Ingests a resume and job description (text or URL)
2. Deploys an agent to research the target company
3. Cross-references the candidate's experience against job requirements
4. Provides resume critique
5. Generates a comprehensive summary report
6. Drafts personalized cover letters and LinkedIn-style summaries

This prototype focuses on CS/tech roles and provides a click-through UI for job seekers to manage resumes, explore opportunities, and iterate on generated materials.

## Architecture Overview

**Frontend: Prototype in TanStack Start + React 19**

The current codebase is a stateless, mock-data frontend built with TanStack Start (file-based routing), React 19, and Tailwind CSS v4. It demonstrates the desired user experience without backend integration. The entire app state is managed client-side via React Context (resume/job lists) and component-local useState hooks (form drafts, selection state, UI modes).

**Data Flow (current)**

```
User Input (forms, selections)
  ↓
React State (Context + useState)
  ↓
Component Render (Markdown panels, tabs, chat UI)
  ↓
Mock Data (hardcoded analysis reports, AI responses)
```

**Future Architecture (backend + agents)**

The design is intentionally decoupled from backend systems. Once integrated:
- Frontend remains presentational
- Backend will handle agent orchestration (LangGraph), company research, AI generation
- API calls will replace mock data, persisting results to PostgreSQL
- Auth will route users to their saved resumes/jobs

## Next.js Migration

A parallel Next.js 16 (App Router) port exists at `/app/nextjs-migrate/`. This is a complete functional equivalent of the TanStack Start version, intended as the production target once the team standardizes on Next.js.

**Key Differences from TanStack Version**

| Aspect | TanStack Start | Next.js |
|---|---|---|
| **Router** | TanStack Router | Next.js App Router (file-based) |
| **Navigation** | `useNavigate()` from `@tanstack/react-router` | `useRouter()` from `next/navigation` |
| **Client Components** | Implicit (all user events) | Explicit via `'use client'` directive |
| **Build Target** | Vite + Cloudflare Workers | Next.js standalone (supports both SSR and static export) |
| **CSS Import** | `@tailwindcss/vite` plugin | `@tailwindcss/postcss` in globals.css |
| **State Management** | React Query + Context | React Context only (Query removed) |
| **Entry Point** | `main.tsx` + `router.tsx` | `app/layout.tsx` (root layout) + `app/page.tsx` |

**Directory Structure (nextjs-migrate)**

```
nextjs-migrate/
├── app/
│   ├── globals.css              Tailwind v4 + Yahoo Messenger theme (same as src/styles.css)
│   ├── layout.tsx               Root layout (metadata, AppStoreProvider)
│   ├── page.tsx                 / Login page ('use client')
│   ├── resumes/
│   │   └── page.tsx             /resumes Resume list & detail ('use client')
│   └── jobs/
│       └── page.tsx             /jobs Job list, detail, analysis, chat ('use client')
├── lib/
│   ├── app-store.tsx            React Context provider (identical to TanStack version)
│   └── utils.ts                 cn() utility (identical to TanStack version)
├── hooks/
│   └── use-mobile.tsx           useIsMobile() hook ('use client')
├── components/
│   └── ym/                      Yahoo Messenger components (5 files, all identical)
│       ├── AppFrame.tsx         Main window chrome
│       ├── Sidebar.tsx          List sidebar
│       ├── YmButton.tsx         Styled button
│       ├── YmModal.tsx          Confirmation dialog
│       └── MarkdownPanel.tsx    Markdown renderer
├── next.config.ts               Next.js config (output: 'standalone')
├── tsconfig.json                TypeScript config (ES2017, strict mode, bundler resolution)
└── package.json                 Dependencies (Next.js 16.2.6, React 19.2.4, Tailwind v4)
```

**Routing (App Router)**

- `app/page.tsx` → `/` (Login)
- `app/resumes/page.tsx` → `/resumes` (Resume list & detail)
- `app/jobs/page.tsx` → `/jobs` (Job list, detail, analysis, chat)

All route pages are Client Components (`'use client'`) because they use hooks like `useState`, `useRouter`, and `useAppStore()`.

**Client Component Pattern**

Each route file starts with `'use client';` because:
- Uses `useRouter()` from `next/navigation` for navigation
- Uses `useState()` and local hooks for UI state
- Uses `useAppStore()` from Context
- Renders interactive form inputs and event handlers

The root layout (`app/layout.tsx`) is a Server Component by default and wraps all routes with `<AppStoreProvider>`.

**Dependencies**

Dependencies are identical to TanStack version except:
- Removes: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `@vitejs/plugin-react`, `vite`, `@tailwindcss/vite`
- Adds: `next`, `@tailwindcss/postcss`
- Keeps: `react`, `react-dom`, `tailwindcss`, `react-markdown`, `clsx`, `tailwind-merge`

**CSS & Styling**

- Identical Yahoo Messenger theme CSS as TanStack version, but placed in `app/globals.css`
- Uses `@tailwindcss/postcss` v4 instead of vite plugin
- Same CSS variables, oklch color space, and `.ym-*` classes throughout

**State Management**

- React Context (`AppStoreProvider` in `lib/app-store.tsx`) is identical to TanStack version
- React Query removed (not needed for mock frontend); will be added back when connecting to real API
- All local UI state (tab selection, view mode, form drafts) still via `useState()`

## Key Entry Points

- `src/main.tsx` — Mounts React app and router
- `src/router.tsx` — Initializes TanStack Router with React Query QueryClient
- `src/routes/__root.tsx` — Root layout with QueryClientProvider, AppStoreProvider, error/notfound boundaries
- `src/routes/index.tsx` — `/` Login page (mock auth)
- `src/routes/resumes.tsx` — `/resumes` Resume list and detail view
- `src/routes/jobs.tsx` — `/jobs` Job list, job detail, analysis tabs, and chat generation interface
- `src/lib/app-store.tsx` — Context-based store for resume/job lists shared across routes

## Directory Structure

**TanStack Start Version** (current)

```
src/
├── main.tsx                    Entry point (React root)
├── router.tsx                  TanStack Router setup
├── start.ts                    Vite entrypoint (Cloudflare Workers)
├── server.ts                   Cloudflare fetch handler (error normalization)
├── styles.css                  Tailwind v4 + Yahoo Messenger theme tokens
├── routes/
│   ├── __root.tsx            Root layout (QueryClient, AppStore, error boundary)
│   ├── index.tsx             Login page
│   ├── resumes.tsx           Resume list & detail
│   └── jobs.tsx              Job list, detail, analysis, and chat generation
├── lib/
│   ├── app-store.tsx         React Context store (resumes, jobs, selection)
│   ├── utils.ts              Utility: cn() for Tailwind class merging
│   ├── error-capture.ts      Global error handler for SSR
│   └── error-page.ts         HTML error page template
├── components/
│   ├── ym/                   Yahoo Messenger-styled custom components
│   │   ├── AppFrame.tsx      Window chrome + titlebar + sign-out
│   │   ├── Sidebar.tsx       Left sidebar (list of items with add/delete)
│   │   ├── YmButton.tsx      Beveled 3D button
│   │   ├── YmModal.tsx       Confirmation dialog
│   │   └── MarkdownPanel.tsx Renders Markdown content
│└── hooks/
    └── use-mobile.tsx        Responsive breakpoint hook (unused)

vite.config.ts                 Vite config (TanStack Router plugin, Tailwind, React)
tsconfig.json                  TypeScript config (ES2022, JSX, strict mode)
package.json                   Dependencies (React 19, TanStack, Tailwind v4)
eslint.config.js              ESLint config
tailwind.config.*             Auto-generated by Tailwind v4 (no explicit config)
components.json               Shadcn config (for UI components)

docs/                          Design references and planning docs
```

**Next.js Migration Version** (parallel in `nextjs-migrate/`)

```
nextjs-migrate/
├── app/                       App Router (Next.js)
│   ├── globals.css           Yahoo Messenger theme (copied from src/styles.css)
│   ├── layout.tsx            Root layout with metadata + AppStoreProvider
│   ├── page.tsx              / Login page ('use client')
│   ├── resumes/
│   │   └── page.tsx          /resumes route ('use client')
│   └── jobs/
│       └── page.tsx          /jobs route ('use client')
├── lib/
│   ├── app-store.tsx         React Context (identical to TanStack version)
│   └── utils.ts              cn() utility (identical to TanStack version)
├── hooks/
│   └── use-mobile.tsx        useIsMobile() hook ('use client')
├── components/
│   └── ym/                   Yahoo Messenger components (5 files, identical)
│       ├── AppFrame.tsx
│       ├── Sidebar.tsx
│       ├── YmButton.tsx
│       ├── YmModal.tsx
│       └── MarkdownPanel.tsx
├── next.config.ts            Next.js config (output: 'standalone')
├── tsconfig.json             TypeScript config (bundler resolution)
├── package.json              Dependencies (Next.js 16.2.6, React 19)
└── .eslintrc.json            ESLint config
```

## Key Files

- **src/styles.css** — Entire Yahoo Messenger theme (colors, typography, beveled buttons, panels, tabs, modals) defined with CSS variables and Tailwind v4 directives
- **src/lib/app-store.tsx** — Central data store; resumes and jobs are managed here with add/delete/select actions; provides sample data on init
- **src/routes/jobs.tsx** — Most complex route; handles job viewing, analysis tabs (Company, JDMatch, Feedback, Generate), and mock AI chat for cover letter generation
- **src/routes/resumes.tsx** — Simple resume list and detail with markdown preview
- **src/routes/__root.tsx** — Error boundaries and context providers; shapes the root layout

## Dependencies & Integrations

**Framework & Routing**
- `@tanstack/react-start` — Full-stack framework (file-based routing, SSR-ready)
- `@tanstack/react-router` — File-based routing with type safety
- `@tanstack/react-query` — Server state management (not heavily used in mock frontend)
- `@tanstack/router-plugin` — Vite plugin to auto-generate route tree

**UI & Styling**
- `react` 19, `react-dom` 19 — Core React
- `tailwindcss` v4, `@tailwindcss/vite` — Utility CSS framework
- `clsx`, `tailwind-merge` — Utility for conditional Tailwind classes
- `react-markdown` — Renders markdown in analysis panels

**Build & Dev**
- `vite` 7 — Build tool and dev server
- `@vitejs/plugin-react` — React JSX support in Vite
- `@cloudflare/vite-plugin` — Cloudflare Workers support
- `typescript` 5.8 — Type checking
- `eslint`, `prettier` — Linting and formatting
- `vite-tsconfig-paths` — Resolve `@/*` alias

## Conventions

**Naming**
- Components: PascalCase. Prefixes signal intent: `Ym*` for Yahoo Messenger components, `use*` for hooks
- Files: kebab-case for directories; PascalCase for components; camelCase for utilities
- Routes: File-based routing mirrors URL structure: `routes/jobs.tsx` → `/jobs`

**Component Organization**
- Custom Yahoo Messenger components in `src/components/ym/` (AppFrame, Sidebar, YmButton, YmModal, MarkdownPanel)
- Project uses only custom `ym-*` components; no Radix UI / shadcn layer

**State Management**
- Global: React Context (app-store.tsx) for resume/job lists shared across routes
- Local: useState for UI state (selected tab, view mode, form drafts, modals)
- Route context: QueryClient passed via TanStack Router context (not heavily used)

**Styling**
- All CSS in `src/styles.css` using Tailwind v4 and custom CSS variables
- Classes applied inline via className or style attributes
- Responsive utility classes available but rarely used (fixed 200px sidebar, full-width main pane)
- Yahoo Messenger theme uses oklch() color space for better perceptual uniformity

**Code Style**
- Minimal comments; code is expected to be self-explanatory
- Hardcoded mock data (SAMPLE_RESUME, SAMPLE_JOB, MOCK analysis content) kept close to where used
- Form inputs styled with `.ym-*` classes; no shadcn/ui Button/Input usage
- Event handlers prefixed with `handle*` (e.g., handleSubmit, handleSelect)

**Async & Promises**
- No API calls yet; all interactions are synchronous state updates
- Future integration will use react-query for server state

**Error Handling**
- Route-level error boundary in __root.tsx
- 404 and error pages styled in Yahoo Messenger theme
- Server.ts normalizes catastrophic SSR errors (Cloudflare Workers context)

**Testing**
- No test suite present; frontend is mock-only
- Integration tests will be needed once backend is connected

## Gotchas & Notes

**Current Limitations**
- Entire app is mock data. No backend APIs, no persistence, no real auth. Navigating from `/` directly to `/jobs` works but assumes a "logged-in" state that never actually occurs.
- The "Add Job" flow appends to local state only; refreshing the page loses data.
- Analysis tabs (Company, JDMatch, Feedback) render hardcoded Markdown; there is no agent integration or dynamic content.
- Chat in "Generate" tab is mock: Send button appends a pre-written AI response; no real LLM or streaming.
- Resume preview supports Markdown only (hardcoded SAMPLE_RESUME); PDF/DOCX upload mentioned in UI ("Supports .pdf and .docx — mock") is not implemented.

**UI/UX Quirks**
- The login page (/) is styled as a pop-up window and doesn't actually authenticate; submit button navigates to /resumes directly.
- Sidebar delete button (red "×") uses a stop-propagation handler to avoid selecting the item when deleting.
- Chat input uses `onKeyDown` to detect Ctrl+Enter / Cmd+Enter for sending; hitting Enter alone does not send.
- Clear button in chat only clears the chat transcript, not the text input (text must be manually deleted).
- Tabs in the analysis view (Company, JDMatch, Feedback, Generate) switch content but don't change the URL; back-button won't undo tab switches.

**Design Choices**
- Yahoo Messenger theme chosen for nostalgia and density; heavily beveled 3D buttons mimic Windows XP era.
- No header/navbar in main app; all navigation is via sidebar buttons + breadcrumb "← Back" buttons.
- Resumes and jobs are stored in parallel; there's no "pair" concept yet (i.e., no saved "resume + job" applications).
- The report tabs and chat are rendered for any selected job, regardless of whether a resume is also selected; future logic will require both.

**Tech Debt**
- `src/components/ui/` was deleted; `components.json` (shadcn config) is now a dead artifact and can also be removed.
- When form validation is needed, add back `react-hook-form`, `zod`, and `@hookform/resolvers`.
- When charts are needed in reports, add back `recharts`.
- Icons are currently emoji or text; add `lucide-react` when an icon library is needed.

**Future Integration Points**
- Replace mock routes with API calls: `/api/analyze-resume`, `/api/company-research`, `/api/generate-letter`
- Connect to PostgreSQL for persistent resume/job storage
- Add real auth (sign-up, email verification, password reset)
- Integrate LangGraph agent orchestration for company research and critique
- Implement streaming responses in the chat (WebSocket or Server-Sent Events)
- Migrate from TanStack Start to Next.js (app router) as per README tech stack plan

## Development Workflow

### TanStack Start Version (src/)

**Setup**
```bash
npm install
# or pnpm install (project uses pnpm)
cd /app
```

**Development**
```bash
npm run dev
# Starts Vite dev server on http://localhost:5173
```

**Build**
```bash
npm run build
# Outputs to dist/ (Vite default)
# For Cloudflare Workers: uses @cloudflare/vite-plugin with ssr target
```

**Linting & Formatting**
```bash
npm run lint       # ESLint check
npm run format     # Prettier format
```

### Next.js Migration Version (nextjs-migrate/)

**Setup**
```bash
cd /app/nextjs-migrate
npm install
# or pnpm install
```

**Development**
```bash
npm run dev
# Starts Next.js dev server on http://localhost:3000
```

**Build**
```bash
npm run build
# Outputs to .next/ and creates standalone server output
```

**Production Start**
```bash
npm start
# Runs the built Next.js server (after `npm run build`)
```

**Linting**
```bash
npm run lint
# ESLint check (uses next/eslint-config)
```

**Project Structure & Mental Model**

Think of the app as a stateless UI prototype that mocks a complex backend system. Each route is a "screen" in a multi-step job application workflow:

1. **Screen 1–3 (Resumes)**: User selects or adds resumes; views markdown preview; navigates to jobs
2. **Screen 4–6 (Jobs)**: User selects or adds job postings; views job description
3. **Screen 7–9 (Analysis)**: System displays company research, resume match score, feedback, and preparation for generation
4. **Screen 10–11 (Generate)**: User iterates with an AI assistant to draft cover letter or outreach message

The entire UI uses a fixed two-pane layout: narrow left sidebar for lists, wide right main panel for detail. This pattern repeats across all routes, maintained by the AppFrame and Sidebar components.

## Migration Notes

The Next.js version is a complete port with identical functionality and styling. Both codebases coexist:
- **TanStack version** (`src/`) is the current active codebase (uses Vite, TanStack Router, Cloudflare target)
- **Next.js version** (`nextjs-migrate/`) is the parallel production target once standardized on Next.js (uses Next.js 16 App Router, standalone build)

Both share:
- Identical `lib/app-store.tsx` and `lib/utils.ts`
- Identical Yahoo Messenger component files (`components/ym/`)
- Identical CSS (in `src/styles.css` vs `nextjs-migrate/app/globals.css`)
- Identical mock data and UI logic

Key porting notes:
- Replace TanStack Router's `useNavigate()` with Next.js `useRouter()` from `next/navigation`
- Add `'use client';` directive to all pages and interactive components
- Root layout moves to `app/layout.tsx` (Server Component by default)
- CSS build chain changes from Vite plugin to postcss
- Remove React Query (will be re-added when integrating real backend)

## Module Detail Docs

- [Routing & Pages](claude-docs/routing-pages.md) — Route structure, file-based routing setup, navigation flow
- [App Store & State](claude-docs/app-store.md) — React Context, sample data, add/delete/select logic
- [Yahoo Messenger Components](claude-docs/ym-components.md) — Custom UI components (AppFrame, Sidebar, YmButton, YmModal, MarkdownPanel), styling, theming
- [Styles & Theming](claude-docs/styles-theming.md) — CSS variables, oklch color space, Yahoo Messenger design tokens, responsive utilities
- [Build & Config](claude-docs/build-config.md) — Vite, TanStack Router plugin, Tailwind v4, TypeScript, ESLint setup (TanStack version)
