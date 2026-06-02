import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resumeJob } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleAsyncAuth, BadRequestException, NotFoundException } from '@/app/lib/api-handler';

// Get analysis and messages for a ResumeJob
export const GET = handleAsyncAuth(async (request: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {

  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  const job = await db.query.resumeJob.findFirst({
    where: and(eq(resumeJob.id, jobId), eq(resumeJob.userId, session.user.id)),
    with: {
      company: true,
      jobDescriptionMatch: true,
      resumeFeedback: true,
      coverLetterHistory: true,
      messageGenHistory: true,
      processes: true,
    },
  });

  if (!job) {
    throw new NotFoundException('Not found');
  }

  return NextResponse.json({
    company: job.company?.content ?? null,
    jdMatch: job.jobDescriptionMatch?.content ?? null,
    feedback: job.resumeFeedback?.content ?? null,
    letterConversation: job.coverLetterHistory?.conversation ?? null,
    messageConversation: job.messageGenHistory?.conversation ?? null,
    processes: job.processes.map((p) => ({
      processType: p.processType,
      status: p.status,
    })),
  });
});
