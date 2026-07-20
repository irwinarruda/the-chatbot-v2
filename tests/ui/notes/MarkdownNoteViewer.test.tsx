import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MarkdownNoteViewer } from "~/modules/notes/client/components/MarkdownNoteViewer";

describe("MarkdownNoteViewer", () => {
  test("renders portable Markdown and ignores raw HTML", () => {
    const { container } = render(
      <MarkdownNoteViewer
        emptyLabel="Nothing here yet."
        markdown={[
          "# Reading list",
          "",
          "- [x] Saved",
          "- [ ] Read later",
          "",
          "[Example](https://example.com)",
          "",
          "<script>alert('no')</script>",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Reading list" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")[0]).toBeDisabled();
    expect(screen.getByRole("link", { name: /Example/ })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(container.querySelector("script")).toBeNull();
  });
});
