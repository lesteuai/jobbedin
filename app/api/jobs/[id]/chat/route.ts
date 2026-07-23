import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { coverLetterHistory, messageGenHistory, resumeJob, company, jobDescriptionMatch, resume, userSettings, ProcessType } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { generate_letter_prompt, generate_msg_prompt } from '@/app/lib/system-prompt';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';
import { createWritingLlm, isOutOfCreditError } from '@/app/lib/openrouter';
import { decrypt } from '@/app/lib/crypto';

type ChatLine = {
  role: 'user' | 'ai';
  text: string;
};

type ChatMode = typeof ProcessType.Letter | typeof ProcessType.Message;

export const GET = handleAsyncAuth(async (
  request: NextRequest,
  session,
  { params }: { params: Promise<{ id: string }> }
) => {

  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  const mode = request.nextUrl.searchParams.get('mode') as ChatMode | null;

  if (!mode || ![ProcessType.Letter, ProcessType.Message].includes(mode)) {
    throw new BadRequestException('Invalid mode parameter. Must be "letter" or "message"');
  }

  const job = await db
    .select()
    .from(resumeJob)
    .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

  if (job.length === 0) {
    throw new NotFoundException('Not found');
  }

  const table = mode === ProcessType.Letter ? coverLetterHistory : messageGenHistory;
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
    mode: ChatMode;
    userMessage?: string;
    conversation?: ChatLine[];
  };

  if (!mode || ![ProcessType.Letter, ProcessType.Message].includes(mode)) {
    throw new BadRequestException('Invalid mode. Must be "letter" or "message"');
  }

  const job = await db
    .select()
    .from(resumeJob)
    .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

  if (job.length === 0) {
    throw new NotFoundException('Not found');
  }

  const table = mode === ProcessType.Letter ? coverLetterHistory : messageGenHistory;

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

    const [companyRows, jdMatchRows, resumeRows, userSettingsRows] = await Promise.all([
      db.select().from(company).where(eq(company.jobId, jobId)),
      db.select().from(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId)),
      db.select().from(resume).where(eq(resume.id, job[0].resumeId)),
      db.select().from(userSettings).where(eq(userSettings.userId, session.user.id)),
    ]);

    const settingsRow = userSettingsRows[0];

    let userApiKey: string | undefined;
    if (settingsRow?.openrouterApiKey) {
      try {
        userApiKey = decrypt(settingsRow.openrouterApiKey);
      } catch (e) {
        console.error('Failed to decrypt user OpenRouter key:', e);
      }
    }
    const writingLlm = createWritingLlm(userApiKey);

    const systemPrompt = mode === ProcessType.Letter
      ? generate_letter_prompt(settingsRow?.customLetterInstructions)
      : generate_msg_prompt(settingsRow?.customMsgInstructions);

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

    let result;
    try {
      result = await writingLlm.invoke([
        new SystemMessage(fullSystemPrompt),
        ...historyMessages,
        new HumanMessage(userMessage),
      ]);
    } catch (error) {
      if (isOutOfCreditError(error)) {
        return NextResponse.json(
          { error: 'OpenRouter is out of credit. Add your own OpenRouter API key in Settings to continue.' },
          { status: 402 }
        );
      }
      throw error;
    }

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
