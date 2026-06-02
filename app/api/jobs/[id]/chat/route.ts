import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { coverLetterHistory, messageGenHistory, resumeJob, company, jobDescriptionMatch, resume } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { generate_letter_prompt, generate_msg_prompt } from '@/app/lib/system-prompt';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';

type ChatLine = {
  role: 'user' | 'ai';
  text: string;
};

const writingLlm = new ChatOpenAI({
  modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
  temperature: 0.7,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
});

export const GET = handleAsyncAuth(async (
  request: NextRequest,
  session,
  { params }: { params: Promise<{ id: string }> }
) => {

  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  const mode = request.nextUrl.searchParams.get('mode') as 'letter' | 'message' | null;

  if (!mode || !['letter', 'message'].includes(mode)) {
    throw new BadRequestException('Invalid mode parameter. Must be "letter" or "message"');
  }

  const job = await db
    .select()
    .from(resumeJob)
    .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

  if (job.length === 0) {
    throw new NotFoundException('Not found');
  }

  const table = mode === 'letter' ? coverLetterHistory : messageGenHistory;
  const result = await db.select().from(table).where(eq(table.jobId, jobId));

  if (result.length === 0) {
    return NextResponse.json({ conversation: [] });
  }

  const conversation = result[0].conversation as ChatLine[] | null;
  return NextResponse.json({ conversation: conversation || [] });
});

export const POST = handleAsyncAuth(async (
  request: NextRequest,
  session,
  { params }: { params: Promise<{ id: string }> }
) => {

  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  const body = await request.json();
  const { mode, userMessage, conversation } = body as {
    mode: 'letter' | 'message';
    userMessage?: string;
    conversation?: ChatLine[];
  };

  if (!mode || !['letter', 'message'].includes(mode)) {
    throw new BadRequestException('Invalid mode. Must be "letter" or "message"');
  }

  const job = await db
    .select()
    .from(resumeJob)
    .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

  if (job.length === 0) {
    throw new NotFoundException('Not found');
  }

  const table = mode === 'letter' ? coverLetterHistory : messageGenHistory;

  // Legacy path: clear conversation
  if (conversation !== undefined && userMessage === undefined) {
    if (!Array.isArray(conversation)) {
      throw new BadRequestException('conversation must be an array');
    }

    await db.delete(table).where(eq(table.jobId, jobId));
    await db.insert(table).values({ jobId, userId: session.user.id, conversation });

    return NextResponse.json({ success: true });
  }

  // AI chat path: accept userMessage and call LLM
  if (userMessage !== undefined) {
    const existing = await db.select().from(table).where(eq(table.jobId, jobId));
    const existingConversation = existing.length > 0 ? (existing[0].conversation as ChatLine[] | null) : null;
    const historyLines = existingConversation || [];

    const historyMessages = historyLines.map((line) =>
      line.role === 'user' ? new HumanMessage(line.text) : new AIMessage(line.text)
    );

    const systemPrompt = mode === 'letter' ? generate_letter_prompt : generate_msg_prompt;

    const [companyRows, jdMatchRows, resumeRows] = await Promise.all([
      db.select().from(company).where(eq(company.jobId, jobId)),
      db.select().from(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId)),
      db.select().from(resume).where(eq(resume.id, job[0].resumeId)),
    ]);

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

    const result = await writingLlm.invoke([
      new SystemMessage(fullSystemPrompt),
      ...historyMessages,
      new HumanMessage(userMessage),
    ]);

    const aiReply = typeof result.content === 'string' ? result.content : String(result.content);

    const updatedConversation: ChatLine[] = [
      ...historyLines,
      { role: 'user', text: userMessage },
      { role: 'ai', text: aiReply },
    ];

    await db.delete(table).where(eq(table.jobId, jobId));
    await db.insert(table).values({
      jobId,
      userId: session.user.id,
      conversation: updatedConversation,
    });

    return NextResponse.json({ reply: aiReply });
  }

  throw new BadRequestException('Either userMessage or conversation must be provided');
});
