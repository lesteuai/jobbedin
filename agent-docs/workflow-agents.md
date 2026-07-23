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

**Quality assurance:**
- Generated content checked for gibberish via `isGibberish(text)` heuristic (detects excessive repetition, low token diversity); exported as named export from workflow.ts for testability
- If gibberish detected, generation is retried once
- If still degenerate after retry, node fails with statusReason; gibberish is never persisted

### CrossRef
Compares candidate resume against job description:
- Skill match analysis
- Experience alignment
- Gap identification

Writes to `job_description_match` table.

**Prompt:** `cross_reference_prompt` from system-prompt.ts

**Quality assurance:**
- Generated content checked for gibberish via isGibberish(text) heuristic
- If gibberish detected, generation is retried once
- If still degenerate after retry, node fails with statusReason; gibberish is never persisted

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

## LLM Integration & Factories (app/lib/openrouter.ts)

**Provider:** OpenRouter API
**Models:** 
- Reasoning (ResearchCompany, CrossRef, ResumeFeedback): REASONING_MODEL env var, default meta-llama/llama-3.1-8b-instruct, temperature 0
- Writing (GenerateLetter, GenerateMsg, chat): WRITING_MODEL env var, default meta-llama/llama-3.1-8b-instruct, temperature 0.7
**Library:** @langchain/openai (ChatOpenAI client)

**LLM factories** (replace per-route instantiation):
```typescript
export function createReasoningLlm(encryptedApiKey?: string | null): ChatOpenAI
export function createWritingLlm(encryptedApiKey?: string | null): ChatOpenAI
```

Both factories:
- Accept optional encrypted user API key (from user_settings.openrouterApiKey)
- Decrypt key internally via crypto.decrypt(); catch silently and fall back to process.env.OPENROUTER_API_KEY on failure
- Resolve to user key if decryption succeeds and key is non-empty; otherwise fall back to server key
- Always use baseURL: 'https://openrouter.ai/api/v1'
- Include maxTokens: 4096 to prevent token degeneration
- Include modelKwargs: { frequency_penalty: 0.3 } to reduce repetition/gibberish
- Detect HTTP 401 (invalid API key) via isAuthError() and HTTP 402 (out of credit) via isOutOfCreditError()

**Usage in workflow nodes:**
```typescript
const reasoningLlm = createReasoningLlm(userSettingsRow.openrouterApiKey);  // Pass encrypted key
const writingLlm = createWritingLlm(userSettingsRow.openrouterApiKey);

const response = await reasoningLlm.invoke([
  new SystemMessage(prompt),
  ...messages
]);
```

**Per-user key flow in workflow:**
1. Fetch user settings row (customLetterInstructions, customMsgInstructions, openrouterApiKey encrypted)
2. Pass encrypted openrouterApiKey directly to createReasoningLlm() and createWritingLlm()
3. Each factory decrypts key internally; on success, uses decrypted key exclusively
4. On decrypt failure or empty key, factory falls back to server key (OPENROUTER_API_KEY)
5. Caller no longer handles decryption or fallback logic

## Process Status Tracking

Each node updates its own process record (5 total):

```typescript
process {
  id: UUID,
  jobId: UUID,
  userId: UUID,
  processType: 'company' | 'jdmatch' | 'feedback' | 'letter' | 'message',
  status: 'pending' | 'processing' | 'done' | 'failed',  // from ProcessStatus enum
  statusReason: 'out_of_credit' | 'invalid_api_key' | null,  // from STATUS_REASON constant (app/lib/constants.ts)
  createdAt: Date,
  updatedAt: Date
}
```

**Status reason values** (app/lib/constants.ts):
- `STATUS_REASON.OUT_OF_CREDIT` ('out_of_credit') — HTTP 402 error from LLM API (out of credit)
- `STATUS_REASON.INVALID_API_KEY` ('invalid_api_key') — HTTP 401 error from LLM API (user key is invalid)
- `STATUS_REASON_MESSAGE` maps each reason to user-facing text: "Free trial is over. Add your own OpenRouter API key in Settings, then re-analyze." for out_of_credit, etc.

**Node status lifecycle:**
1. 'processing' for first 3 nodes (Company, CrossRef, ResumeFeedback) when workflow starts (set by analyze endpoint)
2. 'pending' for Letter and Message nodes initially
3. 'processing' for Letter and Message when they start (depends on Company + CrossRef)
4. 'done' or 'failed' upon completion
5. On failure, statusReason set via resolveStatusReason(error) which checks precedence: OUT_OF_CREDIT (HTTP 402) takes priority, then INVALID_API_KEY (HTTP 401)

**Error detection and status resolution** — In each node's catch block:
```typescript
catch (error) {
  const statusReason = resolveStatusReason(error);  // Returns OUT_OF_CREDIT or INVALID_API_KEY or null; exported as named export from workflow.ts
  await db.update(processTable).set({ status: ProcessStatus.Failed, statusReason });
  throw error;  // Propagate to workflow.invoke() catch
}
```

**Terminal state guarantee** — After workflow.invoke() completes or throws:
```typescript
catch (error) {
  const statusReason = resolveStatusReason(error);
  // Mark any leftover pending/processing rows as failed
  await db.update(processTable).set({ status: ProcessStatus.Failed, statusReason })
    .where(and(
      eq(processTable.jobId, jobId),
      inArray(processTable.status, [ProcessStatus.Pending, ProcessStatus.Processing])
    ));
}
```
Ensures SSE stream reaches terminal state even if upstream node throws (e.g., Company fails → Letter/Message never run → their process rows stay pending without this cleanup).

**Frontend receives updates via EventSource** to `/api/jobs/[id]/analysis-stream` (SSE), which polls database every 1s and streams results to client:
```json
{
  "processes": [
    { "processType": "company", "status": "done", "statusReason": null },
    { "processType": "letter", "status": "failed", "statusReason": "out_of_credit" }
  ]
}
```
Client maps statusReason via STATUS_REASON_MESSAGE and renders user-facing failure message.

## Execution Model

**Fire-and-forget:**
- `/api/jobs/[id]/analyze` calls `void runWorkflow()` without awaiting
- Returns 202 immediately
- Workflow executes in background

**Stream-based progress (Server-Sent Events):**
- `/api/jobs/[id]/analysis-stream` (GET) opens a persistent SSE connection
- Server-side interval polls database every 1s, streams all results + process statuses
- Client receives updates reactively via EventSource onmessage handler
- Stream auto-closes when all 5 processes are terminal (Done or Failed)

**Error handling:**
- Errors only logged to server console
- Process status set to Failed on error
- No retry mechanism
- Frontend sees Failed status on next stream message

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
