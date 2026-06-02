import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resume } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';

async function getExistingResume(id: string, userId: string) {
  const result = await db
    .select()
    .from(resume)
    .where(and(eq(resume.id, id), eq(resume.userId, userId)));

  return result.length > 0 ? result[0] : undefined;
}

export const GET = handleAsyncAuth(async (
  request: NextRequest,
  session,
  { params }: { params: Promise<{ id: string }> }
) => {

  const { id } = await params;

  if (!id) {
    throw new BadRequestException('id query parameter is required');
  }

  const existing = await getExistingResume(id, session.user.id);

  if (!existing) {
    throw new NotFoundException('Not found');
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
    throw new BadRequestException('id is required');
  }

  const existing = await getExistingResume(id, session.user.id);

  if (!existing) {
    throw new NotFoundException('Not found');
  }

  await db.delete(resume).where(eq(resume.id, id));

  return NextResponse.json({ success: true });
});
