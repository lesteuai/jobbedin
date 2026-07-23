import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisReport, TABS, type Tab } from '@/app/lib/components/AnalysisReport';
import { ProcessStatus, ProcessType } from '@/app/lib/db/schema';
import { STATUS_REASON, STATUS_REASON_MESSAGE } from '@/app/lib/constants';
import type { useChat } from '@/app/lib/hooks/use-chat';

vi.mock('@/app/lib/components/ym/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}));

type ProcessStatusMap = Partial<Record<string, ProcessStatus | null>>;
type ProcessReasonMap = Partial<Record<string, string | null>>;

function makeProps(overrides: {
  selectedName?: string;
  tab?: Tab;
  setTab?: (tab: Tab) => void;
  analysisData?: { company: string | null; jdMatch: string | null; feedback: string | null } | null;
  onBack?: () => void;
  statuses?: ProcessStatusMap;
  reasons?: ProcessReasonMap;
} = {}) {
  const statuses = overrides.statuses ?? {};
  const reasons = overrides.reasons ?? {};

  return {
    selectedName: overrides.selectedName ?? 'Acme Corp',
    tab: overrides.tab ?? 'Company',
    setTab: overrides.setTab ?? vi.fn(),
    analysisData: overrides.analysisData ?? { company: null, jdMatch: null, feedback: null },
    getProcessStatus: (type: string) => statuses[type] ?? null,
    getProcessReason: (type: string) => reasons[type] ?? null,
    onBack: overrides.onBack ?? vi.fn(),
    chat: {} as ReturnType<typeof useChat>,
  };
}

describe('AnalysisReport shell', () => {
  it('shows the header with selectedName', () => {
    render(<AnalysisReport {...makeProps({ selectedName: 'Widget Inc' })} />);
    expect(screen.getByText('Analysis: Widget Inc')).toBeInTheDocument();
  });

  it('calls onBack when clicking the back button', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<AnalysisReport {...makeProps({ onBack })} />);
    await user.click(screen.getByRole('button', { name: '← Back to Job' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders all four tabs from TABS', () => {
    render(<AnalysisReport {...makeProps()} />);
    for (const t of TABS) {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
    }
  });

  it('marks the active tab and leaves others inactive', () => {
    const { container } = render(<AnalysisReport {...makeProps({ tab: 'Feedback' })} />);
    const tabButtons = container.querySelectorAll('.ym-tab');
    tabButtons.forEach((btn) => {
      const isActive = btn.textContent === 'Feedback';
      expect(btn.getAttribute('data-active')).toBe(String(isActive));
    });
  });

  it('calls setTab with the clicked tab name', async () => {
    const user = userEvent.setup();
    const setTab = vi.fn();
    render(<AnalysisReport {...makeProps({ setTab })} />);
    await user.click(screen.getByRole('button', { name: 'JDMatch' }));
    expect(setTab).toHaveBeenCalledWith('JDMatch');
  });
});

describe.each([
  { tab: 'Company' as Tab, processType: ProcessType.Company, contentKey: 'company' as const },
  { tab: 'JDMatch' as Tab, processType: ProcessType.JDMatch, contentKey: 'jdMatch' as const },
  { tab: 'Feedback' as Tab, processType: ProcessType.ResumeFeedback, contentKey: 'feedback' as const },
])('AnalysisReport content tab: $tab', ({ tab, processType, contentKey }) => {
  it('renders content through MarkdownPanel when status is done and content is non-empty', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          analysisData: { company: null, jdMatch: null, feedback: null, [contentKey]: '## Hello World' },
          statuses: { [processType]: ProcessStatus.Done },
        })}
      />
    );
    expect(screen.getByRole('heading', { name: 'Hello World' })).toBeInTheDocument();
  });

  it('falls through to Processing... when status is done but content is null', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          statuses: { [processType]: ProcessStatus.Done },
        })}
      />
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('shows the out-of-credit message when failed with that reason', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          statuses: { [processType]: ProcessStatus.Failed },
          reasons: { [processType]: STATUS_REASON.OUT_OF_CREDIT },
        })}
      />
    );
    expect(screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.OUT_OF_CREDIT])).toBeInTheDocument();
  });

  it('shows the invalid-api-key message when failed with that reason', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          statuses: { [processType]: ProcessStatus.Failed },
          reasons: { [processType]: STATUS_REASON.INVALID_API_KEY },
        })}
      />
    );
    expect(screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.INVALID_API_KEY])).toBeInTheDocument();
  });

  it('falls back to the generic failure message for an unknown reason', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          statuses: { [processType]: ProcessStatus.Failed },
          reasons: { [processType]: 'some_unknown_reason' },
        })}
      />
    );
    expect(screen.getByText('Analysis failed for this section.')).toBeInTheDocument();
  });

  it('falls back to the generic failure message when reason is null', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          statuses: { [processType]: ProcessStatus.Failed },
        })}
      />
    );
    expect(screen.getByText('Analysis failed for this section.')).toBeInTheDocument();
  });

  it.each([ProcessStatus.Processing, ProcessStatus.Pending, null])('shows Processing... when status is %s', (status) => {
    render(
      <AnalysisReport
        {...makeProps({
          tab,
          statuses: { [processType]: status },
        })}
      />
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });
});

describe('AnalysisReport Generate tab', () => {
  const genStatuses = (letter: ProcessStatus | null, message: ProcessStatus | null): ProcessStatusMap => ({
    [ProcessType.Letter]: letter,
    [ProcessType.Message]: message,
  });

  it('shows the generic failure message when both statuses are null', () => {
    render(<AnalysisReport {...makeProps({ tab: 'Generate', statuses: genStatuses(null, null) })} />);
    expect(screen.getByText('Generation failed for this section.')).toBeInTheDocument();
  });

  it('shows Generating... when either status is pending or processing', () => {
    render(
      <AnalysisReport
        {...makeProps({ tab: 'Generate', statuses: genStatuses(ProcessStatus.Done, ProcessStatus.Processing) })}
      />
    );
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('shows the failure message from Letter when only Letter failed', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab: 'Generate',
          statuses: genStatuses(ProcessStatus.Failed, ProcessStatus.Done),
          reasons: { [ProcessType.Letter]: STATUS_REASON.OUT_OF_CREDIT },
        })}
      />
    );
    expect(screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.OUT_OF_CREDIT])).toBeInTheDocument();
  });

  it('shows the failure message from Message when only Message failed', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab: 'Generate',
          statuses: genStatuses(ProcessStatus.Done, ProcessStatus.Failed),
          reasons: { [ProcessType.Message]: STATUS_REASON.INVALID_API_KEY },
        })}
      />
    );
    expect(screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.INVALID_API_KEY])).toBeInTheDocument();
  });

  it('prefers the Letter failure message when both Letter and Message failed', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab: 'Generate',
          statuses: genStatuses(ProcessStatus.Failed, ProcessStatus.Failed),
          reasons: {
            [ProcessType.Letter]: STATUS_REASON.OUT_OF_CREDIT,
            [ProcessType.Message]: STATUS_REASON.INVALID_API_KEY,
          },
        })}
      />
    );
    expect(screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.OUT_OF_CREDIT])).toBeInTheDocument();
    expect(screen.queryByText(STATUS_REASON_MESSAGE[STATUS_REASON.INVALID_API_KEY])).not.toBeInTheDocument();
  });

  it('falls back to the generic failure message for an unknown failure reason', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab: 'Generate',
          statuses: genStatuses(ProcessStatus.Failed, ProcessStatus.Done),
          reasons: { [ProcessType.Letter]: 'some_unknown_reason' },
        })}
      />
    );
    expect(screen.getByText('Generation failed for this section.')).toBeInTheDocument();
  });

  it('renders ChatPanel when both statuses are done', () => {
    render(
      <AnalysisReport
        {...makeProps({ tab: 'Generate', statuses: genStatuses(ProcessStatus.Done, ProcessStatus.Done) })}
      />
    );
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    expect(screen.queryByText('Generation failed for this section.')).not.toBeInTheDocument();
    expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
  });

  it('prioritizes Generating... over the failed branch when one status is processing and the other failed', () => {
    render(
      <AnalysisReport
        {...makeProps({
          tab: 'Generate',
          statuses: genStatuses(ProcessStatus.Processing, ProcessStatus.Failed),
          reasons: { [ProcessType.Message]: STATUS_REASON.OUT_OF_CREDIT },
        })}
      />
    );
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });
});
