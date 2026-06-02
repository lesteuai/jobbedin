import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import {
  resumeJob,
  resume,
  company,
  jobDescriptionMatch,
  resumeFeedback,
  coverLetterHistory,
  messageGenHistory,
  process as processTable,
  ProcessType,
  ProcessStatus,
} from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { runWorkflow } from '@/app/lib/workflow';
import { randomUUID } from 'crypto';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';

export const POST = handleAsyncAuth(async (request: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {

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

  const processes = await db
    .select()
    .from(processTable)
    .where(eq(processTable.jobId, jobId));

  if (
    processes.length === 5 &&
    processes.every((p) => p.status === ProcessStatus.Done)
  ) {
    return NextResponse.json({ status: 'done' });
  }

  const [resumeRow] = await db
    .select()
    .from(resume)
    .where(eq(resume.id, job[0].resumeId));

  await Promise.all([
    db.delete(company).where(eq(company.jobId, jobId)),
    db.delete(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId)),
    db.delete(resumeFeedback).where(eq(resumeFeedback.jobId, jobId)),
    db.delete(coverLetterHistory).where(eq(coverLetterHistory.jobId, jobId)),
    db.delete(messageGenHistory).where(eq(messageGenHistory.jobId, jobId)),
    db.delete(processTable).where(eq(processTable.jobId, jobId)),
  ]);

  await Promise.all([
    db.insert(processTable).values({
      id: randomUUID(),
      userId: session.user.id,
      jobId,
      processType: ProcessType.Company,
      status: ProcessStatus.Processing,
    }),
    db.insert(processTable).values({
      id: randomUUID(),
      userId: session.user.id,
      jobId,
      processType: ProcessType.JDMatch,
      status: ProcessStatus.Processing,
    }),
    db.insert(processTable).values({
      id: randomUUID(),
      userId: session.user.id,
      jobId,
      processType: ProcessType.ResumeFeedback,
      status: ProcessStatus.Processing,
    }),
    db.insert(processTable).values({
      id: randomUUID(),
      userId: session.user.id,
      jobId,
      processType: ProcessType.Letter,
      status: ProcessStatus.Pending,
    }),
    db.insert(processTable).values({
      id: randomUUID(),
      userId: session.user.id,
      jobId,
      processType: ProcessType.Message,
      status: ProcessStatus.Pending,
    }),
  ]);

  void runWorkflow({
    jobId,
    userId: session.user.id,
    resumeText: resumeRow?.content ?? '',
    jobText: job[0].content ?? '',
  });

  return NextResponse.json({ status: 'started' }, { status: 202 });
});
