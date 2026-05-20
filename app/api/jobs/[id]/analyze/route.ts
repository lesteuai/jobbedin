import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { company, jobDescriptionMatch, resumeFeedback, process as processTable, ProcessType, ProcessStatus } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const MOCK_DATA = {
  company: `# X

**Industry:** Digital X Health
**Founded:** 2014 · **HQ:** Washington, DC · **Size:** ~80 employees
**Funding:** Series B — $14M (Y Innovation Fund)

## What they do
X builds a virtual care platform for pregnant patients, used by
30+ health systems across the US. Their app delivers risk-screening
content, remote BP monitoring, and care-team alerts.

## Why they're hiring
- Expanding the **AI-assisted triage** product line
- Recently shipped LLM summarization for clinician notes
- Growing the engineering team after a CMS reimbursement win

## Culture signals
- Mission-driven, clinical-evidence first
- Remote-friendly, async-heavy
- Founders publish in *NEJM Catalyst* — value writing skills`,

  jdMatch: `# Match score: **82 / 100** 🎯

| Requirement | Resume evidence | Verdict |
|---|---|---|
| 4+ yrs TypeScript / React | Acme Corp 2022→Present, Globex 2019–2022 | ✅ Strong |
| Ship LLM features | "Shipped 3 AI agent products" | ✅ Strong |
| Postgres + cloud | Listed in Skills (Postgres, AWS) | ✅ OK |
| Clear writing & ownership | Not directly evidenced | ⚠ Gap |
| Health-tech background | Not mentioned | ⚠ Gap |

## Recommended emphasis
1. Lead with the **3 shipped AI agents** — it's their exact roadmap.
2. Quote a metric from your TypeScript migration (40k LoC).
3. Bridge the health-tech gap with mission language.`,

  feedback: `# Resume critique

## What's working
- Clean structure, scannable in <10 seconds
- Verb-led bullets ("Shipped", "Led")
- Skills section maps cleanly to the JD

## Fix these
1. **Quantify outcomes** — "Shipped 3 AI agent products" → add users, latency, or revenue impact.
2. **Tighten the Globex line** — "Led migration to TypeScript across 40k LoC" is great; add the team size.
3. **No summary at top** — add a 2-line tagline that says *what kind of engineer you are*.
4. **Education section is dead weight** — move below Skills or drop the year.

## Nits
- "Senior Engineer" appears twice; consider "Staff" if scope warrants.
- Drop the github URL from the header — put it under contact icons.`,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;

  try {
    await db.delete(company).where(eq(company.jobId, jobId));
    await db.delete(jobDescriptionMatch).where(eq(jobDescriptionMatch.jobId, jobId));
    await db.delete(resumeFeedback).where(eq(resumeFeedback.jobId, jobId));
    await db.delete(processTable).where(eq(processTable.jobId, jobId));

    await db.insert(company).values({
      id: crypto.randomUUID(),
      jobId,
      content: MOCK_DATA.company,
    });

    await db.insert(jobDescriptionMatch).values({
      id: crypto.randomUUID(),
      jobId,
      content: MOCK_DATA.jdMatch,
    });

    await db.insert(resumeFeedback).values({
      id: crypto.randomUUID(),
      jobId,
      content: MOCK_DATA.feedback,
    });

    const processTypes = [ProcessType.Company, ProcessType.JDMatch, ProcessType.ResumeFeedback, ProcessType.Letter, ProcessType.Message];
    for (const type of processTypes) {
      await db.insert(processTable).values({
        id: crypto.randomUUID(),
        jobId,
        processType: type,
        status: ProcessStatus.Done,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
