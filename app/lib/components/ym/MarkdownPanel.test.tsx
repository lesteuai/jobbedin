import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownPanel } from "./MarkdownPanel";

describe("MarkdownPanel", () => {
  it("renders plain text without error", () => {
    render(<MarkdownPanel>Hello, world!</MarkdownPanel>);
    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  });

  it("renders an empty string without throwing", () => {
    expect(() => {
      render(<MarkdownPanel>{""}</MarkdownPanel>);
    }).not.toThrow();
  });

  it("renders h1 heading with purple class override", () => {
    render(<MarkdownPanel># Main Heading</MarkdownPanel>);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-[#5b2b82]");
    expect(heading).toHaveClass("text-2xl");
    expect(heading).toHaveClass("font-bold");
    expect(heading).toHaveClass("mb-4");
  });

  it("renders h3 heading with purple class override", () => {
    render(<MarkdownPanel>### Sub Heading</MarkdownPanel>);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-[#5b2b82]");
    expect(heading).toHaveClass("text-lg");
    expect(heading).toHaveClass("font-bold");
    expect(heading).toHaveClass("mt-5");
    expect(heading).toHaveClass("mb-2");
  });

  it("renders paragraph with mb-4 class override", () => {
    render(
      <MarkdownPanel>This is a paragraph of text.</MarkdownPanel>
    );
    const paragraph = screen.getByRole("paragraph");
    expect(paragraph).toBeInTheDocument();
    expect(paragraph).toHaveClass("mb-4");
  });

  it("renders a bullet list with ul override classes", () => {
    const markdown = `- Item one
- Item two
- Item three`;
    render(<MarkdownPanel>{markdown}</MarkdownPanel>);
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    expect(list).toHaveClass("list-disc");
    expect(list).toHaveClass("pl-5");
    expect(list).toHaveClass("mb-4");
    expect(list).toHaveClass("space-y-1");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Item one");
    expect(items[1]).toHaveTextContent("Item two");
    expect(items[2]).toHaveTextContent("Item three");
  });

  it("renders a GFM pipe table (proves remark-gfm is wired)", () => {
    const markdown = `| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`;
    render(<MarkdownPanel>{markdown}</MarkdownPanel>);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
  });

  it("renders inline math without throwing", () => {
    expect(() => {
      render(<MarkdownPanel>Inline math: $E = mc^2$</MarkdownPanel>);
    }).not.toThrow();
    expect(screen.getByText("Inline math:")).toBeInTheDocument();
  });

  it("renders multiple headings and paragraphs together", () => {
    const markdown = `# Company Name

### Description

This is a description.

### Why You're a Match

- Relevant skill 1
- Relevant skill 2`;
    render(<MarkdownPanel>{markdown}</MarkdownPanel>);

    const h1 = screen.getByRole("heading", { level: 1 });
    const h3s = screen.getAllByRole("heading", { level: 3 });
    const list = screen.getByRole("list");

    expect(h1).toHaveTextContent("Company Name");
    expect(h1).toHaveClass("text-[#5b2b82]");

    expect(h3s).toHaveLength(2);
    h3s.forEach((h3) => {
      expect(h3).toHaveClass("text-[#5b2b82]");
    });

    expect(list).toBeInTheDocument();
  });
});
