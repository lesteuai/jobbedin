import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resumeJob } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleAsyncAuth } from '@/app/lib/api-handler';

async function getExistingJob(id: string, userId: string) {
  const result = await db
    .select()
    .from(resumeJob)
    .where(and(eq(resumeJob.id, id), eq(resumeJob.userId, userId)));

  return result.length > 0 ? result[0] : undefined;
}

export const GET = handleAsyncAuth(async (
  request: NextRequest,
  session,
  { params }: { params: Promise<{ id: string }> }
) => {

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'id query parameter is required' },
      { status: 400 }
    );
  }

  const existing = await getExistingJob(id, session.user.id);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(existing);
});

export const DELETE = handleAsyncAuth(async (
  request: NextRequest,
  session,
  { params }: { params: Promise<{ id: string }> }
) => {

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const existing = await getExistingJob(id, session.user.id);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(resumeJob).where(eq(resumeJob.id, id));

  return NextResponse.json({ success: true });
});
