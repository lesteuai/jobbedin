import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { coverLetterHistory, messageGenHistory, resumeJob } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/app/lib/auth';

type ChatLine = {
  role: 'user' | 'ai';
  text: string;
};

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
    const { mode, conversation } = body as {
      mode: 'letter' | 'message';
      conversation: ChatLine[];
    };

    if (!mode || !['letter', 'message'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "letter" or "message"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(conversation)) {
      return NextResponse.json(
        { error: 'conversation must be an array' },
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

    await db.delete(table).where(eq(table.jobId, jobId));
    await db.insert(table).values({ jobId, userId: session.user.id, conversation });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving chat history:', error);
    return NextResponse.json(
      { error: 'Failed to save chat history' },
      { status: 500 }
    );
  }
}
