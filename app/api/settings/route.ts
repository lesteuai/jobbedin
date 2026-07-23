import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { userSettings } from '@/app/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { handleAsyncAuth } from '@/app/lib/api-handler';
import { encrypt } from '@/app/lib/crypto';

export const GET = handleAsyncAuth(async (request: NextRequest, session) => {
  const rows = await db
    .select({
      customLetterInstructions: userSettings.customLetterInstructions,
      customMsgInstructions: userSettings.customMsgInstructions,
      hasOpenrouterApiKey: sql<boolean>`${userSettings.openrouterApiKey} IS NOT NULL`,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  const row = rows[0];
  return NextResponse.json({
    customLetterInstructions: row?.customLetterInstructions ?? '',
    customMsgInstructions: row?.customMsgInstructions ?? '',
    hasOpenrouterApiKey: row?.hasOpenrouterApiKey ?? false,
  });
});

export const PUT = handleAsyncAuth(async (request: NextRequest, session) => {
  const body = await request.json();

  // Each field is only touched when its intent is present in the body, so
  // saving the API key never clobbers instructions (and vice versa).
  const hasLetterInstructions = typeof body.customLetterInstructions === 'string';
  const hasMsgInstructions = typeof body.customMsgInstructions === 'string';
  const customLetterInstructions = hasLetterInstructions ? body.customLetterInstructions : '';
  const customMsgInstructions = hasMsgInstructions ? body.customMsgInstructions : '';

  const trimmedApiKey = typeof body.openrouterApiKey === 'string' ? body.openrouterApiKey.trim() : '';
  const shouldSetApiKey = trimmedApiKey.length > 0;
  const shouldClearApiKey = body.clearOpenrouterApiKey === true;
  const encryptedApiKey = shouldSetApiKey ? encrypt(trimmedApiKey) : null;

  const updateSet: {
    customLetterInstructions?: string;
    customMsgInstructions?: string;
    openrouterApiKey?: string | null;
  } = {};

  if (hasLetterInstructions) {
    updateSet.customLetterInstructions = customLetterInstructions;
  }
  if (hasMsgInstructions) {
    updateSet.customMsgInstructions = customMsgInstructions;
  }
  if (shouldSetApiKey) {
    updateSet.openrouterApiKey = encryptedApiKey;
  } else if (shouldClearApiKey) {
    updateSet.openrouterApiKey = null;
  }

  // Nothing to change: avoid bumping the row for a no-op request.
  if (Object.keys(updateSet).length === 0) {
    return NextResponse.json({ success: true });
  }

  const insertValues: {
    userId: string;
    customLetterInstructions: string;
    customMsgInstructions: string;
    openrouterApiKey?: string | null;
  } = {
    userId: session.user.id,
    customLetterInstructions,
    customMsgInstructions,
  };
  if (shouldSetApiKey) {
    insertValues.openrouterApiKey = encryptedApiKey;
  }

  await db
    .insert(userSettings)
    .values(insertValues)
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: updateSet,
    });

  return NextResponse.json({ success: true });
});
