import { NextRequest, Response } from 'next/server';
import { db } from '@/app/lib/db';
import { resumeJob, ProcessStatus } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionOrThrow, UnauthorizedException, BadRequestException } from '@/app/lib/api-handler';

export const GET = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getSessionOrThrow(request);
    const { id: jobId } = await params;

    if (!jobId) {
      return Response.json({ error: 'id is required' }, { status: 400 });
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
              controller.error(new Error('Job not found'));
              if (intervalId) clearInterval(intervalId);
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
            if (intervalId) clearInterval(intervalId);
            controller.error(error);
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof BadRequestException) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('[analysis-stream] Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
