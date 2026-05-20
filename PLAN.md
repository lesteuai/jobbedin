# Plan: better-auth integration and schema updates

## Overview
Integrate better-auth for real login/logout/signup, add userId to all existing database tables, and add `.$onUpdate(() => new Date())` to all updatedAt fields.

## Tasks

### Task 1: Schema updates
**Status**: done
**Goal**: Update schema.ts to add better-auth tables, add userId to all existing tables, and add .$onUpdate to all updatedAt fields.
**Depends on**: none
**Details**:
- Add `.$onUpdate(() => new Date())` to every `updatedAt` field in all 7 tables (resume, resumeJob, company, jobDescriptionMatch, resumeFeedback, coverLetterHistory, messageGenHistory, process).
- Add better-auth core tables to schema.ts: `user`, `session`, `account`, `verification`. These must match better-auth's Drizzle schema conventions (id, name, email, emailVerified, image, createdAt, updatedAt for user; id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId for session; id, accountId, providerId, userId, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt for account; id, identifier, value, expiresAt, createdAt, updatedAt for verification).
- Add `userId` column (uuid, not null, references user.id with onDelete cascade) to all 7 existing tables: resume, resumeJob, company, jobDescriptionMatch, resumeFeedback, coverLetterHistory, messageGenHistory, process.
- Export all tables from schema.ts for better-auth adapter use.
- Run `pnpm db:generate` to generate the migration file for the schema changes.

### Task 2: Configure better-auth
**Status**: done
**Goal**: Create auth server config, auth client, and the Next.js API handler for better-auth.
**Depends on**: Task 1
**Details**:
- Create `app/lib/auth.ts`: initialize better-auth with `betterAuth()`. Use the `drizzleAdapter` from `better-auth/adapters/drizzle` with the db instance and all schema tables. Set `emailAndPassword: { enabled: true }`. For `baseURL`, compute it as: `const origin = process.env.NODE_ENV === 'production' ? process.env.ORIGIN : (process.env.ORIGIN_DEV ?? process.env.ORIGIN);` and pass `origin` as `baseURL`. Export `auth` and its type as `Auth`.
- Create `app/lib/auth-client.ts`: create and export `authClient` using `createAuthClient()` from `better-auth/react` with the same origin logic for `baseURL`. Export `signIn`, `signUp`, `signOut`, `useSession` from it.
- Create `app/api/auth/[...all]/route.ts`: export GET and POST handlers from `auth.handler`.
- Update `.env.example` to include `BETTER_AUTH_SECRET=your-secret-here`, `ORIGIN=https://your-production-domain.com`, and `ORIGIN_DEV=http://localhost:3000`.
- The `db` import for auth.ts comes from `@/app/lib/db` and the schema tables from `@/app/lib/db/schema`.

### Task 3: Route protection middleware
**Status**: done
**Goal**: Add Next.js middleware to redirect unauthenticated users from protected routes.
**Depends on**: Task 2
**Details**:
- Create `middleware.ts` at the project root (next to `package.json`).
- Protect `/resumes` and `/jobs` paths: if no valid session cookie, redirect to `/`.
- Use `auth.api.getSession` with the incoming headers to check the session server-side.
- The matcher config should include `/resumes` and `/jobs` (and their sub-paths).

### Task 4: Update API routes for auth
**Status**: done
**Goal**: Validate auth session in all API routes and scope data to the authenticated user.
**Depends on**: Task 2
**Details**:
- In each API route, call `auth.api.getSession({ headers: request.headers })` to get the session. Return 401 if no session.
- `GET /api/resumes`: filter resumes by `resume.userId = session.user.id`.
- `POST /api/resumes`: set `userId: session.user.id` when inserting.
- `GET /api/jobs`: filter jobs by `resumeJob.userId = session.user.id` (in addition to resumeId).
- `POST /api/jobs`: set `userId: session.user.id` when inserting.
- `DELETE /api/resumes/[id]`: verify the resume belongs to session.user.id before deleting.
- `DELETE /api/jobs/[id]`: verify the job belongs to session.user.id before deleting.
- `POST /api/jobs/[id]/analyze`: verify job ownership before inserting; set `userId` on all inserted analysis records (company, jobDescriptionMatch, resumeFeedback, process).
- `GET /api/jobs/[id]/analysis`: verify job ownership before returning data.
- `GET /api/jobs/[id]/chat` and `POST /api/jobs/[id]/chat`: verify job ownership; set `userId` on coverLetterHistory and messageGenHistory records.
- Import `auth` from `@/app/lib/auth` in each route.

### Task 5: Update login/logout/signup UI
**Status**: pending
**Goal**: Connect the login page forms and AppFrame sign-out button to better-auth client.
**Depends on**: Task 2
**Details**:
- In `app/page.tsx`: import `authClient` from `@/app/lib/auth-client`. On sign-in form submit, call `authClient.signIn.email({ email, password })` and redirect to `/resumes` on success. On sign-up form submit, call `authClient.signUp.email({ email, password, name: email })` and redirect to `/resumes` on success. Comment out the forgot-password mode: comment out the `forgot` variant from the `Mode` type, its titles/submitLabel entries, the password-reset form branch, and the "Forgot Password" link button. Do not delete any code. Show error messages from the auth response inline below the form. Add loading state to the submit button.
- In `app/components/ym/AppFrame.tsx`: import `authClient` from `@/app/lib/auth-client`. Make the Sign Out button call `authClient.signOut()` then `router.push('/')`.
