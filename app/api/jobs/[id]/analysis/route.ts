import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { company, jobDescriptionMatch, resumeFeedback, coverLetterHistory, messageGenHistory, process as processTable, resumeJob } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';

export const GET = handleAsyncAuth(async (request: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {

  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  const job = await db
    .select()
    .from(resumeJob)
    .where(and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)));

  if (job.length === 0) {
    throw new NotFoundException('Not found');
  }

  const [companyRow, jdMatchRow, feedbackRow, letterRow, messageRow, processes] = await Promise.all([
    db.select().from(company).where(eq(company.jobId, jobId)).then(rows => rows[0]),
    db.select().from(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId)).then(rows => rows[0]),
    db.select().from(resumeFeedback).where(eq(resumeFeedback.jobId, jobId)).then(rows => rows[0]),
    db.select().from(coverLetterHistory).where(eq(coverLetterHistory.jobId, jobId)).then(rows => rows[0]),
    db.select().from(messageGenHistory).where(eq(messageGenHistory.jobId, jobId)).then(rows => rows[0]),
    db.select().from(processTable).where(eq(processTable.jobId, jobId)),
  ]);

  return NextResponse.json({
    company: companyRow?.content || null,
    jdMatch: jdMatchRow?.content || null,
    feedback: feedbackRow?.content || null,
    letterConversation: letterRow?.conversation ?? null,
    messageConversation: messageRow?.conversation ?? null,
    processes: processes.map((p) => ({
      processType: p.processType,
      status: p.status,
    })),
  });
});
