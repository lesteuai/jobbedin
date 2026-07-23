import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { YmModal } from "./YmModal";

describe("YmModal", () => {
  it("renders nothing when open is false", () => {
    render(
      <YmModal open={false} onOk={vi.fn()} onCancel={vi.fn()}>
        Body content
      </YmModal>,
    );
    expect(screen.queryByText("JobbedIn", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("Body content")).not.toBeInTheDocument();
  });

  it("renders the default title when open", () => {
    render(
      <YmModal open onOk={vi.fn()} onCancel={vi.fn()}>
        Body content
      </YmModal>,
    );
    expect(screen.getByText(/JobbedIn/)).toBeInTheDocument();
  });

  it("renders a custom title when supplied", () => {
    render(
      <YmModal open title="Confirm Delete" onOk={vi.fn()} onCancel={vi.fn()}>
        Body content
      </YmModal>,
    );
    expect(screen.getByText(/Confirm Delete/)).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(
      <YmModal open onOk={vi.fn()} onCancel={vi.fn()}>
        Body content
      </YmModal>,
    );
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("renders the default OK and Cancel labels", () => {
    render(
      <YmModal open onOk={vi.fn()} onCancel={vi.fn()}>
        Body content
      </YmModal>,
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders custom okLabel and cancelLabel when supplied", () => {
    render(
      <YmModal
        open
        okLabel="Delete"
        cancelLabel="Keep"
        onOk={vi.fn()}
        onCancel={vi.fn()}
      >
        Body content
      </YmModal>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
  });

  it("clicking OK calls onOk and not onCancel", async () => {
    const user = userEvent.setup();
    const onOk = vi.fn();
    const onCancel = vi.fn();
    render(
      <YmModal open onOk={onOk} onCancel={onCancel}>
        Body content
      </YmModal>,
    );
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(onOk).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("clicking Cancel calls onCancel and not onOk", async () => {
    const user = userEvent.setup();
    const onOk = vi.fn();
    const onCancel = vi.fn();
    render(
      <YmModal open onOk={onOk} onCancel={onCancel}>
        Body content
      </YmModal>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOk).not.toHaveBeenCalled();
  });

  it("clicking the overlay calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { container } = render(
      <YmModal open onOk={vi.fn()} onCancel={onCancel}>
        Body content
      </YmModal>,
    );
    const overlay = container.querySelector(".ym-modal-overlay");
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the modal window body does not call onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { container } = render(
      <YmModal open onOk={vi.fn()} onCancel={onCancel}>
        Body content
      </YmModal>,
    );
    const modalWindow = container.querySelector(".ym-window");
    expect(modalWindow).not.toBeNull();
    await user.click(modalWindow as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
