# Plan: Chat UX improvements and context-enriched AI responses

## Overview
Two improvements: (1) show the user's message immediately on send with an animated typing indicator while waiting for AI, and (2) enrich the chat API with JD match, company, resume, and job description context so the AI has full context when refining letters/messages.

## Tasks

### Task 1: Optimistic user message display with AI typing animation
**Status**: completed
**Goal**: When the user sends a chat message, immediately display it in the chat and show an animated typing indicator (cycling dots) until the AI response arrives, then replace the indicator with the AI reply.
**Depends on**: none
**Details**:
- File: `app/resumes/[id]/page.tsx` (note: jobs page was recently moved here from `app/jobs/page.tsx` per CLAUDE.md; confirm by checking which file has the chat interface)
- Also check `app/jobs/page.tsx` in case the chat UI is still there
- Current behavior: `handleSend()` waits for the full API round-trip before updating chat state; nothing is shown until the response arrives
- New behavior:
  1. On send, immediately push `{ role: 'user', text: userMessage }` into `chats[mode]` state
  2. Set a new `isAiTyping` boolean state to `true`
  3. Render a typing indicator line when `isAiTyping` is true: label "JobbedIn-AI:" followed by animated dots cycling through `.` -> `..` -> `...` using a CSS animation or `useEffect`/`setInterval` cycling local state
  4. When API response arrives, set `isAiTyping` to `false` and push `{ role: 'ai', text: aiReply }` into `chats[mode]`
  5. On error, set `isAiTyping` to `false` and remove the optimistic user message (or keep it and restore `chatDraft`)
- The typing dots animation: use a `useEffect` with `setInterval` cycling a local `typingDots` state through `'.'`, `'..'`, `'...'` every 400ms while `isAiTyping` is true; clean up interval when `isAiTyping` becomes false
- The indicator should render as a chat line styled like an AI bubble: `JobbedIn-AI: ..` etc.
- Keep `isSendingChat` for disabling the Send button; `isAiTyping` is separate for the visual indicator
- Scroll chat container to bottom when new lines are added (add a `useRef` on the chat container and `scrollTop = scrollHeight` after state updates)

### Task 2: Enrich chat API with JD match, company, resume, and job description context
**Status**: pending
**Goal**: When the chat API generates an AI reply, include company research, JD match analysis, resume content, and job description as context in the LLM prompt -- the same way `workflow.ts` bundles them for letter/message generation.
**Depends on**: none
**Details**:
- File: `app/api/jobs/[id]/chat/route.ts`
- Current behavior: the POST handler calls the LLM with only the system prompt + conversation history + new user message; no job/resume/company context
- New behavior in the `userMessage` path:
  1. After fetching `job` (the `resumeJob` row), also fetch in parallel:
     - Company research: `db.select().from(company).where(eq(company.jobId, jobId))` -> `rows[0]?.content`
     - JD match: `db.select().from(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId))` -> `rows[0]?.content`
     - Resume: join through `resumeJob.resumeId` -> `db.select().from(resume).where(eq(resume.id, job[0].resumeId))` -> `rows[0]?.content`
  2. Build a context string (use only fields that exist/are non-null):
     ```
     JD Match info: {jdMatchContent}
     Company info: {companyContent}
     Resume: {resumeContent}
     Job Description: {job[0].content}
     ```
  3. Append this context block to the existing system prompt (`letter_chat_prompt` or `message_chat_prompt`) so the full system message passed to the LLM is: `{modeSystemPrompt}\n\n{contextString}`
  4. Import `resume` table from schema (already imported: `resumeJob`; add `resume` import)
  5. If any context field is null/missing, omit that line from the context string (graceful degradation)
  6. Do not change the GET handler or the legacy `conversation` clear path
