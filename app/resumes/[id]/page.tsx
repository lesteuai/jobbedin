'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { AppFrame } from '@/app/components/ym/AppFrame';
import { Sidebar } from '@/app/components/ym/Sidebar';
import { YmModal } from '@/app/components/ym/YmModal';
import { YmButton } from '@/app/components/ym/YmButton';
import { MarkdownPanel } from '@/app/components/ym/MarkdownPanel';
import { useAppStore, apiErrorMessage } from '@/app/lib/app-store';
import { useSession } from '@/app/lib/auth/client';
import { useChat } from '@/app/hooks/use-chat';
import { AnalysisReport } from '@/app/components/AnalysisReport';
import type { Tab } from '@/app/components/AnalysisReport';

type View = 'idle' | 'view' | 'add' | 'report';

export default function ResumesJobsPage() {
  const router = useRouter();
  const params = useParams();
  const resumeId = typeof params.id === 'string' ? params.id : '';
  const { data: session, isPending } = useSession();
  const { jobs, selectedJobId, selectJob, addJob, deleteJob, showError, setJobs } = useAppStore();
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
  const chat = useChat(selectedJobId, tab);

  useEffect(() => {
    if (!isPending && !session?.user) router.replace('/');
  }, [isPending, session?.user, router]);
  
  const fetchJobs = async (selectedResumeId: string) => {
    try {
      const res = await fetch(`/api/jobs?resumeId=${selectedResumeId}`);
      if (!res.ok) {
        const msg = await apiErrorMessage(res, 'Failed to fetch jobs');
        showError(msg);
        return;
      }
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      showError('Failed to fetch jobs. Please try again.');
    }
  };

  useEffect(() => {
    if (resumeId && session?.user?.id) {
      fetchJobs(resumeId);
    }
  }, [resumeId, session?.user?.id]);

  const selected = jobs.find((j) => j.id === selectedJobId);
  const pendingName = jobs.find((j) => j.id === pendingDelete)?.name;

  const getProcessStatus = (type: string) =>
    processStatuses.find((p) => p.processType === type)?.status ?? null;

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
        if (data.letterConversation) chat.setChats((p) => ({ ...p, letter: data.letterConversation }));
        if (data.messageConversation) chat.setChats((p) => ({ ...p, message: data.messageConversation }));
        const procs: Array<{ status: string }> = data.processes ?? [];
        const allDone = procs.length === 5 && procs.every((p) => p.status === 'done' || p.status === 'failed');
        if (allDone) { stopPolling(); setIsAnalyzing(false); }
      } catch { /* ignore transient errors */ }
    }, 1000);
  };

  useEffect(() => {
    stopPolling();
    setAnalysisData(null);
    setProcessStatuses([]);
  }, [selectedJobId]);

  useEffect(() => () => stopPolling(), []);

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
        if (analysis.letterConversation) chat.setChats((p) => ({ ...p, letter: analysis.letterConversation }));
        if (analysis.messageConversation) chat.setChats((p) => ({ ...p, message: analysis.messageConversation }));
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

  return ( session ?
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {view === 'report' && selected ? (
          <AnalysisReport
            selectedName={selected.name}
            tab={tab}
            setTab={setTab}
            analysisData={analysisData}
            getProcessStatus={getProcessStatus}
            onBack={() => setView('view')}
            chat={chat}
          />
        ) : (
          <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>
            {view === 'add' ? (
              <>
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>✎ Paste job description</div>
                <textarea
                  className="ym-textarea"
                  style={{ flex: 1, resize: 'none', fontFamily: 'var(--ym-font)' }}
                  placeholder="Paste the full job description here..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <YmButton onClick={() => { setDraft(''); setView('idle'); }}>Cancel</YmButton>
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
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>💼 {selected.name} — description</div>
                <MarkdownPanel>{selected.content}</MarkdownPanel>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <YmButton variant="primary" disabled={isAnalyzing} onClick={handleAnalyze}>
                    {isAnalyzing ? 'Analyzing...' : 'Analyze →'}
                  </YmButton>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 'bold', fontSize: 13, visibility: 'hidden' }}>placeholder</div>
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
  : null);
}
