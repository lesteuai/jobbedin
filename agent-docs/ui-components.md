# UI Components & Design System

## Yahoo Messenger Design System

JobbedIn uses an intentionally retro 2000s Windows XP aesthetic. This is a deliberate design choice, not a limitation. All components follow the `ym-` class naming convention.

All primitives are located in `app/lib/components/ym/`.

## Core Primitives

### AppFrame.tsx
Main app shell with titlebar. Contains sign-out button that calls `authClient.signOut()`.

```typescript
<AppFrame title="JobbedIn">
  {/* children */}
</AppFrame>
```

### YmButton.tsx
Styled button with default and primary variants.

```typescript
<YmButton variant="primary" onClick={handleClick}>
  Click me
</YmButton>
```

### ChatPanel.tsx
Chat UI component for cover letter/message refinement.

**Props:**
- `mode` — "letter" or "message"
- `setMode(mode)` — switch between letter and message modes
- `lines` — array of { role: 'user' | 'ai', text } message objects
- `chatDraft` — current input text
- `setChatDraft(text)` — update input
- `isAiTyping` — shows typing indicator
- `typingDots` — animated dots (`.`, `..`, `...`)
- `canSend`, `canClear` — enable/disable buttons
- `handleSend()` — sends message to LLM
- `handleClear()` — clears conversation
- `chatContainerRef` — auto-scroll container
- `getProcessStatus(type)` — query process status (returns pending|processing|done|failed|null)

**UI elements:**
- Mode switcher (Cover Letter / Message)
- Process status display (shows "Generating your..." when pending/processing; "Generation failed" if failed)
- Scrollable message list with markdown rendering (ReactMarkdown with gfm + math plugins)
- User and AI messages prefixed with "You:" and "JobbedIn-AI:"
- Textarea input (Enter to send; Shift+Enter for newline)
- Send and Clear buttons

**Markdown rendering:**
- Messages rendered with ReactMarkdown using remark-gfm (GitHub Flavored Markdown) and remark-math plugins
- Custom component: paragraph tags rendered as `<span>` for inline display in chat context
- Supports:
  - Inline code, bold, italic
  - Lists (unordered/ordered)
  - Links
  - Math expressions (via rehype-katex)

### Sidebar.tsx
Reusable sidebar for list management (resumes, jobs, etc.).

### YmModal.tsx
Confirmation dialog for destructive actions (delete, sign-out).

### MarkdownPanel.tsx
Renders markdown content for analysis display (company research, JD match, resume feedback).

**Props:**
- `children` — markdown string to render

**Features:**
- Renders full markdown with headings, lists, bold, italic, code blocks
- Custom styles:
  - H1 and H3 headings rendered in purple (`text-[#5b2b82]`) to match Yahoo Messenger theme
  - H1 is 2xl font-bold with bottom margin
  - H3 is lg font-bold with top/bottom margins
  - Paragraphs and lists have spacing (mb-4, space-y-1)
  - Unordered lists use disc bullets with left padding (pl-5)
- Supports GitHub Flavored Markdown (tables, strikethrough, etc.)
- Supports math expressions (LaTeX via rehype-katex)
- Wrapped in `ym-inset` class for Yahoo Messenger styling with flex layout and auto-scroll

### MarkdownPanel.tsx
Renders markdown content with proper styling for analysis display.

## Color System

Uses OKLch color space for precise control. CSS variables defined in `:root`.

**Yahoo Messenger color palette (from `app/globals.css`):**
- `--ym-window` — Main background color
- `--ym-panel` — Panel background
- `--ym-inset` — Inset/sunken areas
- `--ym-titlebar-from/to` — Purple gradient for title bars
- `--ym-accent` — Primary purple accent
- `--ym-accent-2` — Secondary orange accent
- `--ym-text` — Text color
- `--ym-muted` — Muted/disabled text
- `--ym-danger` — Error/danger red

All colors defined as CSS variables in `app/globals.css` for consistent reuse.

## Styling Approach

- **Inline styles** for layout (flexbox, positioning, sizing)
- **Class names** for theming and state-dependent styles (`.ym-btn`, `.ym-btn:hover`, `[data-active="true"]`)
- No CSS modules; all styles via globals.css and inline styles
- No CSS-in-JS library; Tailwind CSS v4 handles responsive design

## Design Tokens

See `app/globals.css` for:
- 300+ lines of CSS variables and primitives
- Spacing scale
- Typography scale
- Border radius tokens
- Transition/animation definitions

## Component Composition

Page-level composite components (e.g., `AnalysisReport.tsx`) live in `app/lib/components/`.
UI primitives live in `app/lib/components/ym/`.

This separation keeps low-level primitives focused and page-level composition concerns isolated.
