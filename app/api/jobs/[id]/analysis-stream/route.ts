import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { resumeJob, ProcessStatus } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleAsyncAuth, BadRequestException } from '@/app/lib/api-handler';

// Get analysis and messages for a ResumeJob
export const GET = handleAsyncAuth(async (request: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
  
  const { id: jobId } = await params;

  if (!jobId) {
    throw new BadRequestException('id is required');
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const pollDatabase = async () => {
        try {
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
            controller.enqueue(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
            if (intervalId) clearInterval(intervalId);
            controller.close();
            return;
          }

          const data = {
            company: job.company?.content ?? null,
            jdMatch: job.jobDescriptionMatch?.content ?? null,
            feedback: job.resumeFeedback?.content ?? null,
            letterConversation: job.coverLetterHistory?.conversation ?? null,
            messageConversation: job.messageGenHistory?.conversation ?? null,
            processes: job.processes.map((p) => ({
              processType: p.processType,
              status: p.status,
            })),
          };

          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);

          const allTerminal =
            job.processes.length === 5 &&
            job.processes.every(
              (p) => p.status === ProcessStatus.Done || p.status === ProcessStatus.Failed
            );

          if (allTerminal) {
            if (intervalId) clearInterval(intervalId);
            controller.close();
          }
        } catch (error) {
          console.error('[analysis-stream] Poll error:', error);
          const message = error instanceof Error ? error.message : 'An error occurred during analysis';
          controller.enqueue(`data: ${JSON.stringify({ error: message })}\n\n`);
          if (intervalId) clearInterval(intervalId);
          controller.close();
        }
      };

      intervalId = setInterval(pollDatabase, 1000);
      await pollDatabase();
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  request.signal.addEventListener('abort', () => {
    if (intervalId) clearInterval(intervalId);
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
