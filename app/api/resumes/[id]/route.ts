import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resume } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.delete(resume).where(eq(resume.id, id));

  return NextResponse.json({ success: true });
}
