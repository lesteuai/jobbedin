## JobbedIn — Frontend Plan

A no-logic, click-through frontend styled like **Yahoo! Messenger circa 2002–2005**: glossy purple/blue gradient title bars, beveled 3D buttons, Tahoma/MS Sans Serif fonts, chunky window borders, smiley-era iconography, dotted focus rings, sunken inset panels. All state is local React state (good for later Next.js migration — no router-specific logic in components).

### Routes (TanStack Start file-based routing)

```
src/routes/
  __root.tsx        → app shell: Yahoo-style chrome (title bar, menu strip)
  index.tsx         → /            Resumes screen (Screens 1–3)
  jobs.tsx          → /jobs        Jobs screen (Screens 4–6)
  analysis.tsx      → /analysis    Tabbed report (Screens 7–9)
  generate.tsx      → /generate    Cover Letter / Message chat (Screens 10–11)
```

Each route reuses a shared `<AppFrame>` providing the Yahoo Messenger window chrome + left sidebar nav (Resumes / Jobs / Analysis / Generate) so the user can jump between flows without backend.

### Screen-by-screen behavior

- **Screen 1 — Resumes list** (`/`): Sidebar with "Add resume" button and list of mock resumes (Resume 1, Resume 2). Each row has a red "x" delete icon. Clicking a row selects it and shows mock resume details in the main panel.
- **Screen 2 — Delete confirm modal**: Clicking "x" opens a Yahoo-style modal ("Are you sure you want to delete Resume 1?" + OK / Cancel). OK removes from local list, Cancel closes.
- **Screen 3 — Resume detail**: Main panel shows hardcoded resume markdown preview + a beveled **"To Job →"** button that navigates to `/jobs`.
- **Screen 4 — Jobs list** (`/jobs`): Same sidebar pattern with "Add Job", Job 1, Job 2.
- **Screen 5 — Delete job modal**: Same modal pattern as Screen 2.
- **Screen 6 — Add Job**: Clicking "Add Job" reveals a textarea in the main panel. OK appends a new "Job N" to the sidebar and switches to Screen 7. Cancel or clicking another job clears the textarea.
- **Screen 7/8/9 — Analysis** (`/analysis`): Top tab strip **Company | JDMatch | Feedback | Generate**. Each tab renders a Markdown component (`react-markdown`) with hardcoded mock content. "Generate" tab navigates to `/generate`.
- **Screen 10/11 — Generate chat** (`/generate`): Same tab strip. Main area shows a fake chat transcript (User / AI bubbles), with a textarea at the bottom. Toggle button labeled **"M / in"** near Clear swaps between Cover Letter mode and Message mode — each mode has its own mock transcript and placeholder text ("Tell me how you want your letter to be like…" vs "…your message to look like…"). Clear button near Send in order to clear content from both the chat transcript and the chat textarea. Placeholder is rendered blurry (CSS blur) and disappears on input. Send button is disabled when textarea is empty. Clear button is disabled when chat transcript is empty.

### State strategy

All state is component-local (`useState`) plus a tiny shared store via React context for the resume/job lists so deletions persist across route changes within the session. No backend, no persistence, no auth. This keeps the migration to Next.js trivial — just swap router imports.

### Yahoo Messenger styling system

Tokens defined in `src/styles.css` using oklch:

- `--ym-titlebar-from / --ym-titlebar-to`: purple→blue gradient
- `--ym-window-bg`: light beige/silver (#ECE9D8-ish)
- `--ym-bevel-light / --ym-bevel-dark`: for 3D button bevels
- `--ym-inset-bg`: sunken white panels (chat, lists)
- Font stack: `Tahoma, "MS Sans Serif", Geneva, sans-serif`

Reusable components in `src/components/ym/`:

- `YmWindow` — titlebar + min/max/close (decorative) + body
- `YmButton` — beveled 3D button with active "pressed" state
- `YmListItem` — sunken row with red "x"
- `YmModal` — classic dialog with OK/Cancel
- `YmTabs` — folder-tab style for analysis screens
- `YmChatBubble` — speech bubbles for User/AI

### Migration to Next.js

- All components are pure presentational React (no TanStack-specific hooks inside them)
- Only route files import `@tanstack/react-router`; swapping `Link`/`useNavigate` for `next/link`/`next/navigation` is a one-line change per route
- Styles live in plain CSS (Tailwind v4 tokens) — fully portable

### Dependencies to add

- `react-markdown` (for Screens 7–9 markdown rendering)

### Out of scope (explicit)

- File parsing, agent calls, AI generation, persistence, auth
- Real PDF/DOCX upload — Add buttons just push a mock item to the list