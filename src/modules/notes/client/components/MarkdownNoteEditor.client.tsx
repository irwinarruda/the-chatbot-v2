import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  codeBlockPlugin,
  codeMirrorPlugin,
  DiffSourceToggleWrapper,
  diffSourcePlugin,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  type MDXEditorMethods,
  markdownShortcutPlugin,
  quotePlugin,
  StrikeThroughSupSubToggles,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { forwardRef } from "react";

export type MarkdownNoteEditorMethods = MDXEditorMethods;

export interface MarkdownNoteEditorProps {
  initialMarkdown: string;
  label: string;
  placeholder: string;
  onChange: (markdown: string) => void;
}

const editorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  thematicBreakPlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
  codeMirrorPlugin({
    autoLoadLanguageSupport: false,
    codeBlockLanguages: {
      "": "Plain text",
      bash: "Shell",
      css: "CSS",
      html: "HTML",
      javascript: "JavaScript",
      json: "JSON",
      markdown: "Markdown",
      sql: "SQL",
      typescript: "TypeScript",
    },
  }),
  diffSourcePlugin({ viewMode: "rich-text" }),
  markdownShortcutPlugin(),
  toolbarPlugin({
    toolbarClassName: "notes-editor-toolbar",
    toolbarContents: () => (
      <DiffSourceToggleWrapper options={["rich-text", "source"]}>
        <UndoRedo />
        <BlockTypeSelect />
        <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
        <StrikeThroughSupSubToggles options={["Strikethrough"]} />
        <CodeToggle />
        <ListsToggle />
        <CreateLink />
        <InsertTable />
        <InsertThematicBreak />
        <InsertCodeBlock />
      </DiffSourceToggleWrapper>
    ),
  }),
];

export const MarkdownNoteEditor = forwardRef<
  MarkdownNoteEditorMethods,
  MarkdownNoteEditorProps
>(function MarkdownNoteEditor(
  { initialMarkdown, label, placeholder, onChange },
  ref,
) {
  return (
    <fieldset className="notes-editor-shell">
      <legend className="sr-only">{label}</legend>
      <MDXEditor
        ref={ref}
        className="notes-editor"
        contentEditableClassName="notes-editor-content"
        markdown={initialMarkdown}
        onChange={(markdown, initialMarkdownNormalize) => {
          if (!initialMarkdownNormalize) onChange(markdown);
        }}
        placeholder={placeholder}
        plugins={editorPlugins}
        spellCheck
        suppressHtmlProcessing
      />
    </fieldset>
  );
});
