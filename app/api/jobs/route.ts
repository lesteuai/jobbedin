import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resumeJob } from '@/app/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { auth } from '@/app/lib/auth';
import { handleAsync } from '@/app/lib/api-handler';

export const GET = handleAsync(async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resumeId = request.nextUrl.searchParams.get('resumeId');

  if (!resumeId) {
    return NextResponse.json(
      { error: 'resumeId query parameter is required' },
      { status: 400 }
    );
  }

  const jobs = await db
    .select({
      id: resumeJob.id,
      name: resumeJob.name,
      resumeId: resumeJob.resumeId,
      createdAt: resumeJob.createdAt,
      updatedAt: resumeJob.updatedAt,
    })
    .from(resumeJob)
    .where(and(eq(resumeJob.resumeId, resumeId), eq(resumeJob.userId, session.user.id)))
    .orderBy(resumeJob.createdAt);

  return NextResponse.json(jobs);
});

export const POST = handleAsync(async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { resumeId, content } = body;

  if (!resumeId || !content) {
    return NextResponse.json(
      { error: 'resumeId and content are required' },
      { status: 400 }
    );
  }

  const existingCount = await db
    .select({ count: count() })
    .from(resumeJob)
    .where(eq(resumeJob.resumeId, resumeId));

  const jobNumber = (existingCount[0]?.count || 0) + 1;
  const name = `Job ${jobNumber}`;

  const newJob = await db
    .insert(resumeJob)
    .values({
      id: randomUUID(),
      userId: session.user.id,
      resumeId,
      name,
      content,
    })
    .returning({
      id: resumeJob.id,
      name: resumeJob.name,
      content: resumeJob.content,
      resumeId: resumeJob.resumeId,
      createdAt: resumeJob.createdAt,
    });

  return NextResponse.json(newJob[0], { status: 201 });
});
