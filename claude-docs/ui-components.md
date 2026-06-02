# UI Components & Design System

## Yahoo Messenger Design System

JobbedIn uses an intentionally retro 2000s Windows XP aesthetic. This is a deliberate design choice, not a limitation. All components follow the `ym-` class naming convention.

All primitives are located in `app/components/ym/`.

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

**Props from useChat hook:**
- `mode` — "letter" or "message"
- `chats` — array of { role, text } message objects
- `chatDraft` — current input text
- `isAiTyping` — shows typing indicator
- `typingDots` — animated dots (`.`, `..`, `...`)
- `handleSend()` — sends message
- `handleClear()` — clears conversation
- `chatContainerRef` — auto-scroll container

**UI elements:**
- Mode switcher (Cover Letter / Message)
- Scrollable message list with typing indicator
- Textarea input (Enter to send, Shift+Enter for newline)
- Send and Clear buttons

### Sidebar.tsx
Reusable sidebar for list management (resumes, jobs, etc.).

### YmModal.tsx
Confirmation dialog for destructive actions (delete, sign-out).

### MarkdownPanel.tsx
Renders markdown content with proper styling for analysis display.

## Color System

Uses OKLch color space for precise control. CSS variables defined in `:root`.

**Color palette:**
- Primary: `var(--color-primary)`
- Background: `var(--color-bg)`
- Text: `var(--color-text)`
- Borders: `var(--color-border)`
- Accent colors for hover, active, error states

All colors are defined in `app/globals.css`.

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

Page-level composite components (e.g., `AnalysisReport.tsx`) live in `app/components/`.
UI primitives live in `app/components/ym/`.

This separation keeps low-level primitives focused and page-level composition concerns isolated.
