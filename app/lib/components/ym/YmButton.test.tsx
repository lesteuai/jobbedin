import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { YmButton } from "./YmButton";

describe("YmButton", () => {
  it("renders its children", () => {
    render(<YmButton>Click me</YmButton>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("always carries the ym-btn class", () => {
    render(<YmButton>Click me</YmButton>);
    expect(screen.getByRole("button")).toHaveClass("ym-btn");
  });

  it("carries ym-btn-primary only when variant is primary", () => {
    render(<YmButton variant="primary">Primary</YmButton>);
    expect(screen.getByRole("button")).toHaveClass("ym-btn-primary");
  });

  it("does not carry ym-btn-primary for the default variant", () => {
    render(<YmButton>Default</YmButton>);
    expect(screen.getByRole("button")).not.toHaveClass("ym-btn-primary");
  });

  it("does not carry ym-btn-primary when variant is explicitly default", () => {
    render(<YmButton variant="default">Default</YmButton>);
    expect(screen.getByRole("button")).not.toHaveClass("ym-btn-primary");
  });

  it("merges a caller-supplied className alongside built-in classes", () => {
    render(<YmButton className="custom-class">Click me</YmButton>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("ym-btn");
    expect(button).toHaveClass("custom-class");
  });

  it("forwards arbitrary button props", () => {
    render(
      <YmButton
        disabled
        type="submit"
        aria-label="submit-button"
        style={{ color: "red" }}
      >
        Submit
      </YmButton>,
    );
    const button = screen.getByRole("button", { name: "submit-button" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveStyle({ color: "rgb(255, 0, 0)" });
  });

  it("fires onClick on click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<YmButton onClick={onClick}>Click me</YmButton>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <YmButton onClick={onClick} disabled>
        Click me
      </YmButton>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
