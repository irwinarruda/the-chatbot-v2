import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, useImperativeHandle, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { NoteDetailScreen } from "~/modules/notes/client/screens/NoteDetailScreen";

const { appState, note } = vi.hoisted(() => {
  const note = {
    id: "2d43dd2f-c399-4013-bb04-ad958ab8cd86",
    name: "Working note",
    markdown: "Saved text",
    createdAt: "2026-07-21T12:00:00.000Z",
    updatedAt: "2026-07-21T12:00:00.000Z",
  };
  return {
    note,
    appState: {
      selectedNote: note,
      isNoteSubmitting: false,
      isNoteRefining: false,
      loadNote: vi.fn(async () => note),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      refineNote: vi.fn(),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  ClientOnly: ({ children }: { children: React.ReactNode }) => children,
  Link: forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>(
    function MockLink(props, ref) {
      return <a {...props} href="/notes" ref={ref} />;
    },
  ),
  useBlocker: vi.fn(),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/shared/client/providers/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark" }),
}));

vi.mock("~/shared/client/stores", () => ({
  useApp: (selector: (state: typeof appState) => unknown) => selector(appState),
}));

vi.mock("~/modules/notes/client/components/MarkdownNoteEditor.client", () => ({
  MarkdownNoteEditor: forwardRef<
    { setMarkdown: (markdown: string) => void },
    {
      initialMarkdown: string;
      label: string;
      onChange: (markdown: string) => void;
    }
  >(function MockMarkdownNoteEditor({ initialMarkdown, label, onChange }, ref) {
    const [markdown, setMarkdown] = useState(initialMarkdown);
    useImperativeHandle(ref, () => ({ setMarkdown }));
    return (
      <textarea
        aria-label={label}
        onChange={(event) => {
          setMarkdown(event.target.value);
          onChange(event.target.value);
        }}
        value={markdown}
      />
    );
  }),
}));

describe("NoteDetailScreen", () => {
  test("keeps the current draft when previewing and returning to edit", async () => {
    const user = userEvent.setup();
    render(<NoteDetailScreen noteId={note.id} search={{}} />);
    const editor = await screen.findByRole("textbox", {
      name: "Markdown note editor",
    });

    await user.clear(editor);
    await user.type(editor, "# Current draft");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(
      screen.getByRole("heading", { name: "Current draft" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(editor).toHaveValue("# Current draft");
  });
});
