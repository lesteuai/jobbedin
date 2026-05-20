import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resume } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/app/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db
    .select()
    .from(resume)
    .where(and(eq(resume.id, id), eq(resume.userId, session.user.id)));

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing[0].userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.delete(resume).where(eq(resume.id, id));

  return NextResponse.json({ success: true });
}
