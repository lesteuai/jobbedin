# JobbedIn
An agentic AI system that researches company details to personalize cover letters and messages to hiring personnel.

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
  - (b) Compose a 100-word summary for recruitment purposes (e.g., for LinkedIn).

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
