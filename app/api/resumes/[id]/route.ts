import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resume } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/app/lib/auth';

async function getExistingResume(id: string, userId: string) {
  const result = await db
    .select()
    .from(resume)
    .where(and(eq(resume.id, id), eq(resume.userId, userId)));
  
  return result.length > 0 ? result[0] : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getExistingResume(id, session.user.id);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(existing);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await getExistingResume(id, session.user.id);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(resume).where(eq(resume.id, id));

  return NextResponse.json({ success: true });
}
