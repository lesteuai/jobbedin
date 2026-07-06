import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { userSettings } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { handleAsyncAuth } from '@/app/lib/api-handler';
import { encrypt } from '@/app/lib/crypto';

export const GET = handleAsyncAuth(async (request: NextRequest, session) => {
  const rows = await db
    .select({
      customLetterInstructions: userSettings.customLetterInstructions,
      customMsgInstructions: userSettings.customMsgInstructions,
      openrouterApiKey: userSettings.openrouterApiKey,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  const row = rows[0];
  return NextResponse.json({
    customLetterInstructions: row?.customLetterInstructions ?? '',
    customMsgInstructions: row?.customMsgInstructions ?? '',
    hasOpenrouterApiKey: typeof row?.openrouterApiKey === 'string' && row.openrouterApiKey.length > 0,
  });
});

export const PUT = handleAsyncAuth(async (request: NextRequest, session) => {
  const body = await request.json();
  const customLetterInstructions = typeof body.customLetterInstructions === 'string'
    ? body.customLetterInstructions
    : '';
  const customMsgInstructions = typeof body.customMsgInstructions === 'string'
    ? body.customMsgInstructions
    : '';

  const trimmedApiKey = typeof body.openrouterApiKey === 'string' ? body.openrouterApiKey.trim() : '';
  const shouldSetApiKey = trimmedApiKey.length > 0;
  const shouldClearApiKey = body.clearOpenrouterApiKey === true;
  const encryptedApiKey = shouldSetApiKey ? encrypt(trimmedApiKey) : null;

  const updateSet: {
    customLetterInstructions: string;
    customMsgInstructions: string;
    openrouterApiKey?: string | null;
  } = { customLetterInstructions, customMsgInstructions };

  if (shouldSetApiKey) {
    updateSet.openrouterApiKey = encryptedApiKey;
  } else if (shouldClearApiKey) {
    updateSet.openrouterApiKey = null;
  }

  await db
    .insert(userSettings)
    .values({
      userId: session.user.id,
      customLetterInstructions,
      customMsgInstructions,
      openrouterApiKey: shouldSetApiKey ? encryptedApiKey : null,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: updateSet,
    });

  return NextResponse.json({ success: true });
});
