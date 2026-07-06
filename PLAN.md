# Plan: Detect OpenRouter out-of-credit + Bring Your Own Key (BYOK)

## Context

Two features from `task.txt`:

1. **Detect OpenRouter out-of-credit lockup.** OpenRouter signals insufficient credit
   with an `APIError` whose status/code is `402` (shape confirmed in `scripts/test-llm.ts`:
   `error?.constructor?.name === 'APIError'`, `error.code === 402`). LLM calls happen in
   two places: the async LangGraph workflow (`app/lib/workflow.ts`) and the synchronous
   chat refinement route (`app/api/jobs/[id]/chat/route.ts`). Both must recognize this
   condition and surface a clear "out of credit" message instead of a generic failure.

2. **Bring Your Own Key.** Let a user store their own OpenRouter API key in Settings so
   they use their own credit. The key is encrypted with `BETTER_AUTH_SECRET` before being
   written to `user_settings`, and decrypted with the same secret before each LLM call.
   When a user key is present it overrides `process.env.OPENROUTER_API_KEY`.

**Constraint:** generate the Drizzle migration only. Do NOT run `pnpm db:push`.

## Design notes

- New `app/lib/crypto.ts`: `encrypt(plaintext)` / `decrypt(payload)` using AES-256-GCM with
  a 32-byte key derived from `BETTER_AUTH_SECRET` (sha256). Output format `iv:authTag:ciphertext`.
- New `app/lib/openrouter.ts`: `isOutOfCreditError(error): boolean` (APIError + 402), plus
  factory functions `createReasoningLlm(apiKey?)` / `createWritingLlm(apiKey?)` that build a
  `ChatOpenAI` from the given key, falling back to `process.env.OPENROUTER_API_KEY`. Module-level
  singleton LLMs are replaced by these factories so a per-user key can be injected.
- Schema: add `openrouterApiKey` (encrypted) to `user_settings`; add `statusReason` to `processes`
  so the async workflow can persist WHY a node failed (e.g. `out_of_credit`) for the SSE stream/UI.
- Settings API never returns the raw key; GET returns `hasOpenrouterApiKey: boolean`. PUT accepts
  the key (encrypt + store) and supports clearing it.
- UI surfacing: the analysis SSE payload carries `statusReason`; ChatPanel shows an out-of-credit
  message pointing to Settings. Chat route returns a 402 with a specific message that `use-chat`
  displays verbatim.

## Tasks

### Wave 1 (independent)
- [x] T1 (status: done, deps: none) — Add `crypto.ts` encrypt/decrypt helpers keyed off `BETTER_AUTH_SECRET` (AES-256-GCM) — files: `app/lib/crypto.ts`
- [x] T2 (status: done, deps: none) — Add `openrouter.ts` with `isOutOfCreditError` and `createReasoningLlm` / `createWritingLlm` factories — files: `app/lib/openrouter.ts`
- [x] T3 (status: done, deps: none) — Schema: add `openrouterApiKey` to `user_settings` and `statusReason` to `processes`; run `pnpm db:generate` only (no push) — files: `app/lib/db/schema.ts`, `drizzle/`

### Wave 2 (depend on Wave 1)
- [ ] T4 (status: todo, deps: T1,T3) — Settings API: GET returns `hasOpenrouterApiKey`; PUT encrypts/stores key and supports clearing; keep instruction fields working — files: `app/api/settings/route.ts`
- [ ] T6 (status: todo, deps: T1,T2,T3) — workflow.ts: load+decrypt user key, build LLMs via factories, detect out-of-credit in node catch blocks and persist `statusReason` — files: `app/lib/workflow.ts`
- [ ] T7 (status: todo, deps: T1,T2,T3) — chat route: load+decrypt user key, build writing LLM via factory, catch out-of-credit and return a specific 402 error message — files: `app/api/jobs/[id]/chat/route.ts`

### Wave 3 (depend on Wave 2)
- [ ] T5 (status: todo, deps: T4) — Settings UI: BYOK section (saved-state indicator, save key, clear key) — files: `app/settings/page.tsx`
- [ ] T8 (status: todo, deps: T3,T6,T7) — Surface out-of-credit: include `statusReason` in analysis-stream payload; ChatPanel + use-chat show the out-of-credit/Settings message — files: `app/api/jobs/[id]/analysis-stream/route.ts`, `app/lib/components/ym/ChatPanel.tsx`, `app/resumes/[id]/page.tsx`, `app/lib/hooks/use-chat.ts`

## Code Review
_(appended in Phase 3)_
