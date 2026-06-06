# JobbedIn
An agentic AI system that researches company details to personalize cover letters and messages to hiring personnel.

### By [Brian Phan](https://www.linkedin.com/in/brphan/), [Huu Phat Loc Nguyen](mailto:fatlock1712@gmail.com)

Read [here](README-inspiration.md) to know our inspiration.

---
## How it works

It is designed to perform the following tasks:

- (1) Ingest a resume and job description (provided as text or a URL).
- (2) Deploy an agent to research the target company.
- (3) Cross-reference the candidate's experience against the job requirements.
- (4) Provide a critique of the resume.
- (5) Generate a comprehensive summary report based on the preceding steps.
- (6) Based on the findings from the two steps above:
  - (a) Draft a personalized cover letter.
  - (b) Compose a 100-word message to send to recruiters on LinkedIn.

This application prioritizes job roles within the Computer Science (CS) field, as that is our area of ​​expertise.

---
## Workflow:

```
(1) → (2 // 3 // 4) → (5) → (6a // 6b)
```
**Symbols:**\
//: Parallel agent execution

---
## Technology Stack

- **Frontend:** Next.js, Tailwind
- **Backend:** Next.js
- **Database:** PostgreSQL
- **AI Frameworks:** LangGraph (orchestration), OpenAI-compatible APIs
- **Tools:** Lovable, Claude Code
- **Deployment:** Vercel, Supabase

---
## Installation & Deployment

### Local Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   See [Environment Variables](#environment-variables) below for details on each key.

3. Initialize the database:
   ```bash
   pnpm db:migrate
   pnpm test-db  # Validate connection
   ```

4a. Start the development server:
   ```bash
   pnpm dev
   ```
   The app runs at `http://localhost:3000`

4b. Build for production:
   ```bash
   pnpm build
   pnpm start
   ```

### Database (PostgreSQL)

- Use a PostgreSQL instance or Supabase/Neon.
- Make changes to schema in `app/lib/db/schema.ts` then run `pnpm db:generate` to create a new migration script.
- Migrations: Run `pnpm db:migrate` after schema changes in `drizzle/`.

---
## Environment Variables

| Key | Description | Example |
|-----|-------------|---------|
| `PGUSER` | PostgreSQL username | `postgres` |
| `PGPASSWORD` | PostgreSQL password | `your-secure-password` |
| `PGHOST` | PostgreSQL host address | `localhost` or `db.supabase.co` |
| `PGPORT` | PostgreSQL port | `5432` |
| `PGDATABASE` | PostgreSQL database name | `jobbedin` |
| `BETTER_AUTH_SECRET` | Secret key for session encryption | Generate with: `./generate-better-auth-key` |
| `ORIGIN` | Application URL (used for auth redirects in production) | `https://yourdomain.com` |
| `ORIGIN-dev` | Application URL (used for auth redirects in development) | `http://localhost:3000` |
| `OPENROUTER_API_KEY` | API key for OpenRouter LLM access | Obtain from [OpenRouter](https://openrouter.ai) |
| `TAVILY_API_KEY` | API key for web search via Tavily | Obtain from [Tavily](https://tavily.com) |
