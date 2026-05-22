import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/lib/auth';
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const job = await db
      .select()
      .from(resumeJob)
      .where(
        and(
          eq(resumeJob.id, jobId),
          eq(resumeJob.userId, session.user.id)
        )
      );

    if (job.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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
      db
        .delete(jobDescriptionMatch)
        .where(eq(jobDescriptionMatch.jobId, jobId)),
      db.delete(resumeFeedback).where(eq(resumeFeedback.jobId, jobId)),
      db
        .delete(coverLetterHistory)
        .where(eq(coverLetterHistory.jobId, jobId)),
      db
        .delete(messageGenHistory)
        .where(eq(messageGenHistory.jobId, jobId)),
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
  } catch (error) {
    console.error('Error analyzing:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
