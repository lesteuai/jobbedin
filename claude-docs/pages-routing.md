# Pages & Routing

## Purpose

JobbedIn uses Next.js App Router to organize three main user-facing pages: login (signin/signup), resumes management, and jobs analysis. Pages coordinate state via the AppStore context and manage local view state (modals, tabs, form inputs).

## Location

- `app/page.tsx` — Login page (root route `/`)
- `app/resumes/page.tsx` — Resume manager (`/resumes`)
- `app/jobs/page.tsx` — Job analyzer (`/jobs`)
- `app/layout.tsx` — Root layout (metadata, AppStoreProvider)

## Entry Points

**Route structure:**
- `/` — Login page (signin/signup/forgot password)
- `/resumes` — Resume management
- `/jobs` — Job analysis and generation

Each page is a client component (`'use client'`) with its own state machine and internal view transitions.

## Architecture / Key Components

### app/page.tsx (Login)

**Purpose:** Authentication UI (mock, redirects to /resumes on submit)

**Local state:**
- `mode: 'signin' | 'signup' | 'forgot'` — Switches between form modes
- `email: string` — Email input
- `password: string` — Password input

**Interaction:**
- User selects mode via buttons (Sign In, Sign Up, Forgot Password, Back)
- Form shows/hides password field based on mode
- Submit redirects to `/resumes` via `useRouter().push()`

**UI components:**
- Hand-rolled form (no reusable input component)
- Yahoo Messenger window styling (inline styles + `ym-` classes)
- Mode-specific titles and button labels via Record<Mode, string>

**Navigation:**
```
signin (default)
├─ signup (via "Sign Up" button)
│  └─ signin (via "Back to Sign In")
├─ forgot (via "Forgot Password" button)
│  └─ signin (via "Back to Sign In")
```

### app/resumes/page.tsx (Resume Manager)

**Purpose:** List, preview, and manage resumes; navigate to jobs

**Local state:**
- `pendingDelete: string | null` — ID of resume pending deletion confirmation

**Context state:**
- `resumes, selectedResumeId, selectResume, addResume, deleteResume` from useAppStore()

**View flow:**
1. **No selection** → Empty state (emoji + instructions to add or select)
2. **With selection** → Markdown preview of selected resume + button to navigate to jobs

**Interaction:**
- Click "Add resume" → calls addResume() → selects new resume automatically
- Click resume in sidebar → calls selectResume(id)
- Click × (delete) → sets pendingDelete(id) → shows confirmation modal
- Modal OK → deleteResume(id) → clears pendingDelete
- Click "To Job →" → navigates to `/jobs`

**Components used:**
- AppFrame (titlebar + sign-out)
- Sidebar (resume list with add/delete)
- MarkdownPanel (resume content preview)
- YmButton (navigation button)
- YmModal (delete confirmation)

### app/jobs/page.tsx (Job Analyzer)

**Purpose:** Add jobs, analyze against resume, generate cover letters and messages via chat

**Local state (complex):**
- `pendingDelete: string | null` — ID of job pending deletion
- `view: 'idle' | 'view' | 'add' | 'report'` — Current UI view mode
  - `idle` — No job selected, sidebar visible
  - `view` — Job description shown, "Analyze" button visible
  - `add` — Job input form (textarea for pasting JD)
  - `report` — Analysis view with tabs and chat
- `draft: string` — Job description textarea input
- `tab: 'Company' | 'JDMatch' | 'Feedback' | 'Generate'` — Current analysis tab
- `mode: 'letter' | 'message'` — Chat mode (cover letter or recruiter message)
- `chats: Record<Mode, ChatLine[]>` — Chat history per mode
  - Seeded with SEED data (default messages)
  - Updated on send
- `chatDraft: string` — Current chat input

**Context state:**
- `jobs, selectedJobId, selectJob, addJob, deleteJob` from useAppStore()

**View state machine:**

```
idle (default)
├─ add (via "Add Job" button)
│  └─ idle (Cancel) or report (OK with content)
├─ view (via select job)
│  ├─ report (Analyze button)
│  └─ idle (different job)
└─ report (via select job + Analyze, or from add)
   ├─ back to view (Back to Job button)
   └─ idle (select different job)
```

**Interaction patterns:**

**Adding a job:**
1. Click "+ Add Job"
2. Set view='add', selectedJobId=null, draft=''
3. User pastes job description into textarea
4. Click OK
5. Call addJob(draft) → get new id
6. Call selectJob(id), set view='report'
7. Navigate to first analysis tab (Company)

**Analyzing a job:**
1. Select job from sidebar (calls handleSelect)
2. Set view='view', shows job description
3. Click "Analyze →"
4. Set view='report', tab='Company'
5. Show tabs: Company, JDMatch, Feedback, Generate
6. Tabs 1–3 render mock markdown from MOCK object
7. Tab 4 (Generate) shows chat interface

**Generating cover letter/message:**
1. In report view, tab=Generate
2. User selects mode (letter or message)
3. Chat shows seeded prompt and AI response
4. User types in textarea, presses Ctrl+Enter or clicks Send
5. handleSend() adds user message and mock AI response to chats[mode]
6. Clear button resets chats[mode] to []

**Components used:**
- AppFrame
- Sidebar (job list, with back-to-resumes header button)
- YmButton (for tabs, mode toggle, navigation, send/clear)
- MarkdownPanel (mock analysis tabs, job description)
- YmModal (delete confirmation)
- Custom chat UI (textarea, chat history with role colors)

**Keyboard shortcuts:**
- Ctrl+Enter or Cmd+Enter sends chat message

## Data Flow

**Across pages:**

```
AppStoreProvider (app/layout.tsx)
├── Resumes page (/resumes)
│   ├── Read: resumes[], selectedResumeId
│   ├── Write: selectResume, addResume, deleteResume
│   └── Button: push(/jobs)
└── Jobs page (/jobs)
    ├── Read: jobs[], selectedJobId
    ├── Write: selectJob, addJob, deleteJob
    └── Button: push(/resumes)
```

**Within resumes page:**

```
User action
├─ click item → selectResume(id) → context update
├─ local state: pendingDelete
└─ click OK on modal → deleteResume(id) → context update
```

**Within jobs page (complex):**

```
User action
├─ click "Add Job" → view='add', selectedJobId=null, draft=''
│  └─ paste JD, click OK → addJob(draft) → selectJob(id) → view='report'
├─ click job in sidebar → view='view', selectJob(id)
│  └─ click "Analyze" → view='report', tab='Company'
├─ in report, click tab → tab=<selected>
│  └─ generate tab: click mode button → mode='letter'|'message'
├─ in generate: type, send → chatDraft → handleSend()
│  └─ chats[mode].push(user, ai) → chatDraft=''
└─ click clear → chats[mode]=[]
```

## Dependencies

**Internal:**
- `app/layout.tsx` → AppStoreProvider
- `lib/app-store.tsx` → useAppStore()
- `components/ym/*` → UI primitives
- `app/globals.css` → Styling

**External:**
- `next/navigation` → useRouter for programmatic navigation
- React hooks: useState, useRouter

## Consumers

- App entry point: users navigate these three routes
- Links: login → resumes, resumes → jobs, jobs → resumes

## Patterns & Conventions

**View state machine:**
Both resumes and jobs use a discriminated union type for views:
```tsx
type View = 'idle' | 'view' | 'add' | 'report';
```
This ensures clear, predictable state transitions. Each view renders different UI.

**Record types for mode-dependent data:**
```tsx
type Mode = 'letter' | 'message';
const SEED: Record<Mode, ChatLine[]> = { letter: [...], message: [...] };
const chats: Record<Mode, ChatLine[]> = { letter: [], message: [] };
```
This pattern keeps mode-dependent state parallel and easy to access.

**Controlled inputs:**
All form inputs are controlled (e.g., `value={email}`, `onChange={(e) => setEmail(e.target.value)}`).

**Event handler naming:**
Event handlers use `handle` prefix (e.g., `handleSubmit`, `handleSelect`, `handleSend`, `handleClear`).

**Modal deletion pattern:**
Delete is two-step: click × button → sets pendingDelete → shows modal → click OK → calls deleteItem. This is safer than immediate deletion.

**Seeded mock data:**
SEED, MOCK, and PLACEHOLDER objects define all static content. Single source of truth for each view.

## Gotchas & Non-Obvious Logic

**View state is independent across pages:**
Resumes page has no concept of jobs view state, and vice versa. Navigating between pages loses local state (pendingDelete, chat history, etc.). This is acceptable because each page is independent.

**Chat history is per-mode but shared across jobs:**
When you switch jobs (in report view), the chat history persists for the same mode. This might be surprising; it could be worth clearing chats when switching jobs. Currently, it's a feature (compare drafts across jobs) but could be a gotcha.

**Modal must explicitly set open={true}:**
YmModal only renders if `open={true}`. Pages control this via state (e.g., `pendingDelete !== null`). If modal doesn't show, check the open condition.

**Job description parsing is mock:**
The `.pdf` and `.docx` note in the resumes preview ("Supports .pdf and .docx — mock") indicates that file parsing is not implemented. Jobs page accepts only text. Both are placeholders.

**Navigation doesn't preserve state:**
Clicking "To Job →" from resumes or "← Back to Resumes" from jobs uses `router.push()`, which unmounts and remounts the page. Local state (view, draft, chat) is lost. This is intentional (fresh start) but could be confusing if users expect state persistence.

**Tab rendering is conditional but not memoized:**
The report view checks `if (tab !== 'Generate')` to decide between mock markdown and custom chat UI. This is re-evaluated on every render. For performance, this could be extracted to a sub-component, but current performance is fine.

**Keyboard shortcut for chat send:**
The Enter key is captured with `onKeyDown`. Cmd+Enter (Mac) and Ctrl+Enter (Windows/Linux) both send. Plain Enter does not; this allows multiline input.

## Open Questions

- Should chat history persist across job selections or reset?
- Should the app route to /jobs?selectedJobId=j123 to support deep linking?
- Should deleted resumes/jobs trigger a return to idle view?
- Should the login page validate email/password before redirecting?
