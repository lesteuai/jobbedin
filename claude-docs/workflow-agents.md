# LangGraph Workflow & AI Agents

## Workflow Overview (app/lib/workflow.ts)

Multi-agent orchestration using LangGraph StateGraph. Executes 5 nodes in parallel and sequential stages:

**Stage 1 (parallel from START):**
- ResearchCompany — Tavily search + agent research
- CrossRef — LLM-based JD vs resume matching
- ResumeFeedback — LLM-based resume critique

**Stage 2 (depends on Company + CrossRef):**
- GenerateLetter — Cover letter writer
- GenerateMsg — Recruiter message writer

## Node Definitions

### ResearchCompany
Uses Tavily web search tool + LLM agent to research:
- Company mission and culture
- Recent hiring news
- Company growth/product news

Writes results to `company` table.

**Tools:**
- @langchain/tavily (TavilySearch tool)
- Requires TAVILY_API_KEY env var

### CrossRef
Compares candidate resume against job description:
- Skill match analysis
- Experience alignment
- Gap identification

Writes to `job_description_match` table.

**Prompt:** `cross_reference_prompt` from system-prompt.ts

### ResumeFeedback
Critical review of resume:
- Format and clarity issues
- Missing sections or credentials
- Improvement suggestions

Writes to `resume_feedbacks` table.

**Prompt:** `feedback_prompt` from system-prompt.ts

### GenerateLetter
Generates personalized cover letter:
- Depends on Company + CrossRef results
- Uses company research + JD match data
- Contextual to candidate experience

Writes to `cover_letter_history` table as initial message: [{ role: 'ai', text: result }]

**Prompt:** `generate_letter_prompt` from system-prompt.ts

### GenerateMsg
Generates 100-word recruiter outreach message:
- Depends on Company + CrossRef results
- Uses same context as cover letter
- Concise, engaging tone

Writes to `message_gen_history` table as initial message: [{ role: 'ai', text: result }]

**Prompt:** `generate_msg_prompt` from system-prompt.ts

## System Prompts (app/lib/system-prompt.ts)

Exports 5 named constants shared between workflow nodes and chat refinement route:

```typescript
export const company_prompt = "...";           // Company research
export const cross_reference_prompt = "...";  // JD vs resume
export const feedback_prompt = "...";         // Resume critique
export const generate_letter_prompt = "...";  // Cover letter
export const generate_msg_prompt = "...";    // Recruiter message
```

**Critical:** Do not define prompts inline. Import from system-prompt.ts to enable:
1. Chat refinement route to use same prompts as workflow
2. Easy prompt updates in one place
3. Consistent behavior across generation modes

## LLM Integration

**Provider:** OpenRouter API
**Model:** meta-llama/llama-3.1-8b-instruct:free (configurable via WRITING_MODEL, REASONING_MODEL env vars)
**Library:** @langchain/openai (ChatOpenAI client)

**Usage in nodes:**
```typescript
const llm = new ChatOpenAI({
  modelName: 'meta-llama/llama-3.1-8b-instruct:free',
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const response = await llm.invoke([
  new SystemMessagePromptTemplate().formatPromptValue({ ... }),
  new HumanMessagePromptTemplate().formatPromptValue({ ... }),
]);
```

## Process Status Tracking

Each node updates its own process record (5 total):

```typescript
process {
  id: UUID,
  jobId: UUID,
  userId: UUID,
  processType: 'company' | 'jdmatch' | 'feedback' | 'letter' | 'message',
  status: 'pending' | 'processing' | 'done' | 'failed',  // from ProcessStatus enum
  createdAt: Date,
  updatedAt: Date
}
```

**Node status lifecycle:**
1. 'processing' for first 3 nodes (Company, CrossRef, ResumeFeedback) when workflow starts (set by analyze endpoint)
2. 'pending' for Letter and Message nodes initially
3. 'processing' for Letter and Message when they start (depends on Company + CrossRef)
4. 'done' or 'failed' upon completion

Frontend polls `/api/jobs/[id]/analysis` to read all 5 process statuses.

## Execution Model

**Fire-and-forget:**
- `/api/jobs/[id]/analyze` calls `void runWorkflow()` without awaiting
- Returns 202 immediately
- Workflow executes in background

**Error handling:**
- Errors only logged to server console
- Process status set to Failed on error
- No retry mechanism
- Frontend sees Failed status on next poll

**No aggregated error summary:**
- Each node fails independently
- Frontend displays per-node status, not aggregated errors

## Workflow Invocation (from API route)

```typescript
export const POST = handleAsync(async (request, ctx) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (\!session) return new Response('Unauthorized', { status: 401 });

  const { id: jobId } = ctx.params;
  
  // Check if already analyzed (optional)
  // Clear old results
  // Create 5 process records
  
  // Fire-and-forget
  void runWorkflow(jobId, session.user.id, resumeContent, jobDescription);
  
  return new Response(null, { status: 202 });  // Accepted
});
```

## Dependencies

- @langchain/langgraph — StateGraph, START, END, Annotation
- @langchain/core — ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
- @langchain/openai — ChatOpenAI client
- @langchain/tavily — TavilySearch tool
- openrouter API — Llama 3.1 models

## Debugging Workflow

Since workflow is fire-and-forget and runs asynchronously:
1. Check server console logs (errors logged by runWorkflow())
2. Query `process` table to see per-node status
3. Query result tables (company, jobDescriptionMatch, resumeFeedback, etc.) to see generated content
4. No client-side error messages beyond "Failed" status

**Env var troubleshooting:**
- OPENROUTER_API_KEY missing → all LLM nodes fail
- TAVILY_API_KEY missing → ResearchCompany node fails
- Missing models → defaults to meta-llama/llama-3.1-8b-instruct:free
