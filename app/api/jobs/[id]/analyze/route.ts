import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import {
  resumeJob,
  process as processTable,
  ProcessType,
  ProcessStatus,
} from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { runWorkflow } from '@/app/lib/workflow';
import { randomUUID } from 'crypto';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';

// Send "Analyze" from ResumeJob screen to here to process
export const POST = handleAsyncAuth(async (request: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {

  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  const job = await db.query.resumeJob.findFirst({
    where: and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)),
    with: {
      resume: true,
      processes: true,
    },
  });

  if (!job) {
    throw new NotFoundException('Not found');
  }

  if (
    job.processes.length === 5 &&
    job.processes.every((p) => p.status === ProcessStatus.Done)
  ) {
    return NextResponse.json({ status: 'done' });
  }

  const isInProgress = job.processes.some(
    (p) => [ProcessStatus.Processing, ProcessStatus.Pending].includes(p.status as ProcessStatus)
  );

  if (!isInProgress) {
    await db.insert(processTable).values([
      { id: randomUUID(), userId: session.user.id, jobId, processType: ProcessType.Company, status: ProcessStatus.Processing },
      { id: randomUUID(), userId: session.user.id, jobId, processType: ProcessType.JDMatch, status: ProcessStatus.Processing },
      { id: randomUUID(), userId: session.user.id, jobId, processType: ProcessType.ResumeFeedback, status: ProcessStatus.Processing },
      { id: randomUUID(), userId: session.user.id, jobId, processType: ProcessType.Letter, status: ProcessStatus.Pending },
      { id: randomUUID(), userId: session.user.id, jobId, processType: ProcessType.Message, status: ProcessStatus.Pending },
    ]);

    runWorkflow({
      jobId,
      userId: session.user.id,
      resumeText: job.resume?.content ?? '',
      jobText: job.content ?? '',
    });
  }

  return NextResponse.json({ status: 'started' }, { status: 202 });
});
