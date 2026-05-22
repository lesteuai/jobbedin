'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
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

const PLACEHOLDER: Record<Mode, string> = {
  letter: 'Tell me how you want your letter to be like: tone, content highlights, etc',
  message: 'Tell me how you want your message to look like: tone, content highlights, etc',
};

export default function ResumesJobsPage() {
  const router = useRouter();
  const params = useParams();
  const resumeId = typeof params.id === 'string' ? params.id : '';
  const { jobs, selectedJobId, selectJob, addJob, deleteJob, showError, selectResume } = useAppStore();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [view, setView] = useState<View>('idle');
  const [draft, setDraft] = useState('');

  const [analysisData, setAnalysisData] = useState<{
    company: string | null;
    jdMatch: string | null;
    feedback: string | null;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processStatuses, setProcessStatuses] = useState<Array<{ processType: string; status: string }>>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tab, setTab] = useState<Tab>('Company');
  const [mode, setMode] = useState<Mode>('letter');
  const [chats, setChats] = useState<Record<Mode, ChatLine[]>>({ letter: [], message: [] });
  const [chatDraft, setChatDraft] = useState('');
  const [chatsLoaded, setChatsLoaded] = useState(false);

  const selected = jobs.find((j) => j.id === selectedJobId);
  const pendingName = jobs.find((j) => j.id === pendingDelete)?.name;

  useEffect(() => {
    if (resumeId) {
      selectResume(resumeId);
    }
  }, [resumeId, selectResume]);

  const getProcessStatus = (type: string) =>
    processStatuses.find(p => p.processType === type)?.status ?? null;

  const handleSelect = (id: string) => {
    setView('view');
    setDraft('');
    selectJob(id);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/analysis`);
        if (!res.ok) return;
        const data = await res.json();
        setAnalysisData({ company: data.company, jdMatch: data.jdMatch, feedback: data.feedback });
        setProcessStatuses(data.processes ?? []);
        if (data.letterConversation) setChats(p => ({ ...p, letter: data.letterConversation }));
        if (data.messageConversation) setChats(p => ({ ...p, message: data.messageConversation }));
        const procs: Array<{ status: string }> = data.processes ?? [];
        const allDone = procs.length === 5 && procs.every(p => p.status === 'done' || p.status === 'failed');
        if (allDone) { stopPolling(); setIsAnalyzing(false); }
      } catch { /* ignore transient errors */ }
    }, 1000);
  };

  useEffect(() => {
    stopPolling();
    setAnalysisData(null);
    setProcessStatuses([]);
  }, [selectedJobId]);

  useEffect(() => {
    if (tab !== 'Generate' || !selectedJobId) {
      return;
    }

    const loadChats = async () => {
      try {
        const [letterRes, messageRes] = await Promise.all([
          fetch(`/api/jobs/${selectedJobId}/chat?mode=letter`),
          fetch(`/api/jobs/${selectedJobId}/chat?mode=message`),
        ]);

        if (!letterRes.ok || !messageRes.ok) {
          throw new Error('Failed to load chat history');
        }

        const letterData = await letterRes.json();
        const messageData = await messageRes.json();

        setChats({
          letter: letterData.conversation || [],
          message: messageData.conversation || [],
        });
        setChatsLoaded(true);
      } catch (err) {
        console.error('Error loading chats:', err);
        showError('Failed to load chat history. Please try again.');
      }
    };

    loadChats();
  }, [selectedJobId, tab]);

  useEffect(() => () => stopPolling(), []);

  const lines = chats[mode];
  const canSend = chatDraft.trim().length > 0;
  const canClear = lines.length > 0;

  const handleSend = async () => {
    if (!canSend || !selectedJobId) return;

    const updatedLines = [
      ...lines,
      { role: 'user' as const, text: chatDraft.trim() },
      {
        role: 'ai' as const,
        text:
          mode === 'letter'
            ? '(Mock AI) Sure — here\'s a revised cover letter draft based on your notes...\n\nDear Hiring Manager,\n...'
            : '(Mock AI) Got it — here\'s a punchier outreach message...\n\nHi [Name],\n...',
      },
    ];

    setChats((p) => ({ ...p, [mode]: updatedLines }));
    setChatDraft('');

    try {
      await fetch(`/api/jobs/${selectedJobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, conversation: updatedLines }),
      });
    } catch (err) {
      console.error('Error saving chat:', err);
    }
  };

  const handleClear = async () => {
    if (!selectedJobId) return;

    setChats((p) => ({ ...p, [mode]: [] }));
    setChatDraft('');

    try {
      await fetch(`/api/jobs/${selectedJobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, conversation: [] }),
      });
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedJobId) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/analyze`, { method: 'POST' });
      if (!res.ok) throw new Error('Analyze request failed');
      const data = await res.json();
      if (data.status === 'done') {
        const analysisRes = await fetch(`/api/jobs/${selectedJobId}/analysis`);
        if (!analysisRes.ok) throw new Error('Failed to fetch analysis');
        const analysis = await analysisRes.json();
        setAnalysisData({ company: analysis.company, jdMatch: analysis.jdMatch, feedback: analysis.feedback });
        setProcessStatuses(analysis.processes ?? []);
        if (analysis.letterConversation) setChats(p => ({ ...p, letter: analysis.letterConversation }));
        if (analysis.messageConversation) setChats(p => ({ ...p, message: analysis.messageConversation }));
        setIsAnalyzing(false);
        setView('report');
        setTab('Company');
      } else {
        setView('report');
        setTab('Company');
        startPolling(selectedJobId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze job.';
      showError(msg);
      setIsAnalyzing(false);
    }
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
              {tab !== 'Generate' ? (() => {
                const tabConfig: Record<string, { processType: string; content: string | null | undefined }> = {
                  Company: { processType: 'company', content: analysisData?.company },
                  JDMatch: { processType: 'jdmatch', content: analysisData?.jdMatch },
                  Feedback: { processType: 'feedback', content: analysisData?.feedback },
                };
                const cfg = tabConfig[tab] ?? { processType: '', content: null };
                const status = getProcessStatus(cfg.processType);
                if (status === 'done' && cfg.content) return <MarkdownPanel>{cfg.content}</MarkdownPanel>;
                if (status === 'processing' || status === 'pending') return <div style={{ color: '#666', fontStyle: 'italic' }}>Processing...</div>;
                if (status === 'failed') return <div style={{ color: '#c00', fontStyle: 'italic' }}>Analysis failed for this section.</div>;
                return <div style={{ color: '#666', fontStyle: 'italic' }}>Click Analyze to generate analysis.</div>;
              })() : (
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
                    {(() => {
                      const modeProcessType = mode === 'letter' ? 'letter' : 'message';
                      const modeStatus = getProcessStatus(modeProcessType);
                      if (modeStatus === 'pending' || modeStatus === 'processing') {
                        return <div style={{ color: '#888', fontStyle: 'italic' }}>{`Generating your ${mode === 'letter' ? 'cover letter' : 'message'}...`}</div>;
                      }
                      if (modeStatus === 'failed') {
                        return <div style={{ color: '#c00', fontStyle: 'italic' }}>Generation failed. Please re-analyze.</div>;
                      }
                      return lines.length === 0 ? (
                        <div style={{ color: '#888', fontStyle: 'italic' }}>(No messages yet. Start typing below.)</div>
                      ) : (
                        lines.map((l, i) => (
                          <div key={i} className="ym-chat-line">
                            <span className={l.role === 'user' ? 'ym-bubble-user' : 'ym-bubble-ai'}>
                              {l.role === 'user' ? 'You: ' : 'JobbedIn-AI: '}
                            </span>
                            {l.text}
                          </div>
                        ))
                      );
                    })()}
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
                      addJob(draft.trim()).then((id) => {
                        selectJob(id);
                        setDraft('');
                        setView('view');
                      });
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
                    disabled={isAnalyzing}
                    onClick={handleAnalyze}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze →'}
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
