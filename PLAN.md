# Plan: LangGraph Workflow Integration

## Overview
Wire the LangGraph multi-agent AI workflow into the app: create the workflow module with the corrected parallel topology, update the jobs analyze API to run it in the background with process-status tracking, and update the frontend to poll every second and display results incrementally as each agent completes.

## Tasks

### Task 1: Create LangGraph workflow module (`app/lib/workflow.ts`)
**Status**: done
**Goal**: Build the LangGraph multi-agent workflow with the correct parallel topology and per-node DB side effects.
**Depends on**: none
**Details**:
- Create `app/lib/workflow.ts` exporting `async function runWorkflow({ jobId, userId, resumeText, jobText }: WorkflowParams): Promise<void>`
- State shape via `Annotation.Root` (remove `company` from state - agent extracts it from job description):
  - `job: Annotation<string>()`
  - `resume: Annotation<string>()`
  - `company_result: Annotation<string>()`
  - `JDMatch_result: Annotation<string>()`
  - `feedback_result: Annotation<string>()`
  - `cover_letter_result: Annotation<string>()`
  - `msg_result: Annotation<string>()`
- LLMs defined OUTSIDE `runWorkflow` (module scope):
  - `reasoningLlm`: `ChatOpenAI` with `modelName: process.env.REASONING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free'`, `temperature: 0`, `openAIApiKey: process.env.OPENROUTER_API_KEY`, `configuration: { baseURL: 'https://openrouter.ai/api/v1' }`
  - `writingLlm`: same but `modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free'`, `temperature: 0.7`
- `companySearchTool` and `tavily` defined at module scope (same as existing route.ts, TavilySearch reads TAVILY_API_KEY from env)
- Prompts (all at module scope, copied/fixed from existing route.ts):
  - `company_prompt`: existing (unchanged)
  - `cross_reference_prompt`: existing (unchanged)
  - `generate_letter_prompt`: existing (unchanged)
  - `generate_msg_prompt`: existing (unchanged)
  - `feedback_prompt`: WRITE A REAL ONE (Senior Technical Recruiter persona): "You are a Senior Technical Recruiter and Career Coach specializing in Computer Science and STEM. Review the resume critically and constructively. Cover: (1) Overall Impact - does it immediately communicate value? (2) Bullet Quality - are bullets achievement-focused with metrics? Flag vague bullets and suggest concrete rewrites. (3) Skills Representation - are technical skills current and relevant? Are important skills buried or missing? (4) Structure and Scannability - can a recruiter scan this in 10 seconds and know what this person does? (5) Quick Wins - list 3-5 specific actionable changes to most improve performance. Be direct and specific. Reference actual content from the resume."
- `runWorkflow` body:
  - Import `db` from `@/app/lib/db`
  - Import schema tables: `company, jobDescriptionMatch, resumeFeedback, coverLetterHistory, messageGenHistory, process as processTable, ProcessType, ProcessStatus` from `@/app/lib/db/schema`
  - Import `crypto` for `randomUUID()`
  - Import `and, eq` from `drizzle-orm`
  - Define node functions as closures (they close over jobId, userId):
    - `run_ResearchCompany(state)`:
      1. Build `researchAgent = createReactAgent({ llm: reasoningLlm, tools: [companySearchTool], messageModifier: new SystemMessage(company_prompt) })`
      2. Invoke: `res = await researchAgent.invoke({ messages: [{ role: 'user', content: 'Find information about the company in this job description:\n\n' + state.job }] })`
      3. `const content = String(res.messages[res.messages.length - 1].content)`
      4. `await db.insert(company).values({ id: randomUUID(), userId, jobId, content })`
      5. `await db.update(processTable).set({ status: ProcessStatus.Done }).where(and(eq(processTable.jobId, jobId), eq(processTable.processType, ProcessType.Company)))`
      6. Return `{ company_result: content }`
      7. Wrap in try-catch: on error, update process status to `ProcessStatus.Failed` for Company, re-throw
    - `run_CrossRef(state)`:
      1. Build prompt chain with `cross_reference_prompt`
      2. Invoke with `{ job: state.job, resume: state.resume }`
      3. Insert into `jobDescriptionMatch` table
      4. Update process status to Done for JDMatch
      5. Return `{ JDMatch_result }`
      6. try-catch: set JDMatch to Failed on error, re-throw
    - `run_ResumeFeedback(state)`:
      1. Build prompt chain with `feedback_prompt`
      2. Invoke with `{ resume: state.resume }`
      3. Insert into `resumeFeedback` table
      4. Update process status to Done for ResumeFeedback (ProcessType.ResumeFeedback = 'feedback')
      5. Return `{ feedback_result }`
      6. try-catch: set ResumeFeedback to Failed on error, re-throw
    - `run_GenerateLetter(state)`:
      1. FIRST: update process status to Processing for Letter
      2. Build prompt chain with `generate_letter_prompt`
      3. Invoke with `{ JDMatch_result: state.JDMatch_result, company_result: state.company_result, resume: state.resume, job: state.job }`
      4. Insert into `coverLetterHistory`: `{ jobId, userId, conversation: [{ role: 'ai', text: letterContent }] }`
      5. Update process status to Done for Letter
      6. Return `{ cover_letter_result }`
      7. try-catch: set Letter to Failed on error
    - `run_GenerateMsg(state)`:
      1. FIRST: update process status to Processing for Message
      2. Build prompt chain with `generate_msg_prompt`
      3. Invoke with same fields as GenerateLetter
      4. Insert into `messageGenHistory`: `{ jobId, userId, conversation: [{ role: 'ai', text: msgContent }] }`
      5. Update process status to Done for Message
      6. Return `{ msg_result }`
      7. try-catch: set Message to Failed on error
  - Build and compile graph inside `runWorkflow`:
    ```
    const workflow = new StateGraph(AgentState)
      .addNode("ResearchCompany", run_ResearchCompany)
      .addNode("CrossRef", run_CrossRef)
      .addNode("ResumeFeedback", run_ResumeFeedback)
      .addNode("GenerateLetter", run_GenerateLetter)
      .addNode("GenerateMsg", run_GenerateMsg)
      .addEdge(START, "ResearchCompany")
      .addEdge(START, "CrossRef")
      .addEdge(START, "ResumeFeedback")
      .addEdge("ResumeFeedback", END)
      .addEdge("ResearchCompany", "GenerateLetter")
      .addEdge("CrossRef", "GenerateLetter")
      .addEdge("ResearchCompany", "GenerateMsg")
      .addEdge("CrossRef", "GenerateMsg")
      .addEdge("GenerateLetter", END)
      .addEdge("GenerateMsg", END)
    const app = workflow.compile()
    ```
  - Invoke: `await app.invoke({ job: jobText, resume: resumeText, company_result: '', JDMatch_result: '', feedback_result: '', cover_letter_result: '', msg_result: '' })`
- Also update `app/api/analyze/route.ts` to import `runWorkflow` from `@/app/lib/workflow` and change the POST handler to accept JSON body `{ jobId }`, validate session, look up resumeJob + resume from DB, fire `void runWorkflow(...)`, and return 202 (remove the form-data/PDF parsing approach).

### Task 2: Rewrite analyze POST route (`app/api/jobs/[id]/analyze/route.ts`)
**Status**: done
**Goal**: Replace mock data insertion with background workflow orchestration and proper process status initialization.
**Depends on**: Task 1
**Details**:
- Remove all MOCK_DATA constants and static data insertion
- Add imports: `import { runWorkflow } from '@/app/lib/workflow'`, `import { resume } from '@/app/lib/db/schema'` (the resumes table), add `coverLetterHistory, messageGenHistory` to the schema import for deletion
- POST handler:
  1. Validate session
  2. Get `resumeJob` row (existing query pattern) - return 404 if not found
  3. Check all-done: `const processes = await db.select().from(processTable).where(eq(processTable.jobId, jobId))`. If `processes.length === 5 && processes.every(p => p.status === ProcessStatus.Done)`, return `NextResponse.json({ status: 'done' })`
  4. Get resume row: `const [resumeRow] = await db.select().from(resume).where(eq(resume.id, job[0].resumeId))`
  5. Clear old data with `Promise.all([...])`:
     - `db.delete(company).where(eq(company.jobId, jobId))`
     - `db.delete(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId))`
     - `db.delete(resumeFeedback).where(eq(resumeFeedback.jobId, jobId))`
     - `db.delete(coverLetterHistory).where(eq(coverLetterHistory.jobId, jobId))`
     - `db.delete(messageGenHistory).where(eq(messageGenHistory.jobId, jobId))`
     - `db.delete(processTable).where(eq(processTable.jobId, jobId))`
  6. Insert 5 process records (use `Promise.all` or sequential inserts):
     - Company: status=Processing
     - JDMatch: status=Processing
     - ResumeFeedback: status=Processing
     - Letter: status=Pending
     - Message: status=Pending
  7. Fire background: `void runWorkflow({ jobId, userId: session.user.id, resumeText: resumeRow?.content ?? '', jobText: job[0].content ?? '' })`
  8. Return `NextResponse.json({ status: 'started' }, { status: 202 })`
- Keep existing imports that are still needed (auth, db, processTable, ProcessType, ProcessStatus, resumeJob, eq, and, crypto)
- Note: `ProcessType.ResumeFeedback` is 'feedback' (from schema enum). `ProcessType.JDMatch` is 'jdmatch'. `ProcessType.Letter` is 'letter'. `ProcessType.Message` is 'message'.

### Task 3: Update analysis GET route (`app/api/jobs/[id]/analysis/route.ts`)
**Status**: done
**Goal**: Extend the response to also return letter and message conversation data so the frontend can display generated letter/message from polling.
**Depends on**: none (independent, can run in parallel with Task 2)
**Details**:
- Add to imports: `coverLetterHistory, messageGenHistory` from schema
- After existing queries, add (in parallel with the other selects - wrap all 5 selects in `Promise.all`):
  - `const [letterRow] = await db.select().from(coverLetterHistory).where(eq(coverLetterHistory.jobId, jobId))`
  - `const [messageRow] = await db.select().from(messageGenHistory).where(eq(messageGenHistory.jobId, jobId))`
- Update return JSON:
  ```json
  {
    "company": "...",
    "jdMatch": "...",
    "feedback": "...",
    "letterConversation": [...] | null,
    "messageConversation": [...] | null,
    "processes": [...]
  }
  ```
- `letterConversation: letterRow?.conversation ?? null`
- `messageConversation: messageRow?.conversation ?? null`
- The `conversation` field is stored as JSON in DB and Drizzle returns it already parsed as an array

### Task 4: Update jobs page frontend (`app/jobs/page.tsx`)
**Status**: done
**Goal**: Replace static analyze flow with real-time polling, incremental result display, and process-status-gated UI per tab.
**Depends on**: Tasks 2 and 3
**Details**:

**State additions:**
- Add `processStatuses: Array<{ processType: string; status: string }>` (init `[]`)
- Add `import { useRef } from 'react'` and `const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)`

**Polling helpers (defined before JSX return, after state declarations):**
```ts
const stopPolling = () => {
  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
};

const startPolling = (jobId: string) => {
  stopPolling();
  pollRef.current = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/analysis`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalysisData({ company: data.company, jdMatch: data.jdMatch, feedback: data.feedback });
      setProcessStatuses(data.processes ?? []);
      if (data.letterConversation) setChats(p => ({ ...p, letter: data.letterConversation }));
      if (data.messageConversation) setChats(p => ({ ...p, message: data.messageConversation }));
      const procs: Array<{ status: string }> = data.processes ?? [];
      const allDone = procs.length === 5 && procs.every(p => p.status === 'done' || p.status === 'failed');
      if (allDone) { stopPolling(); setIsAnalyzing(false); }
    } catch { /* ignore transient errors */ }
  }, 1000);
};
```

**Updated `handleAnalyze`:**
```ts
const handleAnalyze = async () => {
  if (!selectedJobId) return;
  setIsAnalyzing(true);
  try {
    const res = await fetch(`/api/jobs/${selectedJobId}/analyze`, { method: 'POST' });
    if (!res.ok) throw new Error('Analyze request failed');
    const data = await res.json();
    if (data.status === 'done') {
      const analysisRes = await fetch(`/api/jobs/${selectedJobId}/analysis`);
      if (!analysisRes.ok) throw new Error('Failed to fetch analysis');
      const analysis = await analysisRes.json();
      setAnalysisData({ company: analysis.company, jdMatch: analysis.jdMatch, feedback: analysis.feedback });
      setProcessStatuses(analysis.processes ?? []);
      if (analysis.letterConversation) setChats(p => ({ ...p, letter: analysis.letterConversation }));
      if (analysis.messageConversation) setChats(p => ({ ...p, message: analysis.messageConversation }));
      setIsAnalyzing(false);
      setView('report');
      setTab('Company');
    } else {
      setView('report');
      setTab('Company');
      startPolling(selectedJobId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to analyze job.';
    showError(msg);
    setIsAnalyzing(false);
  }
};
```

**Cleanup effects:**
- Update existing `useEffect` for `selectedJobId` change: add `stopPolling()` and `setProcessStatuses([])` inside
- Add cleanup effect: `useEffect(() => () => stopPolling(), [])`

**Process status helper (after state declarations):**
```ts
const getProcessStatus = (type: string) =>
  processStatuses.find(p => p.processType === type)?.status ?? null;
```

**Updated tab content rendering (Company/JDMatch/Feedback tabs):**
Replace the current ternary that checks `analysisData?.[...]` with:
```ts
{tab !== 'Generate' ? (() => {
  const tabConfig: Record<string, { processType: string; content: string | null | undefined }> = {
    Company: { processType: 'company', content: analysisData?.company },
    JDMatch: { processType: 'jdmatch', content: analysisData?.jdMatch },
    Feedback: { processType: 'feedback', content: analysisData?.feedback },
  };
  const { processType, content } = tabConfig[tab] ?? { processType: '', content: null };
  const status = getProcessStatus(processType);
  if (status === 'done' && content) return <MarkdownPanel>{content}</MarkdownPanel>;
  if (status === 'processing' || status === 'pending') return <div style={{ color: '#666', fontStyle: 'italic' }}>Processing...</div>;
  if (status === 'failed') return <div style={{ color: '#c00', fontStyle: 'italic' }}>Analysis failed for this section.</div>;
  return <div style={{ color: '#666', fontStyle: 'italic' }}>Click Analyze to generate analysis.</div>;
})() : (
  // Generate tab - see below
)}
```

**Generate tab letter/message status display:**
In the Generate tab, before rendering the chat messages, check if the current mode's process is still running:
```ts
const modeProcessType = mode === 'letter' ? 'letter' : 'message';
const modeStatus = getProcessStatus(modeProcessType);
// In the chat display inset div:
{(modeStatus === 'pending' || modeStatus === 'processing') ? (
  <div style={{ color: '#888', fontStyle: 'italic' }}>
    {`Generating your ${mode === 'letter' ? 'cover letter' : 'message'}...`}
  </div>
) : modeStatus === 'failed' ? (
  <div style={{ color: '#c00', fontStyle: 'italic' }}>Generation failed. Please re-analyze.</div>
) : lines.length === 0 ? (
  <div style={{ color: '#888', fontStyle: 'italic' }}>(No messages yet. Start typing below.)</div>
) : (
  lines.map((l, i) => (/* existing chat line render */))
)}
```

**Note on `loadChats` effect:** Keep the existing `loadChats` effect (it handles the case where analysis is already done and user navigates to Generate tab). The polling will also update chats state when letterConversation/messageConversation arrive, so no conflict.

**Process type values** (from schema enum): 'company', 'jdmatch', 'feedback', 'letter', 'message'.
