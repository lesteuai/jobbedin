'use client';

import type { RefObject } from 'react';
import { YmButton } from './YmButton';
import type { Mode, ChatLine } from '@/app/hooks/use-chat';

const PLACEHOLDER: Record<Mode, string> = {
  letter: 'Tell me how you want your letter to be like: tone, content highlights, etc',
  message: 'Tell me how you want your message to look like: tone, content highlights, etc',
};

type Props = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  lines: ChatLine[];
  isAiTyping: boolean;
  typingDots: string;
  chatDraft: string;
  setChatDraft: (draft: string) => void;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  canSend: boolean;
  canClear: boolean;
  handleSend: () => void;
  handleClear: () => void;
  getProcessStatus: (type: string) => string | null;
};

export function ChatPanel({
  mode, setMode,
  lines, isAiTyping, typingDots,
  chatDraft, setChatDraft,
  chatContainerRef,
  canSend, canClear,
  handleSend, handleClear,
  getProcessStatus,
}: Props) {
  const modeProcessType = mode === 'letter' ? 'letter' : 'message';
  const modeStatus = getProcessStatus(modeProcessType);

  const renderMessages = () => {
    if (modeStatus === 'pending' || modeStatus === 'processing') {
      return (
        <div style={{ color: '#888', fontStyle: 'italic' }}>
          {`Generating your ${mode === 'letter' ? 'cover letter' : 'message'}...`}
        </div>
      );
    }
    if (modeStatus === 'failed') {
      return <div style={{ color: '#c00', fontStyle: 'italic' }}>Generation failed. Please re-analyze.</div>;
    }
    if (lines.length === 0 && !isAiTyping) {
      return <div style={{ color: '#888', fontStyle: 'italic' }}>(No messages yet. Start typing below.)</div>;
    }
    return (
      <>
        {lines.map((l, i) => (
          <div key={i} className="ym-chat-line">
            <span className={l.role === 'user' ? 'ym-bubble-user' : 'ym-bubble-ai'}>
              {l.role === 'user' ? 'You: ' : 'JobbedIn-AI: '}
            </span>
            {l.text}
          </div>
        ))}
        {isAiTyping && (
          <div className="ym-chat-line">
            <span className="ym-bubble-ai">JobbedIn-AI: </span>
            {typingDots}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ fontWeight: 'bold' }}>Mode:</span>
        <YmButton variant={mode === 'letter' ? 'primary' : 'default'} onClick={() => setMode('letter')}>
          Cover Letter
        </YmButton>
        <YmButton variant={mode === 'message' ? 'primary' : 'default'} onClick={() => setMode('message')}>
          Message
        </YmButton>
        <span style={{ color: '#666', marginLeft: 8 }}>
          Chatting with <b style={{ color: 'oklch(0.4 0.2 250)' }}>JobbedIn-AI</b>
        </span>
      </div>

      <div
        ref={chatContainerRef}
        className="ym-inset"
        style={{ flex: 1, padding: 10, overflow: 'auto', fontFamily: 'var(--ym-font)', fontSize: 12 }}
      >
        {renderMessages()}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <textarea
          className="ym-textarea ym-blur-placeholder"
          style={{ flex: 1, resize: 'none', minHeight: 56, fontFamily: 'var(--ym-font)' }}
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
  );
}
