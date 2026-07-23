import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";

type SidebarItem = { id: string; name: string };

function makeProps(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const items: SidebarItem[] = overrides.items ?? [
    { id: "1", name: "Alpha" },
    { id: "2", name: "Beta" },
  ];
  return {
    title: "My List",
    addLabel: "Add Item",
    onAdd: vi.fn(),
    items,
    selectedId: null,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("Sidebar", () => {
  it("renders the title and add label, and clicking add calls onAdd", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Sidebar {...props} />);

    expect(screen.getByText(/My List/)).toBeInTheDocument();
    const addButton = screen.getByRole("button", { name: "Add Item" });
    await user.click(addButton);
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it("shows the empty placeholder when items is empty", () => {
    render(<Sidebar {...makeProps({ items: [] })} />);
    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });

  it("hides the empty placeholder when items are present", () => {
    render(<Sidebar {...makeProps()} />);
    expect(screen.queryByText("(empty)")).not.toBeInTheDocument();
  });

  it("renders one row per item with item names", () => {
    render(<Sidebar {...makeProps()} />);
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Beta/)).toBeInTheDocument();
  });

  it("calls onSelect with the item's id when a row is clicked", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Sidebar {...props} />);

    await user.click(screen.getByText(/Alpha/));
    expect(props.onSelect).toHaveBeenCalledWith("1");
  });

  it("clicking delete calls onDelete with the id and not onSelect", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Sidebar {...props} />);

    const deleteButton = screen.getByRole("button", { name: "Delete Alpha" });
    await user.click(deleteButton);

    expect(props.onDelete).toHaveBeenCalledWith("1");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("marks the selected row with data-active=true and others false", () => {
    const { container } = render(<Sidebar {...makeProps({ selectedId: "2" })} />);
    const rows = container.querySelectorAll(".ym-listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-active", "false");
    expect(rows[1]).toHaveAttribute("data-active", "true");
  });

  it("renders header and footer nodes when supplied", () => {
    render(
      <Sidebar
        {...makeProps()}
        header={<div>Header Content</div>}
        footer={<div>Footer Content</div>}
      />
    );
    expect(screen.getByText("Header Content")).toBeInTheDocument();
    expect(screen.getByText("Footer Content")).toBeInTheDocument();
  });

  it("omits header and footer when not supplied", () => {
    render(<Sidebar {...makeProps()} />);
    expect(screen.queryByText("Header Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Footer Content")).not.toBeInTheDocument();
  });
});
