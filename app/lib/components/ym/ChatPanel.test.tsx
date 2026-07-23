import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { ChatPanel } from "./ChatPanel";
import { ProcessType, ProcessStatus } from "@/app/lib/db/schema";
import { STATUS_REASON, STATUS_REASON_MESSAGE } from "@/app/lib/constants";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof ChatPanel>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    mode: ProcessType.Message,
    setMode: vi.fn(),
    lines: [],
    isAiTyping: false,
    typingDots: "",
    chatDraft: "",
    setChatDraft: vi.fn(),
    chatContainerRef: { current: null },
    canSend: false,
    canClear: false,
    handleSend: vi.fn(),
    handleClear: vi.fn(),
    getProcessStatus: () => ProcessStatus.Done,
    getProcessReason: () => null,
    ...overrides,
  };
}

describe("ChatPanel", () => {
  describe("renderMessages: pending/processing", () => {
    it.each([ProcessStatus.Pending, ProcessStatus.Processing])(
      "shows letter generating text for mode letter when status is %s",
      (status) => {
        render(
          <ChatPanel
            {...makeProps({
              mode: ProcessType.Letter,
              getProcessStatus: () => status,
            })}
          />,
        );
        expect(screen.getByText("Generating your cover letter...")).toBeInTheDocument();
      },
    );

    it.each([ProcessStatus.Pending, ProcessStatus.Processing])(
      "shows message generating text for mode message when status is %s",
      (status) => {
        render(
          <ChatPanel
            {...makeProps({
              mode: ProcessType.Message,
              getProcessStatus: () => status,
            })}
          />,
        );
        expect(screen.getByText("Generating your message...")).toBeInTheDocument();
      },
    );
  });

  describe("renderMessages: failed", () => {
    it("shows out-of-credit message", () => {
      render(
        <ChatPanel
          {...makeProps({
            getProcessStatus: () => ProcessStatus.Failed,
            getProcessReason: () => STATUS_REASON.OUT_OF_CREDIT,
          })}
        />,
      );
      expect(
        screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.OUT_OF_CREDIT]),
      ).toBeInTheDocument();
    });

    it("shows invalid-api-key message", () => {
      render(
        <ChatPanel
          {...makeProps({
            getProcessStatus: () => ProcessStatus.Failed,
            getProcessReason: () => STATUS_REASON.INVALID_API_KEY,
          })}
        />,
      );
      expect(
        screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.INVALID_API_KEY]),
      ).toBeInTheDocument();
    });

    it("falls back to generic message for an unknown reason", () => {
      render(
        <ChatPanel
          {...makeProps({
            getProcessStatus: () => ProcessStatus.Failed,
            getProcessReason: () => "some_unknown_reason",
          })}
        />,
      );
      expect(screen.getByText("Generation failed. Please re-analyze.")).toBeInTheDocument();
    });

    it("falls back to generic message when reason is null", () => {
      render(
        <ChatPanel
          {...makeProps({
            getProcessStatus: () => ProcessStatus.Failed,
            getProcessReason: () => null,
          })}
        />,
      );
      expect(screen.getByText("Generation failed. Please re-analyze.")).toBeInTheDocument();
    });

    it("takes precedence over lines when both present", () => {
      render(
        <ChatPanel
          {...makeProps({
            getProcessStatus: () => ProcessStatus.Failed,
            getProcessReason: () => STATUS_REASON.OUT_OF_CREDIT,
            lines: [{ role: "user", text: "Hello there" }],
          })}
        />,
      );
      expect(
        screen.getByText(STATUS_REASON_MESSAGE[STATUS_REASON.OUT_OF_CREDIT]),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Hello there/)).not.toBeInTheDocument();
    });
  });

  describe("renderMessages: empty state", () => {
    it("shows placeholder when lines are empty and not typing", () => {
      render(<ChatPanel {...makeProps({ lines: [], isAiTyping: false })} />);
      expect(
        screen.getByText("(No messages yet. Start typing below.)"),
      ).toBeInTheDocument();
    });
  });

  describe("renderMessages: lines", () => {
    it("renders a user line with the You: prefix", () => {
      render(
        <ChatPanel
          {...makeProps({ lines: [{ role: "user", text: "Hi assistant" }] })}
        />,
      );
      expect(screen.getByText("You:")).toBeInTheDocument();
      expect(screen.getByText(/Hi assistant/)).toBeInTheDocument();
    });

    it("renders an AI line with the JobbedIn-AI: prefix and markdown bold", () => {
      render(
        <ChatPanel
          {...makeProps({ lines: [{ role: "ai", text: "This is **bold** text" }] })}
        />,
      );
      expect(screen.getByText("JobbedIn-AI:")).toBeInTheDocument();
      const strong = screen.getByText("bold");
      expect(strong.tagName).toBe("STRONG");
    });

    it("appends a typing indicator row when isAiTyping is true", () => {
      render(
        <ChatPanel
          {...makeProps({
            lines: [{ role: "user", text: "Hi" }],
            isAiTyping: true,
            typingDots: "..",
          })}
        />,
      );
      expect(screen.getAllByText("JobbedIn-AI:")).toHaveLength(1);
      expect(screen.getByText("..")).toBeInTheDocument();
    });
  });

  describe("mode switching", () => {
    it("renders Message and Cover Letter buttons", () => {
      render(<ChatPanel {...makeProps()} />);
      expect(screen.getByRole("button", { name: "Message" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cover Letter" })).toBeInTheDocument();
    });

    it("calls setMode with Message when Message is clicked", async () => {
      const user = userEvent.setup();
      const setMode = vi.fn();
      render(<ChatPanel {...makeProps({ mode: ProcessType.Letter, setMode })} />);
      await user.click(screen.getByRole("button", { name: "Message" }));
      expect(setMode).toHaveBeenCalledWith(ProcessType.Message);
    });

    it("calls setMode with Letter when Cover Letter is clicked", async () => {
      const user = userEvent.setup();
      const setMode = vi.fn();
      render(<ChatPanel {...makeProps({ mode: ProcessType.Message, setMode })} />);
      await user.click(screen.getByRole("button", { name: "Cover Letter" }));
      expect(setMode).toHaveBeenCalledWith(ProcessType.Letter);
    });

    it("marks the Message button primary when mode is message", () => {
      render(<ChatPanel {...makeProps({ mode: ProcessType.Message })} />);
      expect(screen.getByRole("button", { name: "Message" })).toHaveClass("ym-btn-primary");
      expect(screen.getByRole("button", { name: "Cover Letter" })).not.toHaveClass(
        "ym-btn-primary",
      );
    });

    it("marks the Cover Letter button primary when mode is letter", () => {
      render(<ChatPanel {...makeProps({ mode: ProcessType.Letter })} />);
      expect(screen.getByRole("button", { name: "Cover Letter" })).toHaveClass(
        "ym-btn-primary",
      );
      expect(screen.getByRole("button", { name: "Message" })).not.toHaveClass(
        "ym-btn-primary",
      );
    });
  });

  describe("input area", () => {
    it("uses the letter placeholder in letter mode", () => {
      render(<ChatPanel {...makeProps({ mode: ProcessType.Letter })} />);
      expect(
        screen.getByPlaceholderText(
          "Tell me how you want your letter to be like: tone, content highlights, etc",
        ),
      ).toBeInTheDocument();
    });

    it("uses the message placeholder in message mode", () => {
      render(<ChatPanel {...makeProps({ mode: ProcessType.Message })} />);
      expect(
        screen.getByPlaceholderText(
          "Tell me how you want your message to look like: tone, content highlights, etc",
        ),
      ).toBeInTheDocument();
    });

    it("reflects chatDraft as the textarea value", () => {
      render(<ChatPanel {...makeProps({ chatDraft: "Draft text" })} />);
      expect(screen.getByPlaceholderText(/Tell me how/)).toHaveValue("Draft text");
    });

    it("calls setChatDraft when typing", async () => {
      const user = userEvent.setup();
      const setChatDraft = vi.fn();
      render(<ChatPanel {...makeProps({ setChatDraft })} />);
      const textarea = screen.getByPlaceholderText(/Tell me how/);
      await user.type(textarea, "a");
      expect(setChatDraft).toHaveBeenCalledWith("a");
    });

    it("calls handleSend and prevents newline insertion on Enter", async () => {
      const user = userEvent.setup();
      const handleSend = vi.fn();
      render(<ChatPanel {...makeProps({ handleSend })} />);
      const textarea = screen.getByPlaceholderText(/Tell me how/);
      await user.click(textarea);
      await user.keyboard("{Enter}");
      expect(handleSend).toHaveBeenCalledTimes(1);
      expect(textarea).toHaveValue("");
    });

    it("disables Send when canSend is false", () => {
      render(<ChatPanel {...makeProps({ canSend: false })} />);
      expect(screen.getByRole("button", { name: "Send ▶" })).toBeDisabled();
    });

    it("enables Send when canSend is true and calls handleSend on click", async () => {
      const user = userEvent.setup();
      const handleSend = vi.fn();
      render(<ChatPanel {...makeProps({ canSend: true, handleSend })} />);
      const sendButton = screen.getByRole("button", { name: "Send ▶" });
      expect(sendButton).not.toBeDisabled();
      await user.click(sendButton);
      expect(handleSend).toHaveBeenCalledTimes(1);
    });

    it("disables Clear when canClear is false", () => {
      render(<ChatPanel {...makeProps({ canClear: false })} />);
      expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    });

    it("enables Clear when canClear is true and calls handleClear on click", async () => {
      const user = userEvent.setup();
      const handleClear = vi.fn();
      render(<ChatPanel {...makeProps({ canClear: true, handleClear })} />);
      const clearButton = screen.getByRole("button", { name: "Clear" });
      expect(clearButton).not.toBeDisabled();
      await user.click(clearButton);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });
  });
});
