# Plan: Resend email controls on the login page

## Context / Feasibility

All auth screens live in a single file: `app/page.tsx` (mode-based: `signin | signup | forgot | delete`).
The auth client (`app/lib/auth/client.ts`) already exposes everything needed. Server handlers in
`app/lib/auth/index.ts` are already wired. `sendEmail` is a no-op when `EMAIL_ENABLED` is false
(`app/lib/email.ts:45`), so every resend control is gated by `EMAIL_ENABLED`.

- **Signup verify** — feasible. `authClient.sendVerificationEmail({ email, callbackURL: '/' })`.
  Email is retained in state after signup (mode change clears password only).
- **Forgot** — feasible. Re-call `authClient.requestPasswordReset(...)`. No dedicated resend endpoint exists; resend == re-submit.
- **Delete** — feasible only when `EMAIL_ENABLED`. Re-call `authClient.deleteUser({ password })`.
  The transient sign-in session persists after the first call (account not deleted until confirmed), so no re-sign-in. email+password stay in state in delete mode.

## Design

- Add an `emailSent` boolean state, set `true` after a successful signup / forgot-send / delete-send,
  reset to `false` in `handleModeChange`.
- Add a single `handleResend()` that resends based on current `mode`:
  - `signin` (post-signup) → `sendVerificationEmail`
  - `forgot` → `requestPasswordReset`
  - `delete` → `deleteUser`
- Render a "Resend ..." link in the footer when `EMAIL_ENABLED && emailSent`, with mode-specific label.
- Cooldown: a `cooldown` seconds state (start at 30 after every successful send, including the initial
  signup/forgot/delete send and each resend), decremented by a `useEffect` interval. The resend link is
  disabled while `loading || cooldown > 0` and shows "Resend in Ns" during the countdown.

## Tasks
- [x] T1 (status: done, deps: none) — Add `emailSent` state + `cooldown` timer + `handleResend()` + resend links for signup-verify, forgot, and delete; gate all by `EMAIL_ENABLED`. — files: app/page.tsx

## Code Review
_(appended in Phase 3)_
