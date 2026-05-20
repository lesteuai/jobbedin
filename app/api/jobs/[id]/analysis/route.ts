import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { company, jobDescriptionMatch, resumeFeedback, process as processTable } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;

  try {
    const [companyRow] = await db.select().from(company).where(eq(company.jobId, jobId));
    const [jdMatchRow] = await db.select().from(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId));
    const [feedbackRow] = await db.select().from(resumeFeedback).where(eq(resumeFeedback.jobId, jobId));
    const processes = await db.select().from(processTable).where(eq(processTable.jobId, jobId));

    return NextResponse.json({
      company: companyRow?.content || null,
      jdMatch: jdMatchRow?.content || null,
      feedback: feedbackRow?.content || null,
      processes: processes.map((p) => ({
        processType: p.processType,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error('Analysis fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
