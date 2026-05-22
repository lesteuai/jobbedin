import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { TavilySearch } from '@langchain/tavily';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';
import { db } from '@/app/lib/db';
import {
  company,
  jobDescriptionMatch,
  resumeFeedback,
  coverLetterHistory,
  messageGenHistory,
  process as processTable,
  ProcessType,
  ProcessStatus,
} from '@/app/lib/db/schema';
import { and, eq } from 'drizzle-orm';

interface WorkflowParams {
  jobId: string;
  userId: string;
  resumeText: string;
  jobText: string;
}

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

const feedback_prompt = `You are a Senior Technical Recruiter and Career Coach specializing in Computer Science and STEM. Review the resume critically and constructively. Cover: (1) Overall Impact - does it immediately communicate value? (2) Bullet Quality - are bullets achievement-focused with metrics? Flag vague bullets and suggest concrete rewrites. (3) Skills Representation - are technical skills current and relevant? Are important skills buried or missing? (4) Structure and Scannability - can a recruiter scan this in 10 seconds and know what this person does? (5) Quick Wins - list 3-5 specific actionable changes to most improve performance. Be direct and specific. Reference actual content from the resume.`;

const reasoningLlm = new ChatOpenAI({
  modelName: process.env.REASONING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free',
  temperature: 0,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});

const writingLlm = new ChatOpenAI({
  modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free',
  temperature: 0.7,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});

const tavily = new TavilySearch({ maxResults: 5 });

const companySearchTool = tool(
  async ({ query }) => {
    const doRes = await tavily.invoke({
      query: `What ${query} do in 2025 2026?`,
    });
    const hireRes = await tavily.invoke({
      query: `Why ${query} are hiring right now?`,
    });
    const cultureRes = await tavily.invoke({
      query: `What ${query}'s work culture?`,
    });
    return `What they do: ${doRes}\nWhy they are hiring: ${hireRes}\nWork culture: ${cultureRes}`;
  },
  {
    name: 'company_search',
    description:
      'Search for recent news, hiring trends, and work culture about a company.',
    schema: z.object({ query: z.string() }),
  }
);

const AgentState = Annotation.Root({
  job: Annotation<string>(),
  resume: Annotation<string>(),
  company_result: Annotation<string>(),
  JDMatch_result: Annotation<string>(),
  feedback_result: Annotation<string>(),
  cover_letter_result: Annotation<string>(),
  msg_result: Annotation<string>(),
});

const parser = new StringOutputParser();

export async function runWorkflow({
  jobId,
  userId,
  resumeText,
  jobText,
}: WorkflowParams): Promise<void> {
  const run_ResearchCompany = async (state: typeof AgentState.State) => {
    try {
      const researchAgent = createReactAgent({
        llm: reasoningLlm,
        tools: [companySearchTool],
        messageModifier: new SystemMessage(company_prompt),
      });

      const res = await researchAgent.invoke({
        messages: [
          {
            role: 'user',
            content:
              'Find information about the company in this job description:\n\n' +
              state.job,
          },
        ],
      });

      const content = String(res.messages[res.messages.length - 1].content);

      await db.insert(company).values({
        id: randomUUID(),
        userId,
        jobId: jobId as any,
        content,
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Company)
          )
        );

      return { company_result: content };
    } catch (error) {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Company)
          )
        );
      throw error;
    }
  };

  const run_CrossRef = async (state: typeof AgentState.State) => {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(cross_reference_prompt),
        HumanMessagePromptTemplate.fromTemplate(
          'Job description: {job}\n\nResume: {resume}'
        ),
      ]);
      const chain = prompt.pipe(reasoningLlm).pipe(parser);
      const result = await chain.invoke({
        job: state.job,
        resume: state.resume,
      });

      await db.insert(jobDescriptionMatch).values({
        id: randomUUID(),
        userId,
        jobId: jobId as any,
        content: result,
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.JDMatch)
          )
        );

      return { JDMatch_result: result };
    } catch (error) {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.JDMatch)
          )
        );
      throw error;
    }
  };

  const run_ResumeFeedback = async (state: typeof AgentState.State) => {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(feedback_prompt),
        HumanMessagePromptTemplate.fromTemplate(
          'Here is the resume to review: {resume}'
        ),
      ]);
      const chain = prompt.pipe(reasoningLlm).pipe(parser);
      const result = await chain.invoke({ resume: state.resume });

      await db.insert(resumeFeedback).values({
        id: randomUUID(),
        userId,
        jobId: jobId as any,
        content: result,
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.ResumeFeedback)
          )
        );

      return { feedback_result: result };
    } catch (error) {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.ResumeFeedback)
          )
        );
      throw error;
    }
  };

  const run_GenerateLetter = async (state: typeof AgentState.State) => {
    try {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Processing })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Letter)
          )
        );

      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(generate_letter_prompt),
        HumanMessagePromptTemplate.fromTemplate(
          'JD Match info: {JDMatch_result}\nCompany info: {company_result}\nResume: {resume}\nJob Description: {job}'
        ),
      ]);
      const chain = prompt.pipe(writingLlm).pipe(parser);
      const result = await chain.invoke({
        JDMatch_result: state.JDMatch_result,
        company_result: state.company_result,
        resume: state.resume,
        job: state.job,
      });

      await db.insert(coverLetterHistory).values({
        jobId: jobId as any,
        userId,
        conversation: [{ role: 'ai', text: result }],
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Letter)
          )
        );

      return { cover_letter_result: result };
    } catch (error) {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Letter)
          )
        );
      throw error;
    }
  };

  const run_GenerateMsg = async (state: typeof AgentState.State) => {
    try {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Processing })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Message)
          )
        );

      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(generate_msg_prompt),
        HumanMessagePromptTemplate.fromTemplate(
          'JD Match info: {JDMatch_result}\nCompany info: {company_result}\nResume: {resume}\nJob Description: {job}'
        ),
      ]);
      const chain = prompt.pipe(writingLlm).pipe(parser);
      const result = await chain.invoke({
        JDMatch_result: state.JDMatch_result,
        company_result: state.company_result,
        resume: state.resume,
        job: state.job,
      });

      await db.insert(messageGenHistory).values({
        jobId: jobId as any,
        userId,
        conversation: [{ role: 'ai', text: result }],
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Message)
          )
        );

      return { msg_result: result };
    } catch (error) {
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed })
        .where(
          and(
            eq(processTable.jobId, jobId as any),
            eq(processTable.processType, ProcessType.Message)
          )
        );
      throw error;
    }
  };

  const workflow = new StateGraph(AgentState)
    .addNode('ResearchCompany', run_ResearchCompany)
    .addNode('CrossRef', run_CrossRef)
    .addNode('ResumeFeedback', run_ResumeFeedback)
    .addNode('GenerateLetter', run_GenerateLetter)
    .addNode('GenerateMsg', run_GenerateMsg)
    .addEdge(START, 'ResearchCompany')
    .addEdge(START, 'CrossRef')
    .addEdge(START, 'ResumeFeedback')
    .addEdge('ResumeFeedback', END)
    .addEdge('ResearchCompany', 'GenerateLetter')
    .addEdge('CrossRef', 'GenerateLetter')
    .addEdge('ResearchCompany', 'GenerateMsg')
    .addEdge('CrossRef', 'GenerateMsg')
    .addEdge('GenerateLetter', END)
    .addEdge('GenerateMsg', END);

  const app = workflow.compile();

  await app.invoke({
    job: jobText,
    resume: resumeText,
    company_result: '',
    JDMatch_result: '',
    feedback_result: '',
    cover_letter_result: '',
    msg_result: '',
  });
}
