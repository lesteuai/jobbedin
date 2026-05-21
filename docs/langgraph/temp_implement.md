# LangGraph Flow Analysis — `app/api/analyze/route.ts`

## Overview

This route implements a multi-agent AI pipeline using LangGraph's `StateGraph`. It accepts a resume PDF, job description, and company name, then runs several parallel and sequential analysis steps, returning a consolidated result object.

---

## State Shape

Defined via `Annotation.Root`, the shared state carries:

| Field | Set by | Description |
|---|---|---|
| `job` | Input | Raw job description text |
| `company` | Input | Company name string |
| `resume` | Input | Extracted PDF text |
| `company_result` | ResearchCompany | Company context summary |
| `JDMatch_result` | CrossRef | JD vs resume gap analysis |
| `feedback_result` | ResumeFeedback | Resume critique |
| `cover_letter_result` | GenerateLetter | Full cover letter draft |
| `msg_result` | GenerateMsg | Short recruiter outreach message |

---

## Nodes

### `ResearchCompany`
- Uses a `createReactAgent` (ReAct loop) with `reasoningLlm` and the `companySearchTool`
- Tool makes three Tavily web searches: what the company does, why they are hiring, and their work culture
- Returns the last message content as `company_result`

### `ResumeFeedback`
- Runs `feedback_prompt` (Senior Technical Recruiter persona) against the resume
- Uses `reasoningLlm` + `StringOutputParser`
- Outputs `feedback_result`

### `CrossRef`
- Runs `cross_reference_prompt` (ATS optimizer persona) with both `job` and `resume`
- Uses `reasoningLlm`
- Outputs `JDMatch_result` — 3 actionable keyword/skill gap suggestions

### `GenerateLetter`
- Depends on `JDMatch_result` + `company_result` being resolved
- Runs `generate_letter_prompt` with all four state fields: job, resume, company_result, JDMatch_result
- Uses `writingLlm` (temperature 0.7 for creative output)
- Outputs `cover_letter_result`

### `GenerateMsg`
- Same dependencies as `GenerateLetter`
- Runs `generate_msg_prompt`, targeting a 75–95 word recruiter message
- Uses `writingLlm`
- Outputs `msg_result`

---

## Graph Topology

```
         START
        /     \
ResumeFeedback  ResearchCompany
      |               |
     END           CrossRef
                  /        \
         GenerateLetter   GenerateMsg
               |               |
              END             END
```

**Parallel at start:** `ResumeFeedback` and `ResearchCompany` fire simultaneously from `START`.

**Sequential chain:** `ResearchCompany` → `CrossRef` → `GenerateLetter` and `GenerateMsg` (fan-out).

**Note:** `ResumeFeedback` ends independently without feeding downstream nodes. It does not block or gate the generation steps.

---

## LLM Configuration

Both LLMs route through OpenRouter (`https://openrouter.ai/api/v1`) using the `ChatOpenAI` client with a custom `baseURL`:

| Variable | Model | Temperature | Use |
|---|---|---|---|
| `reasoningLlm` | `openrouter/free` | 0 | Research, critique, cross-referencing |
| `writingLlm` | `openrouter/free` | 0.7 | Letter and message generation |

---

## PDF Parsing (Current Issue)

```ts
const pdfParser = new PDFParse({ data: arrayBuffer });
const pdfData = await pdfParser.getText();
```

`PDFParse` is imported as a named class from `pdf-parse`, but the actual `pdf-parse` package exports a default function, not a class. This will throw at runtime. The correct usage is:

```ts
import pdfParse from "pdf-parse";
const pdfData = await pdfParse(Buffer.from(arrayBuffer));
const resumeText = pdfData.text;
```

---

## Execution

```ts
const result = await app.invoke({
  job, company, resume: resumeText,
  company_result: "", JDMatch_result: "", feedback_result: "",
  cover_letter_result: "", msg_result: ""
});
return NextResponse.json(result);
```

The compiled graph runs to completion and returns the full state object as JSON. All five result fields should be populated on success.

---

## Issues / Gaps

1. **`PDFParse` import is wrong** — will crash at runtime (see above).
2. **`feedback_prompt` is a placeholder** — the actual prompt string is not filled in; it contains `[Insert your full feedback_prompt string here]`.
3. **`openrouter/free` model name** — OpenRouter's free tier requires a specific model ID (e.g., `meta-llama/llama-3.1-8b-instruct:free`); `openrouter/free` is not a valid model slug.
4. **No streaming** — the entire graph runs synchronously before responding; large LLM chains will hit Vercel/Edge timeout limits.
5. **Graph rebuilt on every request** — nodes, agents, and the workflow are all instantiated inside the POST handler; this adds overhead per request.
6. **`CrossRef` waits on `ResearchCompany`** via the edge `ResearchCompany → CrossRef`, but `CrossRef` only uses `job` and `resume` — it does not actually need `company_result`. The dependency is unnecessary and serializes work that could run in parallel.
