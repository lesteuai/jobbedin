import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { coverLetterHistory, messageGenHistory, resumeJob, company, jobDescriptionMatch, resume } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/app/lib/auth';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

type ChatLine = {
  role: 'user' | 'ai';
  text: string;
};

const letter_chat_prompt = 'You are a cover letter editor. The user will give feedback on their cover letter. Revise it based on their feedback. Return only the revised letter, under 300 words.';

const message_chat_prompt = 'You are a recruiter message editor. The user will give feedback on their recruiter outreach message. Revise it based on their feedback. Strict limit: 75-100 words. Return only the revised message.';

const writingLlm = new ChatOpenAI({
  modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
  temperature: 0.7,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: jobId } = await params;
    const mode = request.nextUrl.searchParams.get('mode') as 'letter' | 'message' | null;

    if (!mode || !['letter', 'message'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode parameter. Must be "letter" or "message"' },
        { status: 400 }
      );
    }

    const job = await db
      .select()
      .from(resumeJob)
      .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

    if (job.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const table = mode === 'letter' ? coverLetterHistory : messageGenHistory;
    const result = await db.select().from(table).where(eq(table.jobId, jobId));

    if (result.length === 0) {
      return NextResponse.json({ conversation: [] });
    }

    const conversation = result[0].conversation as ChatLine[] | null;
    return NextResponse.json({ conversation: conversation || [] });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: jobId } = await params;
    const body = await request.json();
    const { mode, userMessage, conversation } = body as {
      mode: 'letter' | 'message';
      userMessage?: string;
      conversation?: ChatLine[];
    };

    if (!mode || !['letter', 'message'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "letter" or "message"' },
        { status: 400 }
      );
    }

    const job = await db
      .select()
      .from(resumeJob)
      .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

    if (job.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const table = mode === 'letter' ? coverLetterHistory : messageGenHistory;

    // Legacy path: clear conversation
    if (conversation !== undefined && userMessage === undefined) {
      if (!Array.isArray(conversation)) {
        return NextResponse.json(
          { error: 'conversation must be an array' },
          { status: 400 }
        );
      }

      await db.delete(table).where(eq(table.jobId, jobId));
      await db.insert(table).values({ jobId, userId: session.user.id, conversation });

      return NextResponse.json({ success: true });
    }

    // AI chat path: accept userMessage and call LLM
    if (userMessage !== undefined) {
      // Fetch existing conversation
      const existing = await db.select().from(table).where(eq(table.jobId, jobId));
      const existingConversation = existing.length > 0 ? (existing[0].conversation as ChatLine[] | null) : null;
      const historyLines = existingConversation || [];

      // Convert history to LangChain messages
      const historyMessages = historyLines.map((line) =>
        line.role === 'user' ? new HumanMessage(line.text) : new AIMessage(line.text)
      );

      // Build system prompt
      const systemPrompt = mode === 'letter' ? letter_chat_prompt : message_chat_prompt;

      // Fetch context in parallel: company, jdMatch, and resume
      const [companyRows, jdMatchRows, resumeRows] = await Promise.all([
        db.select().from(company).where(eq(company.jobId, jobId)),
        db.select().from(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId)),
        db.select().from(resume).where(eq(resume.id, job[0].resumeId)),
      ]);

      // Build context string from non-null fields
      const contextParts: string[] = [];
      if (jdMatchRows.length > 0 && jdMatchRows[0].content) {
        contextParts.push(`JD Match info: ${jdMatchRows[0].content}`);
      }
      if (companyRows.length > 0 && companyRows[0].content) {
        contextParts.push(`Company info: ${companyRows[0].content}`);
      }
      if (resumeRows.length > 0 && resumeRows[0].content) {
        contextParts.push(`Resume: ${resumeRows[0].content}`);
      }
      if (job[0].content) {
        contextParts.push(`Job Description: ${job[0].content}`);
      }
      const contextString = contextParts.length > 0 ? contextParts.join('\n\n') : '';
      const fullSystemPrompt = contextString ? `${systemPrompt}\n\n${contextString}` : systemPrompt;

      // Call LLM with history
      const result = await writingLlm.invoke([
        new SystemMessage(fullSystemPrompt),
        ...historyMessages,
        new HumanMessage(userMessage),
      ]);

      const aiReply = typeof result.content === 'string' ? result.content : String(result.content);

      // Build updated conversation
      const updatedConversation: ChatLine[] = [
        ...historyLines,
        { role: 'user', text: userMessage },
        { role: 'ai', text: aiReply },
      ];

      // Upsert to DB (delete old, insert new)
      await db.delete(table).where(eq(table.jobId, jobId));
      await db.insert(table).values({
        jobId,
        userId: session.user.id,
        conversation: updatedConversation,
      });

      return NextResponse.json({ reply: aiReply });
    }

    return NextResponse.json(
      { error: 'Either userMessage or conversation must be provided' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error saving chat history:', error);
    return NextResponse.json(
      { error: 'Failed to save chat history' },
      { status: 500 }
    );
  }
}
