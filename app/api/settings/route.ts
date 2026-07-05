import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { userSettings } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { handleAsyncAuth } from '@/app/lib/api-handler';

export const GET = handleAsyncAuth(async (request: NextRequest, session) => {
  const rows = await db
    .select({
      customLetterInstructions: userSettings.customLetterInstructions,
      customMsgInstructions: userSettings.customMsgInstructions,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  return NextResponse.json(
    rows[0] ?? { customLetterInstructions: '', customMsgInstructions: '' }
  );
});

export const PUT = handleAsyncAuth(async (request: NextRequest, session) => {
  const body = await request.json();
  const customLetterInstructions = typeof body.customLetterInstructions === 'string'
    ? body.customLetterInstructions
    : '';
  const customMsgInstructions = typeof body.customMsgInstructions === 'string'
    ? body.customMsgInstructions
    : '';

  await db
    .insert(userSettings)
    .values({
      userId: session.user.id,
      customLetterInstructions,
      customMsgInstructions,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { customLetterInstructions, customMsgInstructions },
    });

  return NextResponse.json({ success: true });
});
