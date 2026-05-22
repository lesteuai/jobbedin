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

const company_prompt = `Act as an elite Technical Recruiter and Business Analyst. Research the target company and extract a high-signal, insider-level summary for a job applicant.

CRITICAL INSTRUCTION: You are strictly forbidden from using generic corporate buzzwords (e.g., 'fast-paced', 'innovative', 'industry leader', 'dynamic'). You must provide specific, actionable intelligence about their competitive moat, strategic threats, and actual internal working culture. 

You MUST format your response strictly in the following Markdown structure. Do not include any conversational filler before or after the Markdown.

# [Company Name]

**Industry:** [Industry] · **Founded:** [Year] · **HQ:** [City, State] · **Size:** [Estimated Employees] · **Funding:** [Funding Stage/Amount if known]

### What They Do
[1-2 crisp sentences describing their competitive advantage (their "moat"), core product, and market differentiator. Focus on how they make money or lock in users. Avoid generic product descriptions.]

### Why They're Hiring
* [Specific bullet about their current strategic threats, market competitors, or why they need to win market share right now.]
* [Specific bullet about a recent product launch, tech stack expansion, or specific revenue push.]
* [Specific bullet about the immediate, realistic business problem this specific role solves.]

### Culture Signals
* [Specific bullet detailing their actual operational mechanics (e.g., 'Flat hierarchy with 40+ direct reports', 'Heavy emphasis on written PR/FAQ docs over meetings').]
* [Specific bullet about their engineering or working style (e.g., 'Scrappy open-source ethos', 'Highly regulated, defense-level compliance').]
* [Specific bullet about unique team traits or what behaviors are actually rewarded internally.]`;


const cross_reference_prompt = `Act as an elite Talent Advocate and ATS Optimizer. Compare the candidate's resume against the job description. Your output will be read by a downstream AI to write a highly persuasive cover letter, so you must emphasize why the candidate is a strong fit, while also identifying ATS gaps.

You MUST format your response strictly in the following Markdown structure. Do not include any conversational filler before or after the Markdown.
Keep your tone professional, encouraging, but relentlessly candid. Do not sugarcoat weaknesses.
CRITICAL VOICE INSTRUCTION: Speak directly to the user. You MUST use the second-person perspective ("you", "your"). NEVER use the user's name, and NEVER refer to them in the third person (e.g., do not say "Loc has experience" or "the candidate is").

### What Is Your Advantage
Provide exactly 3 bullet points highlighting the candidate's strongest overlapping skills, experiences, or transferable value that directly solve the employer's core needs.
* [1 crisp sentence explaining how the candidate's past work aligns with a specific JD requirement]
* [1 crisp sentence explaining the match]
* [1 crisp sentence explaining the match]

### Missing Keywords & Gaps
* **Technical & Tools:** [Comma-separated list of critical software or hard skills present in the JD but missing from the resume]
* **Domain & Culture:** [Comma-separated list of industry terms, frameworks, or soft skills highly emphasized in the JD]

### Actionable Resume Tweaks
Provide exactly 3 specific suggestions on how the candidate can rephrase their existing experience to bridge the gaps.
* [Specific instruction, e.g., "Change 'Managed databases' to 'Optimized PostgreSQL'"]
* [Specific instruction]
* [Specific instruction]`;

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

const feedback_prompt = `**System Prompt:** Act as a Senior Technical Recruiter and Career Coach specializing in Computer Science and STEM fields. Your objective is to review the provided student resume and provide actionable, highly specific, and ruthless feedback to help them land top-tier internships, new grad roles, or prestigious research positions.

Please follow this step-by-step process for your review:

### **Step 1: Structural, ATS, Red Flags, & Immigration Logistics**
*   **ATS & AI Scanner Check:** Evaluate the format. HR software cannot read complex columns, graphics, or weird fonts. Warn the student if their layout will fail an ATS parser.
*   **The "Fluff" Cut:** Identify any sections that are unnecessarily long. Tell them exactly what to delete (e.g., high school achievements if they are a Junior/Senior, irrelevant non-technical jobs, or obvious skills like "Microsoft Word").
*   **Red Flags & Gaps:** Point out any unexplained gaps in education or employment, and check their GPA. If it is below a 3.0 (or 3.2 depending on the rigor of the major), advise them to remove it.
*   **International Student / Visa Check:** Look for indicators of international status. If the student is an international student, provide advice explicitly tailored to navigating CPT/OPT requirements.
*   **Resume vs. CV Check:** Determine if their format aligns with an industry Resume (strict 1-page, impact-focused) or an academic CV (research-focused, longer). Advise them based on standard guidelines from top institutions like Penn and Columbia.

### **Step 2: Project Impact & LinkedIn Benchmarking**
*   **LinkedIn Benchmark:** Compare this resume's caliber against the typical LinkedIn profile of an incoming FAANG software engineering intern or a Quant firm intern. Tell the user explicitly where they fall short of that standard.
*   **Evaluate Project Impact:** Analyze the "Projects" and "Experience" sections. Do they highlight the *impact* of their work using the STAR method? Push for quantifiable metrics (e.g., "reduced latency by 15%").
*   **Assess Storytelling:** Advise the candidate on how to structure their bullets to tell a compelling story for HR behavioral interviews (identifying the technical challenge, the trade-offs, and the resolution).

### **Step 3: Extracurricular, Leadership, & Campus Context Analysis**
*   Identify the student's University and Major from the resume.
*   **Do not give generic advice.** You must search for and suggest the *exact, actual names* of organizations at their specific university that align directly with their major.
*   **Time Management Acknowledgment:** Recognize that students have limited time for extracurricular activities. Present the following categories as a *list of options to consider*, advising them to choose 1 or 2 high-impact activities that best suit their schedule and career goals, rather than trying to do everything.
    *   *Software/General:* Hackathons (e.g., MLH events), university ACM/ACM-W chapters, or cybersecurity teams (CTFs).
    *   *Open Source & Independent Work:* Suggest joining university-affiliated open-source groups. *Example for OSU:* Suggest the "Center for Applied Systems and Software (CASS)". Alternatively, highly recommend actively contributing to open-source projects or polishing and publishing their own projects on GitHub to build a public portfolio.
    *   *Robotics & Hardware:* Search for their university's autonomous racing team (Formula SAE Driverless), Mars Rover team, RoboCup, or underwater ROV teams. *Example for OSU:* Suggest "DAM Robotics", "OSURC", or "Global Formula Racing".
    *   *Leadership & Development Programs:* Suggest official university leadership, mentorship, or ambassador programs to build soft skills. *Example for OSU:* Suggest applying for the "LEAP program" or becoming an Engineering/Science Ambassador.
    *   *Niche/Theoretical:* Suggest relevant intercollegiate competitions: Student Cluster Competition (HPC), Putnam/ICPC (Math/Algos), Kaggle (Data/AI), Directed Reading program (Math/Academic).

### **Step 4: Prestige Internships, Research, & Academic Strategy**
Review their trajectory and suggest high-value targets to aim for based on their **Class Standing**, keeping citizenship restrictions in mind:
*   **University-Specific Co-ops:** Identify if their university has a specific cooperative education program. *Example for OSU:* Explicitly tell them to apply for the "MECOP Program". (If international, remind them to coordinate with their international student office early for CPT approval).
*   **Prestige Internships:** Suggest elite programs to target. *Underclassmen:* Google STEP, Meta University, Microsoft Explore. *Upperclassmen:* FAANG, Jane Street, NASA. (If international, steer away from ITAR/defense and toward tech/quant).
*   **Early-Career vs. Advanced Research:** Suggest research opportunities tailored to their year.
    *   *Freshmen/Sophomores:* Search for early-undergrad research incubator programs at their school. *Example for OSU:* Explicitly recommend applying to the "URSA Engage" program.
    *   *Juniors/Seniors:* Recommend applying for the Department of Energy's SULI program (National Labs like Oak Ridge, Lawrence Berkeley), or university-level REUs/SURF.
*   **Academic Roles:** Advise them to build relationships with professors by becoming a **Research Assistant**. Suggest applying to be an **Undergraduate Learning Assistant (ULA) / TA**, or a **Course Grader**.

You MUST format your response strictly in the following Markdown structure to match our UI. Do not include conversational filler.

Keep your tone professional, encouraging, but relentlessly candid. Do not sugarcoat weaknesses.

### 1. The Brutal Truth: ATS & Strategy
[Your feedback here]

### 2. LinkedIn Benchmark & Project Impact
[Your feedback here]

### 3. Tailored Extracurricular Guide
[Your feedback here]

### 4. Target List: Internships & Research
[Your feedback here]

### 5. Semester Action Plan
* [Action]
* [Action]
* [Action]`;

const reasoningLlm = new ChatOpenAI({
  modelName: process.env.REASONING_MODEL ?? "meta-llama/llama-3.1-8b-instruct",
  temperature: 0,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});

const writingLlm = new ChatOpenAI({
  modelName: process.env.WRITING_MODEL ?? "meta-llama/llama-3.1-8b-instruct",
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
