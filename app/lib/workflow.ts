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
  userSettings,
  ProcessType,
  ProcessStatus,
} from '@/app/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  company_prompt,
  cross_reference_prompt,
  generate_letter_prompt,
  generate_msg_prompt,
  feedback_prompt,
} from '@/app/lib/system-prompt';
import {
  createReasoningLlm,
  createWritingLlm,
  isOutOfCreditError,
} from '@/app/lib/openrouter';
import { decrypt } from '@/app/lib/crypto';

interface WorkflowParams {
  jobId: string;
  userId: string;
  resumeText: string;
  jobText: string;
}

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
  const userSettingsRow = await db
    .select({
      customLetterInstructions: userSettings.customLetterInstructions,
      customMsgInstructions: userSettings.customMsgInstructions,
      openrouterApiKey: userSettings.openrouterApiKey,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .then((rows) => rows[0]);

  let userApiKey: string | undefined;
  try {
    userApiKey = userSettingsRow?.openrouterApiKey
      ? decrypt(userSettingsRow.openrouterApiKey)
      : undefined;
  } catch (error) {
    console.error('Failed to decrypt user OpenRouter API key:', error);
    userApiKey = undefined;
  }

  const reasoningLlm = createReasoningLlm(userApiKey);
  const writingLlm = createWritingLlm(userApiKey);

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
        jobId,
        content,
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.Company)
          )
        );

      return { company_result: content };
    } catch (error) {
      const statusReason = isOutOfCreditError(error) ? 'out_of_credit' : null;
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed, statusReason })
        .where(
          and(
            eq(processTable.jobId, jobId),
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
        jobId: jobId,
        content: result,
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.JDMatch)
          )
        );

      return { JDMatch_result: result };
    } catch (error) {
      const statusReason = isOutOfCreditError(error) ? 'out_of_credit' : null;
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed, statusReason })
        .where(
          and(
            eq(processTable.jobId, jobId),
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
        jobId: jobId,
        content: result,
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.ResumeFeedback)
          )
        );

      return { feedback_result: result };
    } catch (error) {
      const statusReason = isOutOfCreditError(error) ? 'out_of_credit' : null;
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed, statusReason })
        .where(
          and(
            eq(processTable.jobId, jobId),
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
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.Letter)
          )
        );

      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          generate_letter_prompt(userSettingsRow?.customLetterInstructions)
        ),
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
        jobId: jobId,
        userId,
        conversation: [{ role: 'ai', text: result }],
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.Letter)
          )
        );

      return { cover_letter_result: result };
    } catch (error) {
      const statusReason = isOutOfCreditError(error) ? 'out_of_credit' : null;
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed, statusReason })
        .where(
          and(
            eq(processTable.jobId, jobId),
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
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.Message)
          )
        );

      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          generate_msg_prompt(userSettingsRow?.customMsgInstructions)
        ),
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
        jobId: jobId,
        userId,
        conversation: [{ role: 'ai', text: result }],
      });

      await db
        .update(processTable)
        .set({ status: ProcessStatus.Done })
        .where(
          and(
            eq(processTable.jobId, jobId),
            eq(processTable.processType, ProcessType.Message)
          )
        );

      return { msg_result: result };
    } catch (error) {
      const statusReason = isOutOfCreditError(error) ? 'out_of_credit' : null;
      await db
        .update(processTable)
        .set({ status: ProcessStatus.Failed, statusReason })
        .where(
          and(
            eq(processTable.jobId, jobId),
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

  try {
    await app.invoke({
      job: jobText,
      resume: resumeText,
      company_result: '',
      JDMatch_result: '',
      feedback_result: '',
      cover_letter_result: '',
      msg_result: '',
    });
  } catch (error) {
    // When an upstream node throws, its dependent nodes never run and their
    // process rows stay pending/processing, so the analysis stream would poll
    // forever. Force any leftover non-terminal rows to failed so the run reaches
    // a terminal state, carrying the out-of-credit reason when it applies.
    const statusReason = isOutOfCreditError(error) ? 'out_of_credit' : null;
    await db
      .update(processTable)
      .set({ status: ProcessStatus.Failed, statusReason })
      .where(
        and(
          eq(processTable.jobId, jobId),
          inArray(processTable.status, [ProcessStatus.Pending, ProcessStatus.Processing])
        )
      );
  }
}
