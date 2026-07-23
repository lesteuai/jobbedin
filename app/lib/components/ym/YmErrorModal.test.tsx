import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { YmErrorModal } from "./YmErrorModal";

describe("YmErrorModal", () => {
  it("renders nothing when open is false", () => {
    render(<YmErrorModal open={false} message="Something broke" onClose={vi.fn()} />);
    expect(screen.queryByText(/Error/)).not.toBeInTheDocument();
    expect(screen.queryByText("Something broke")).not.toBeInTheDocument();
  });

  it("renders the Error titlebar text and the message when open", () => {
    render(<YmErrorModal open message="Something broke" onClose={vi.fn()} />);
    expect(screen.getByText(/Error/)).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("the OK button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<YmErrorModal open message="Something broke" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the overlay calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <YmErrorModal open message="Something broke" onClose={onClose} />,
    );
    const overlay = container.querySelector(".ym-modal-overlay");
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the window body does not call onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <YmErrorModal open message="Something broke" onClose={onClose} />,
    );
    const modalWindow = container.querySelector(".ym-window");
    expect(modalWindow).not.toBeNull();
    await user.click(modalWindow as Element);
    expect(onClose).not.toHaveBeenCalled();
  });
});
