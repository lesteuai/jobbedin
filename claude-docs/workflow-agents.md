# LangGraph Workflow & AI Agents

## Purpose

Orchestrates a multi-agent LangGraph workflow that analyzes job applications in parallel and sequentially. Five specialized nodes research the company, match resume skills to the JD, critique the resume, generate a personalized cover letter, and produce a 100-word recruiter message. Results are persisted to PostgreSQL and process statuses are tracked for real-time frontend polling.

## Location

- `app/lib/workflow.ts` — Main workflow definition and node implementations
- `app/api/jobs/[id]/analyze/route.ts` — API trigger that spawns the async workflow
- `app/api/jobs/[id]/analysis/route.ts` — Polling endpoint that returns current results and process statuses
- `app/jobs/page.tsx` — Frontend integration: polling loop and incremental UI updates

## Entry Points

- `runWorkflow({ jobId, userId, resumeText, jobText }: WorkflowParams)` — Exported async function that orchestrates the entire LangGraph workflow. Called fire-and-forget from the analyze route.
- `POST /api/jobs/[id]/analyze` — Triggers workflow start, returns 202 immediately
- `GET /api/jobs/[id]/analysis` — Polled by frontend to fetch current results and process statuses

## Architecture / Key Components

### LangGraph State and Nodes

The workflow uses LangGraph's `StateGraph` with an `AgentState` Annotation that tracks:
- `job` (string) — the job description
- `resume` (string) — the candidate's resume text
- `company_result` — research output from ResearchCompany node
- `JDMatch_result` — skills matching output from CrossRef node
- `feedback_result` — resume critique from ResumeFeedback node
- `cover_letter_result` — generated cover letter from GenerateLetter node
- `msg_result` — generated recruiter message from GenerateMsg node

**Five nodes (with execution order):**

1. **ResearchCompany** (runs in parallel from START)
   - Uses LangChain's `createReactAgent` with Tavily search tool
   - System prompt: analyze company mission, culture, strategic news
   - Tool: `companySearchTool` invokes Tavily 3x (what do they do, why hiring, work culture)
   - Writes output to `company` table
   - Updates process status to Done or Failed
   - Input: state.job

2. **CrossRef** (runs in parallel from START)
   - LLM chain: ChatPromptTemplate + reasoningLlm + StringOutputParser
   - System prompt: ATS optimizer comparing resume vs JD
   - Output: 3 actionable suggestions to improve resume match
   - Writes output to `jobDescriptionMatch` table
   - Updates process status to Done or Failed
   - Input: state.job, state.resume

3. **ResumeFeedback** (runs in parallel from START)
   - LLM chain: ChatPromptTemplate + reasoningLlm + StringOutputParser
   - System prompt: Senior Technical Recruiter reviewing resume critically
   - Output: overall impact, bullet quality, skills representation, structure, 3-5 quick wins
   - Writes output to `resumeFeedback` table
   - Updates process status to Done or Failed
   - Input: state.resume

4. **GenerateLetter** (depends on ResearchCompany + CrossRef)
   - LLM chain: ChatPromptTemplate + writingLlm + StringOutputParser
   - System prompt: Career Coach writing tailored cover letter (< 300 words, no robotic jargon)
   - Input: state.JDMatch_result, state.company_result, state.resume, state.job
   - Writes output to `coverLetterHistory` table as first message: `[{ role: 'ai', text: result }]`
   - Updates process status to Processing (on start) then Done or Failed

5. **GenerateMsg** (depends on ResearchCompany + CrossRef)
   - LLM chain: ChatPromptTemplate + writingLlm + StringOutputParser
   - System prompt: Career Coach writing 75-95 word recruiter message (strict limit)
   - Input: state.JDMatch_result, state.company_result, state.resume, state.job
   - Writes output to `messageGenHistory` table as first message: `[{ role: 'ai', text: result }]`
   - Updates process status to Processing (on start) then Done or Failed

### LLM Configuration

- **reasoningLlm**: ChatOpenAI with temperature=0, model from REASONING_MODEL env var (default 'meta-llama/llama-3.1-8b-instruct:free')
- **writingLlm**: ChatOpenAI with temperature=0.7, model from WRITING_MODEL env var (default 'meta-llama/llama-3.1-8b-instruct:free')
- Both use OpenRouter via OPENROUTER_API_KEY env var and baseURL 'https://openrouter.ai/api/v1'

### Tools

- **companySearchTool**: LangChain tool decorator wrapping Tavily search
  - Takes company name query parameter
  - Executes 3 Tavily searches (what they do, hiring trends, work culture)
  - Returns concatenated search results
  - Used by ResearchCompany node's React agent

### Process Status Tracking

The analyze route creates 5 process records in the `process` table before workflow starts:
```
{ id, userId, jobId, processType: Company | JDMatch | ResumeFeedback | Letter | Message, status: Processing | Pending | Done | Failed }
```

Each node updates its corresponding record's status:
- Initial: Company/JDMatch/ResumeFeedback start as Processing; Letter/Message start as Pending
- On completion: sets status to Done
- On error: sets status to Failed and throws (caught in try/catch within node)

The analysis endpoint queries these records and returns them as `processes: [{ processType, status }, ...]` for frontend polling.

## Data Flow

### User Initiates Analysis

1. Frontend clicks "Analyze" button
2. POST to `/api/jobs/[id]/analyze` with jobId in body
3. Analyze route validates session and job ownership
4. Checks if already analyzed (all 5 processes Done) — if so, returns { status: 'done' }
5. Else: deletes prior analysis results (company, JDMatch, feedback, letterHistory, messageHistory, process records)
6. Creates 5 new process records with Processing/Pending status
7. Calls `void runWorkflow(...)` (fire-and-forget, not awaited)
8. Returns 202 Accepted with { status: 'started' }

### Workflow Executes Asynchronously

1. Workflow invokes StateGraph with initial state (job, resume, empty results)
2. START -> ResearchCompany, CrossRef, ResumeFeedback (in parallel, can be concurrent)
3. ResearchCompany writes to DB, updates status to Done
4. CrossRef writes to DB, updates status to Done
5. ResumeFeedback writes to DB, updates status to Done
6. GenerateLetter waits for ResearchCompany + CrossRef to complete
7. GenerateMsg waits for ResearchCompany + CrossRef to complete
8. Both GenerateLetter and GenerateMsg can run in parallel
9. Each writes to DB, updates status to Done
10. Workflow terminates when all nodes reach END

### Frontend Polls for Progress

1. After receiving 202 from analyze, frontend calls `startPolling(jobId)`
2. `setInterval` fetches `GET /api/jobs/[id]/analysis` every 1 second
3. Analysis route returns:
   - company: content from company table (or null)
   - jdMatch: content from jobDescriptionMatch table (or null)
   - feedback: content from resumeFeedback table (or null)
   - letterConversation: conversation from coverLetterHistory table (or null)
   - messageConversation: conversation from messageGenHistory table (or null)
   - processes: [{ processType, status }, ...] array of 5 records
4. Frontend renders process statuses to show progress (e.g., "Company: Done", "Letter: Processing")
5. Frontend displays results (company, jdMatch, feedback) as soon as they appear
6. When all 5 processes have status Done or Failed, polling stops and frontend exits analyze mode

## Dependencies

**Internal:**
- `app/lib/db` — Drizzle ORM client and database client
- `app/lib/db/schema` — Table definitions (company, jobDescriptionMatch, resumeFeedback, coverLetterHistory, messageGenHistory, process, resumeJob, resume)

**External:**
- @langchain/langgraph — StateGraph, START, END, Annotation for workflow orchestration
- @langchain/core — ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, StringOutputParser, tool decorator, z schema validation
- @langchain/openai — ChatOpenAI for LLM interaction
- @langchain/tavily — TavilySearch tool for web research
- OpenRouter API (via openai-compatible interface) — Llama 3.1 8B models
- drizzle-orm — Database query builder and inserts/updates

## Consumers

**API consumers:**
- `app/api/jobs/[id]/analyze/route.ts` — Calls runWorkflow() fire-and-forget
- `app/api/jobs/[id]/analysis/route.ts` — Queries process and result tables created by workflow nodes

**Frontend consumers:**
- `app/jobs/page.tsx` — Polls analysis endpoint and displays results incrementally

## Patterns & Conventions

**Workflow node pattern:**
Each node follows a try-catch-update pattern:
1. Optional: Set status to Processing on start (for GenerateLetter and GenerateMsg)
2. Execute LLM or agent logic
3. Write result to database
4. Update process status to Done
5. Return new state with result_name
6. Catch errors: Set process status to Failed and re-throw

**Prompt engineering:**
- Prompts are defined as module-level constants (company_prompt, cross_reference_prompt, etc.)
- Each prompt is a multi-line string with specific instructions, constraints, and output format
- Reasoning prompts use temperature=0 for deterministic output
- Writing prompts use temperature=0.7 for creative variation

**State passing:**
- Nodes receive the entire state and select the fields they need
- Nodes return an object with their new field(s)
- LangGraph merges returned state with existing state
- Earlier outputs (e.g., company_result from ResearchCompany) are passed downstream to GenerateLetter and GenerateMsg

**Error handling:**
- Each node has its own try-catch
- On error, status is set to Failed
- Error is re-thrown (caught by top-level Node.js handler; logged to console)
- Frontend will see Failed status on next poll and can display error message

## Gotchas & Non-Obvious Logic

**Fire-and-forget execution:**
The analyze route does `void runWorkflow(...)` without awaiting. This means the route returns immediately while the workflow runs in the background. If the workflow crashes, the frontend sees a Failed process status but no error is sent to the client. All errors are logged to server console only.

**Temperature differences:**
Reasoning nodes use temperature=0 for consistent, logical output; writing nodes use 0.7 for more creative, varied responses. This is intentional: we want deterministic JD matching but varied cover letters.

**Tavily API key implicit:**
The TavilySearch constructor expects the TAVILY_API_KEY to be in the environment. There is no explicit error if it's missing — the tool will fail silently at runtime.

**Process status initialization:**
Company, JDMatch, ResumeFeedback start as Processing (they run first). Letter and Message start as Pending (they wait for dependencies). This allows the frontend to display "Pending" while waiting for dependencies.

**No retry logic:**
If a node fails, its status is set to Failed and the workflow terminates. There is no automatic retry or fallback. The user must click Analyze again to restart.

**Workflow runs to completion:**
Even if one node fails, the others continue running (they're independent). Only GenerateLetter and GenerateMsg depend on Company + CrossRef. If either of those succeeds, Letter/Message will run. If both fail, Letter/Message will fail because their inputs are unavailable.

**Result table strategy:**
Before workflow starts, the analyze route deletes all prior results (company, jdMatch, feedback, letterHistory, messageHistory). This ensures stale data is not returned during polling. Results are written incrementally as nodes complete.

**Conversation format:**
Cover letter and message results are stored as `coverLetterHistory.conversation: [{ role: 'ai', text: result }]` (array of chat objects). This allows the frontend to display as the first AI message and then append user refinements to the conversation.

## Open Questions

- Should nodes have retry logic or exponential backoff on LLM errors?
- Should there be a timeout per node or for the entire workflow?
- Should failed nodes log specific error details to the database for user visibility?
- Should the workflow validate that resume and job description are non-empty before starting nodes?
