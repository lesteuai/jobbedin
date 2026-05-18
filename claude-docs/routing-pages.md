# Routing & Pages

## Purpose

Defines the multi-step user journey from login → resume management → job exploration → analysis → AI-assisted content generation. Uses TanStack Router for file-based routing with type-safe route definitions and automatic code splitting.

## Location

- `src/routes/__root.tsx` — Root layout and error boundaries
- `src/routes/index.tsx` — `/` Login page
- `src/routes/resumes.tsx` — `/resumes` Resume management
- `src/routes/jobs.tsx` — `/jobs` Job management and analysis
- `src/router.tsx` — Router initialization and setup
- `src/routeTree.gen.ts` — Auto-generated route tree (do not edit)

## Entry Points

1. **Router setup** (`src/router.tsx`): Initializes TanStack Router with QueryClient context and scroll restoration
2. **Root layout** (`src/routes/__root.tsx`): Wraps all routes with QueryClientProvider and AppStoreProvider; defines error/notfound boundaries
3. **Login** (`src/routes/index.tsx`): Entry point after app mount; navigates to `/resumes` on submit
4. **Resumes** (`src/routes/resumes.tsx`): Main list view; can navigate to `/jobs`
5. **Jobs** (`src/routes/jobs.tsx`): Most complex route; handles job list, detail view, analysis tabs, and chat generation

## Architecture / Key Components

**Router Context**
- Created in `src/router.tsx` with `createRouter()` passing `routeTree`, `context: { queryClient }`, scroll restoration enabled
- Context made available to all routes via `Route.useRouteContext()`

**Root Route** (`src/routes/__root.tsx`)
- `createRootRouteWithContext<{ queryClient: QueryClient }>()`
- Renders `RootComponent` which wraps `<Outlet />` with:
  - `QueryClientProvider` — enables react-query hooks
  - `AppStoreProvider` — provides resume/job store context
- Defines custom `NotFoundComponent` (404 page) and `ErrorComponent` (error boundary)
- Both are styled as Yahoo Messenger windows

**Login Route** (`src/routes/index.tsx`)
- `createFileRoute("/")()`
- Three modes: "signin", "signup", "forgot"
- On submit: navigates to `/resumes` without actual authentication
- Styled as a fixed-width popup window (360px)

**Resumes Route** (`src/routes/resumes.tsx`)
- `createFileRoute("/resumes")()`
- Renders `AppFrame` (full-window container)
- Left sidebar: list of resumes with add/delete buttons
- Right main pane: resume detail (Markdown preview) or empty state
- Bottom button: "To Job →" navigates to `/jobs`
- Delete confirmation modal reuses `YmModal`

**Jobs Route** (`src/routes/jobs.tsx`)
- `createFileRoute("/jobs")()`
- Most complex route; handles multiple views: list, detail, analysis report, chat generation
- Local state for view mode (`idle | view | add | report`), tab selection, chat history
- Four analysis tabs: Company, JDMatch, Feedback, Generate
- Generate tab hosts a mock chat interface with mode toggle (Cover Letter / Message)
- Back button in sidebar: "← Back to Resumes" navigates to `/resumes`

## Data Flow

```
/
  ↓ (on submit)
/resumes
  ↓ (click "To Job →")
/jobs
  ↓ (select job)
/jobs (with selectedJobId set)
  ↓ (click "Analyze →")
/jobs (with view="report")
  ↓ (click "Generate" tab)
/jobs (with tab="Generate", allowing chat)
```

**Route Context Flow**
```
Router (with QueryClient)
  ↓
RootComponent
  ↓
QueryClientProvider + AppStoreProvider
  ↓
Outlet (renders active route)
```

**Navigation Patterns**

- **useNavigate hook** used in all route components for imperative navigation
- **Link component** in error boundaries (404, error pages)
- No URL parameters or query strings currently used (all state managed in React Context)
- Scroll restoration enabled (browser will jump to previous scroll position on back)

## Patterns & Conventions

**File-based routing**
- File name dictates route: `routes/index.tsx` → `/`, `routes/jobs.tsx` → `/jobs`
- All routes are async-safe; TanStack Router handles code splitting
- Route definitions use `createFileRoute()` and export a `Route` object

**Navigation**
- All inter-route navigation uses `useNavigate()` hook and `.navigate({ to: "..." })`
- No dynamic segments or query params yet (future work: resume ID, job ID, analysis result IDs)

**State across routes**
- Global: React Context (app-store.tsx) for resume/job lists; survives navigation
- Route-local: useState for UI mode, tab selection, form drafts; lost on navigation (acceptable for mock)
- Route context: QueryClient passed but underutilized

**Error handling**
- Route-level errors caught by ErrorComponent in root
- 404s caught by NotFoundComponent
- Both render Yahoo Messenger-styled error windows

## Gotchas & Non-Obvious Logic

- **Login doesn't actually authenticate**. Navigating directly to `/resumes` in the URL works even without logging in (no auth guard). Future work: add middleware or route protection.
- **No URL state**. Selecting a resume/job, changing tabs, switching chat modes — none of this appears in the URL. Refreshing the page or using the browser back button will lose UI state. Example: user on jobs detail view, refreshes page, app returns to jobs list (not detail).
- **App state persists across navigation**. Resumes and jobs added/deleted persist when navigating away and back, but chat messages and form drafts (in `/jobs`) are lost.
- **Modal state not URL-encoded**. Delete confirmation modal (`pendingDelete` state) can be triggered then user navigates away; modal silently closes.
- **Back buttons are custom, not browser back**. "← Back to Resumes" and "← Back to Job" are manual navigation buttons, not browser back-button handlers. This means the browser back button may skip multiple screens.

## Open Questions

- Should route selection (selectedResumeId, selectedJobId) be URL-encoded for bookmarkability and back-button support?
- Should form drafts be persisted to localStorage to survive page refresh?
- Should auth be enforced before allowing access to `/resumes`?
- Once backend is integrated, should analysis results be fetched on `/jobs` load, or lazy-loaded when the user clicks "Analyze"?
