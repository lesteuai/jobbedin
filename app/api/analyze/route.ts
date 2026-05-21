// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { PDFParse } from "pdf-parse";

// ---------------------------------------------------------
// 1. Prompts (Copied exactly from your Python script)
// ---------------------------------------------------------
const feedback_prompt = `**System Prompt:** Act as a Senior Technical Recruiter and Career Coach specializing in Computer Science and STEM fields... (Truncated for readability, assume full prompt here)
[Insert your full feedback_prompt string here]`;

const company_prompt = `Act as a Senior Business Analyst. Review the target company and extract a concise summary for a downstream AI writing agent.
Focus strictly on:
1. The company's core mission and primary product.
2. Their cultural values (e.g., 'move fast', 'academic', 'customer-obsessed').
3. Recent strategic news or why they are currently hiring.
Keep it strictly under 150 words.`;

const cross_reference_prompt = `Act as an ATS (Applicant Tracking System) optimizer. Compare the candidate's resume against the target job description.
Identify specific keywords, tools, or critical skills from the job description that are missing from the resume.
Provide exactly 3 actionable suggestions on how the candidate can tweak their existing resume bullets to better match this specific role.`;

const generate_letter_prompt = `Act as an expert Career Coach. Write a highly tailored, professional cover letter for the candidate.
You have been provided with:
1. The candidate's Resume.
2. The exact Job Description.
3. A summary of the Company's culture and goals.
4. Insights mapping the candidate's skills to the role.
INSTRUCTIONS:
- Use the 'Company Summary' to align the tone with their corporate culture.
- Use the 'Cross Reference Insights' to highlight the candidate's most relevant project.
- Keep it under 300 words. No robotic jargon (e.g., 'delve', 'testament').`;

const generate_msg_prompt = `Act as a Career Coach. Write a brief networking message to a recruiter.
INSTRUCTIONS:
- Highlight a match from the 'Cross Reference Insights'.
- Reference a cultural trait or goal from the 'Company Summary' to show insider knowledge.
- STRICT LIMIT: Must be between 75 and 95 words. Do not exceed 100 words.`;

// ---------------------------------------------------------
// 2. LLMs & Tools Configuration
// ---------------------------------------------------------
// We use OpenRouter by pointing the OpenAI client to OpenRouter's API URL
const writingLlm = new ChatOpenAI({
  modelName: "openrouter/free",
  temperature: 0.7,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: "https://openrouter.ai/api/v1" }
});

const reasoningLlm = new ChatOpenAI({
  modelName: "openrouter/free",
  temperature: 0,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: "https://openrouter.ai/api/v1" }
});

const tavily = new TavilySearch({ maxResults: 5 });

const companySearchTool = tool(async ({ query }) => {
  const doRes = await tavily.invoke({query: `What ${query} do in 2025 2026?`});
  const hireRes = await tavily.invoke({query: `Why ${query} are hiring right now?`});
  const cultureRes = await tavily.invoke({query: `What ${query} 's work culture?`});
  return `What they do: ${doRes}\nWhy they are hiring: ${hireRes}\nWork culture: ${cultureRes}`;
}, {
  name: "company_search",
  description: "Search for recent news, hiring trends, and work culture about a company.",
  schema: z.object({ query: z.string() })
});

// ---------------------------------------------------------
// 3. State & Graph Setup
// ---------------------------------------------------------
const AgentState = Annotation.Root({
  job: Annotation<string>(),
  company: Annotation<string>(),
  resume: Annotation<string>(),
  company_result: Annotation<string>(),
  JDMatch_result: Annotation<string>(),
  feedback_result: Annotation<string>(),
  cover_letter_result: Annotation<string>(),
  msg_result: Annotation<string>(),
});

const parser = new StringOutputParser();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const job = formData.get("job") as string;
    const company = formData.get("company") as string;
    const file = formData.get("resume") as File;

    if (!job || !company || !file) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Extract PDF Text
    const arrayBuffer = await file.arrayBuffer();
    const pdfParser = new PDFParse({ data: arrayBuffer });
    const pdfData = await pdfParser.getText();;
    const resumeText = pdfData.text;

    // Define Graph Nodes
    const researchAgent = createReactAgent({
      llm: reasoningLlm,
      tools: [companySearchTool],
      messageModifier: new SystemMessage(company_prompt)
    });

    async function run_ResearchCompany(state: typeof AgentState.State) {
      const res = await researchAgent.invoke({
        messages: [{ role: "user", content: `Find information about ${state.company}` }]
      });
      return { company_result: res.messages[res.messages.length - 1].content };
    }

    async function run_ResumeFeedback(state: typeof AgentState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(feedback_prompt),
        HumanMessagePromptTemplate.fromTemplate("Here is the resume to review: {resume}")
      ]);
      const chain = prompt.pipe(reasoningLlm).pipe(parser);
      return { feedback_result: await chain.invoke({ resume: state.resume }) };
    }

    async function run_CrossRef(state: typeof AgentState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(cross_reference_prompt),
        HumanMessagePromptTemplate.fromTemplate("Job description: {job}\n\nResume: {resume}")
      ]);
      const chain = prompt.pipe(reasoningLlm).pipe(parser);
      return { JDMatch_result: await chain.invoke({ job: state.job, resume: state.resume }) };
    }

    async function run_GenerateLetter(state: typeof AgentState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(generate_letter_prompt),
        HumanMessagePromptTemplate.fromTemplate("JD Match info: {JDMatch_result}\nCompany info: {company_result}\nResume: {resume}\nJob Description: {job}")
      ]);
      const chain = prompt.pipe(writingLlm).pipe(parser);
      return { cover_letter_result: await chain.invoke(state) };
    }

    async function run_GenerateMsg(state: typeof AgentState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(generate_msg_prompt),
        HumanMessagePromptTemplate.fromTemplate("JD Match info: {JDMatch_result}\nCompany info: {company_result}\nResume: {resume}\nJob Description: {job}")
      ]);
      const chain = prompt.pipe(writingLlm).pipe(parser);
      return { msg_result: await chain.invoke(state) };
    }

    // Build Graph
    const workflow = new StateGraph(AgentState)
      .addNode("ResearchCompany", run_ResearchCompany)
      .addNode("ResumeFeedback", run_ResumeFeedback)
      .addNode("CrossRef", run_CrossRef)
      .addNode("GenerateLetter", run_GenerateLetter)
      .addNode("GenerateMsg", run_GenerateMsg)

      // Parallel start
      .addEdge(START, "ResumeFeedback")
      .addEdge(START, "ResearchCompany")
      
      // Sequence the rest to ensure dependencies are resolved without double-execution
      .addEdge("ResearchCompany", "CrossRef") 
      .addEdge("CrossRef", "GenerateLetter")
      .addEdge("CrossRef", "GenerateMsg")

      // Endings
      .addEdge("ResumeFeedback", END)
      .addEdge("GenerateLetter", END)
      .addEdge("GenerateMsg", END);

    const app = workflow.compile();

    // Execute Graph
    const result = await app.invoke({
      job, company, resume: resumeText,
      company_result: "", JDMatch_result: "", feedback_result: "",
      cover_letter_result: "", msg_result: ""
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error analyzing:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
