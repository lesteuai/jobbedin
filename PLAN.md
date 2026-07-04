# Plan: Email validation, forgot password, and account deletion

## Context
- Auth is better-auth 1.6.11 (`app/lib/auth/index.ts`), client in `app/lib/auth/client.ts`.
- `verification` table already exists in `app/lib/db/schema.ts` (required by better-auth flows).
- Login UI is a single client component `app/page.tsx` with `signin` / `signup` modes; `forgot` mode is stubbed out in comments.
- A single env flag will gate all outbound email so local runs never need SMTP.

## Design decisions
- **Email flag:** `EMAIL_ENABLED` (default off). When off: no verification/reset/delete emails are sent, `requireEmailVerification` is disabled, and account deletion happens immediately after credential check. When on: SMTP is used and email verification / delete confirmation links are sent.
- **Delete account:** better-auth `deleteUser` needs an active session. Flow: sign in with email+password, then call `authClient.deleteUser({ password })`. With `EMAIL_ENABLED` off, deletion is immediate; with it on, better-auth sends a confirmation link (`sendDeleteAccountVerification`).

## Tasks
- [x] T1 (status: done, deps: none) — Add `nodemailer` (+ `@types/nodemailer`) and a mailer helper `sendEmail()` gated by `EMAIL_ENABLED`; add SMTP + flag vars to `.env.example` — files: package.json, app/lib/email.ts, .env.example
- [x] T2 (status: done, deps: T1) — Wire better-auth config: `emailVerification.sendVerificationEmail` + `requireEmailVerification`/`sendOnSignUp` gated by flag, `emailAndPassword.sendResetPassword`, `user.deleteUser` with `sendDeleteAccountVerification` — all no-ops when flag off — files: app/lib/auth/index.ts
- [x] T3 (status: done, deps: T2) — Add `forgot` mode to login screen (request reset via `authClient.requestPasswordReset`) and a `/reset-password` page that consumes the token via `authClient.resetPassword` — files: app/page.tsx, app/reset-password/page.tsx
- [x] T4 (status: done, deps: T3) — Add "Delete Account" mode below Sign Up on the login screen: sign in with email+password then `authClient.deleteUser({ password })`, with confirmation prompt — files: app/page.tsx

## Notes
- T3 and T4 both edit `app/page.tsx`, so they run sequentially (T4 after T3).
- Export `requestPasswordReset`, `resetPassword`, `deleteUser` from `app/lib/auth/client.ts` as needed.

## Code Review
_(appended in Phase 3)_
