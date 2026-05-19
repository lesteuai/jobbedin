'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppFrame } from '@/app/components/ym/AppFrame';
import { Sidebar } from '@/app/components/ym/Sidebar';
import { YmModal } from '@/app/components/ym/YmModal';
import { YmButton } from '@/app/components/ym/YmButton';
import { MarkdownPanel } from '@/app/components/ym/MarkdownPanel';
import { useAppStore } from '@/app/lib/app-store';

type View = 'idle' | 'view' | 'add' | 'report';
const TABS = ['Company', 'JDMatch', 'Feedback', 'Generate'] as const;
type Tab = (typeof TABS)[number];
type Mode = 'letter' | 'message';
type ChatLine = { role: 'user' | 'ai'; text: string };

const MOCK: Record<Exclude<Tab, 'Generate'>, string> = {
  Company: `# X

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

  JDMatch: `# Match score: **82 / 100** 🎯

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

  Feedback: `# Resume critique

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

const SEED: Record<Mode, ChatLine[]> = {
  letter: [
    { role: 'user', text: 'Write to hiring manager.' },
    {
      role: 'ai',
      text: `Subject: Software Engineer Application

Dear Hiring Manager,

X mortality is a solvable problem. X is one of the few
organizations treating it that way — building data-driven, clinically
validated tools that meet patients where they are. That's why I'm writing.

Over the last three years I've shipped three AI-agent products to
production, including an autonomous research assistant used daily by a
50-person team. I'd love to bring that same shipping cadence to your
LLM-assisted triage roadmap.

Best,
Jane`,
    },
  ],
  message: [
    {
      role: 'user',
      text:
        'Write to the founder. Stress on the 2 AI projects I did, plus I\'m planning to work on an email generator so this is perfect opportunity.',
    },
    {
      role: 'ai',
      text: `Hi [Founder of Company],

I built two AI agents from scratch and shipped them to production.
AuTuber is an agentic stagehand for YouTube creators (12k MAU); the
second is an internal research assistant our team uses daily.

I'm currently prototyping an email generator — which is exactly the
problem space your new role touches. Would love 15 minutes to compare
notes.

— Jane`,
    },
  ],
};

const PLACEHOLDER: Record<Mode, string> = {
  letter: 'Tell me how you want your letter to be like: tone, content highlights, etc',
  message: 'Tell me how you want your message to look like: tone, content highlights, etc',
};

export default function JobsPage() {
  const router = useRouter();
  const { jobs, selectedJobId, selectJob, addJob, deleteJob } = useAppStore();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [view, setView] = useState<View>('idle');
  const [draft, setDraft] = useState('');

  // Report state
  const [tab, setTab] = useState<Tab>('Company');
  const [mode, setMode] = useState<Mode>('letter');
  const [chats, setChats] = useState<Record<Mode, ChatLine[]>>(SEED);
  const [chatDraft, setChatDraft] = useState('');

  const selected = jobs.find((j) => j.id === selectedJobId);
  const pendingName = jobs.find((j) => j.id === pendingDelete)?.name;

  const handleSelect = (id: string) => {
    setView('view');
    setDraft('');
    selectJob(id);
  };

  const lines = chats[mode];
  const canSend = chatDraft.trim().length > 0;
  const canClear = lines.length > 0;

  const handleSend = () => {
    if (!canSend) return;
    setChats((p) => ({
      ...p,
      [mode]: [
        ...p[mode],
        { role: 'user', text: chatDraft.trim() },
        {
          role: 'ai',
          text:
            mode === 'letter'
              ? '(Mock AI) Sure — here\'s a revised cover letter draft based on your notes...\n\nDear Hiring Manager,\n...'
              : '(Mock AI) Got it — here\'s a punchier outreach message...\n\nHi [Name],\n...',
        },
      ],
    }));
    setChatDraft('');
  };

  const handleClear = () => {
    setChats((p) => ({ ...p, [mode]: [] }));
    setChatDraft('');
  };

  return (
    <AppFrame>
      <Sidebar
        title="Jobs"
        addLabel="+ Add Job"
        onAdd={() => {
          setView('add');
          setDraft('');
          selectJob(null);
        }}
        items={jobs}
        selectedId={selectedJobId}
        onSelect={handleSelect}
        onDelete={(id) => setPendingDelete(id)}
        header={
          <YmButton onClick={() => router.push('/resumes')}>← Back to Resumes</YmButton>
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {view === 'report' && selected ? (
          <>
            {/* Header with back button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px 0',
              }}
            >
              <YmButton onClick={() => setView('view')}>← Back to Job</YmButton>
              <span style={{ fontWeight: 'bold', fontSize: 13 }}>
                Analysis: {selected.name}
              </span>
            </div>

            <div className="ym-tabs" style={{ marginTop: 6 }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  className="ym-tab"
                  data-active={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tab !== 'Generate' ? (
                <MarkdownPanel>{MOCK[tab]}</MarkdownPanel>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>Mode:</span>
                    <YmButton
                      variant={mode === 'letter' ? 'primary' : 'default'}
                      onClick={() => setMode('letter')}
                    >
                      Cover Letter
                    </YmButton>
                    <YmButton
                      variant={mode === 'message' ? 'primary' : 'default'}
                      onClick={() => setMode('message')}
                    >
                      Message
                    </YmButton>
                    <span style={{ color: '#666', marginLeft: 8 }}>
                      Chatting with <b style={{ color: 'oklch(0.4 0.2 250)' }}>JobbedIn-AI</b>
                    </span>
                  </div>

                  <div
                    className="ym-inset"
                    style={{
                      flex: 1,
                      padding: 10,
                      overflow: 'auto',
                      fontFamily: 'var(--ym-font)',
                      fontSize: 12,
                    }}
                  >
                    {lines.length === 0 ? (
                      <div style={{ color: '#888', fontStyle: 'italic' }}>
                        (No messages yet. Start typing below.)
                      </div>
                    ) : (
                      lines.map((l, i) => (
                        <div key={i} className="ym-chat-line">
                          <span className={l.role === 'user' ? 'ym-bubble-user' : 'ym-bubble-ai'}>
                            {l.role === 'user' ? 'You: ' : 'JobbedIn-AI: '}
                          </span>
                          {l.text}
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                    <textarea
                      className="ym-textarea ym-blur-placeholder"
                      style={{
                        flex: 1,
                        resize: 'none',
                        minHeight: 56,
                        fontFamily: 'var(--ym-font)',
                      }}
                      placeholder={PLACEHOLDER[mode]}
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <YmButton onClick={handleClear} disabled={!canClear} style={{ minWidth: 56 }}>
                        Clear
                      </YmButton>
                      <YmButton
                        variant="primary"
                        onClick={handleSend}
                        disabled={!canSend}
                        style={{ minWidth: 56, flex: 1 }}
                      >
                        Send ▶
                      </YmButton>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {view === 'add' ? (
              <>
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>
                  ✎ Paste job description
                </div>
                <textarea
                  className="ym-textarea"
                  style={{ flex: 1, resize: 'none', fontFamily: 'var(--ym-font)' }}
                  placeholder="Paste the full job description here..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <YmButton
                    onClick={() => {
                      setDraft('');
                      setView('idle');
                    }}
                  >
                    Cancel
                  </YmButton>
                  <YmButton
                    variant="primary"
                    disabled={!draft.trim()}
                    onClick={() => {
                      const id = addJob(draft.trim());
                      selectJob(id);
                      setDraft('');
                      setView('report');
                      setTab('Company');
                    }}
                  >
                    OK
                  </YmButton>
                </div>
              </>
            ) : selected ? (
              <>
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>
                  💼 {selected.name} — description
                </div>
                <MarkdownPanel>{selected.content}</MarkdownPanel>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <YmButton
                    variant="primary"
                    onClick={() => {
                      setTab('Company');
                      setView('report');
                    }}
                  >
                    Analyze →
                  </YmButton>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 'bold', fontSize: 13, visibility: 'hidden' }}>
                  placeholder
                </div>
                <div
                  className="ym-inset"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    fontStyle: 'italic',
                    padding: 24,
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 36 }}>💼</div>
                    <p>Pick a job, or click <b>+ Add Job</b> to paste one.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <YmModal
        open={pendingDelete !== null}
        title="Confirm delete"
        onOk={() => {
          if (pendingDelete) deleteJob(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      >
        Are you sure you want to delete <b>{pendingName}</b>?
      </YmModal>
    </AppFrame>
  );
}
