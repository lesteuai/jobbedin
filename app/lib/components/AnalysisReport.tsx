'use client';

import { YmButton } from '@/app/lib/components/ym/YmButton';
import { MarkdownPanel } from '@/app/lib/components/ym/MarkdownPanel';
import { ChatPanel } from '@/app/lib/components/ym/ChatPanel';
import type { useChat } from '@/app/lib/hooks/use-chat';
import { ProcessStatus, ProcessType } from '@/app/lib/db/schema';

export const TABS = ['Company', 'JDMatch', 'Feedback', 'Generate'] as const;
export type Tab = (typeof TABS)[number];

type AnalysisData = {
  company: string | null;
  jdMatch: string | null;
  feedback: string | null;
};

type Props = {
  selectedName: string;
  tab: Tab;
  setTab: (tab: Tab) => void;
  analysisData: AnalysisData | null;
  getProcessStatus: (type: string) => string | null;
  onBack: () => void;
  chat: ReturnType<typeof useChat>;
};

export function AnalysisReport({ selectedName, tab, setTab, analysisData, getProcessStatus, onBack, chat }: Props) {
  const tabConfig: Record<string, { processType: string; content: string | null | undefined }> = {
    Company: { processType: ProcessType.Company, content: analysisData?.company },
    JDMatch: { processType: ProcessType.JDMatch, content: analysisData?.jdMatch },
    Feedback: { processType: ProcessType.ResumeFeedback, content: analysisData?.feedback },
  };

  const renderTabContent = () => {
    if (tab === 'Generate') {
      const letterStatus = getProcessStatus(ProcessType.Letter);
      const messageStatus = getProcessStatus(ProcessType.Message);
      if (!letterStatus && !messageStatus) {
        return <div style={{ color: '#666', fontStyle: 'italic' }}>Generation failed for this section.</div>;
      }
      if ([ProcessStatus.Processing, ProcessStatus.Pending].includes(letterStatus as ProcessStatus) || [ProcessStatus.Processing, ProcessStatus.Pending].includes(messageStatus as ProcessStatus)) {
        return <div style={{ color: '#666', fontStyle: 'italic' }}>Generating...</div>;
      }
      return <ChatPanel {...chat} getProcessStatus={getProcessStatus} />;
    }
    const cfg = tabConfig[tab] ?? { processType: '', content: null };
    const status = getProcessStatus(cfg.processType);
    if (status === ProcessStatus.Done && cfg.content) return <MarkdownPanel>{cfg.content}</MarkdownPanel>;
    if (status === ProcessStatus.Failed) return <div style={{ color: '#c00', fontStyle: 'italic' }}>Analysis failed for this section.</div>;
    return <div style={{ color: '#666', fontStyle: 'italic' }}>Processing...</div>;
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 0' }}>
        <YmButton onClick={onBack}>← Back to Job</YmButton>
        <span style={{ fontWeight: 'bold', fontSize: 13 }}>Analysis: {selectedName}</span>
      </div>

      <div className="ym-tabs" style={{ marginTop: 6 }}>
        {TABS.map((t) => (
          <button key={t} className="ym-tab" data-active={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'hidden' }}>
        {renderTabContent()}
      </div>
    </>
  );
}
