import {
  ClientOnly,
  Link,
  // biome-ignore lint/suspicious/noDeprecatedImports: the object-syntax overload is current; only legacy overloads are deprecated
  useBlocker,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Eye, Pencil, Save, Trash2 } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { MarkdownNoteEditorMethods } from "~/modules/notes/client/components/MarkdownNoteEditor.client";
import { MarkdownNoteViewer } from "~/modules/notes/client/components/MarkdownNoteViewer";
import { NoteAiComposer } from "~/modules/notes/client/components/NoteAiComposer";
import type { NotesSearchDTO } from "~/modules/notes/client/entities/dtos/NotesSearchDTO";
import { Button } from "~/shared/client/components/ui/button";
import { Input } from "~/shared/client/components/ui/input";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

const MarkdownNoteEditor = lazy(() =>
  import("~/modules/notes/client/components/MarkdownNoteEditor.client").then(
    (module) => ({ default: module.MarkdownNoteEditor }),
  ),
);

export function NoteDetailScreen({
  noteId,
  search,
}: {
  noteId: string;
  search: NotesSearchDTO;
}) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const selectedNote = useApp((state) => state.selectedNote);
  const isNoteSubmitting = useApp((state) => state.isNoteSubmitting);
  const isNoteRefining = useApp((state) => state.isNoteRefining);
  const loadNote = useApp((state) => state.loadNote);
  const updateNote = useApp((state) => state.updateNote);
  const deleteNote = useApp((state) => state.deleteNote);
  const refineNote = useApp((state) => state.refineNote);
  const editorRef = useRef<MarkdownNoteEditorMethods>(null);
  const [name, setName] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.notesPage;
  const note = selectedNote?.id === noteId ? selectedNote : undefined;
  const isDirty = Boolean(
    note && (name !== note.name || markdown !== note.markdown),
  );

  async function onSaveNote() {
    if (!note || !name.trim()) return;
    await updateNote(note.id, { name, markdown });
  }

  async function onDeleteNote() {
    if (!note || !window.confirm(t.deleteConfirmation)) return;
    const deleted = await deleteNote(note.id);
    if (deleted) navigate({ to: "/notes", search });
  }

  async function onRefineNote(instruction: string): Promise<boolean> {
    const revised = await refineNote(markdown, instruction);
    if (revised === undefined) return false;
    setMarkdown(revised);
    editorRef.current?.setMarkdown(revised);
    setIsPreviewing(false);
    return true;
  }

  useBlocker({
    disabled: !isDirty,
    enableBeforeUnload: isDirty,
    shouldBlockFn: () => window.confirm(t.discardConfirmation),
  });

  useEffect(() => {
    void loadNote(noteId);
  }, [noteId]);

  useEffect(() => {
    if (!note) return;
    setName(note.name);
    setMarkdown(note.markdown);
    editorRef.current?.setMarkdown(note.markdown);
  }, [note?.id, note?.updatedAt]);

  if (!note) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-3 p-4">
        <span className="sr-only">{t.loading}</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-20 flex items-center gap-1.5 border-term-border border-b bg-term-chrome/95 px-3 py-2 backdrop-blur-sm sm:gap-2 sm:px-5">
        <Button
          aria-label={t.backAction}
          className="w-11 px-0 sm:w-auto pointer-fine:sm:px-2.5 sm:px-3"
          nativeButton={false}
          render={<Link search={search} to="/notes" />}
          size="sm"
          title={t.backAction}
          variant="ghost"
        >
          <ArrowLeft />
          <span className="hidden sm:inline">{t.backAction}</span>
        </Button>
        <span
          aria-live="polite"
          className={
            isDirty
              ? "min-w-0 flex-1 truncate text-2xs text-term-amber uppercase"
              : "min-w-0 flex-1 truncate text-2xs text-term-green uppercase"
          }
        >
          {isDirty ? t.unsavedStatus : t.savedStatus}
        </span>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            aria-label={t.editAction}
            aria-pressed={!isPreviewing}
            className="w-11 px-0 sm:w-auto pointer-fine:sm:px-2.5 sm:px-3"
            onClick={() => setIsPreviewing(false)}
            size="sm"
            title={t.editAction}
            type="button"
            variant={isPreviewing ? "ghost" : "outline"}
          >
            <Pencil />
            <span className="hidden sm:inline">{t.editAction}</span>
          </Button>
          <Button
            aria-label={t.previewAction}
            aria-pressed={isPreviewing}
            className="w-11 px-0 sm:w-auto pointer-fine:sm:px-2.5 sm:px-3"
            onClick={() => setIsPreviewing(true)}
            size="sm"
            title={t.previewAction}
            type="button"
            variant={isPreviewing ? "outline" : "ghost"}
          >
            <Eye />
            <span className="hidden sm:inline">{t.previewAction}</span>
          </Button>
          <Button
            aria-label={t.saveAction}
            className="w-11 px-0 sm:w-auto pointer-fine:sm:px-2.5 sm:px-3"
            disabled={!isDirty || isNoteSubmitting || !name.trim()}
            onClick={onSaveNote}
            size="sm"
            title={t.saveAction}
            type="button"
          >
            <Save />
            <span className="hidden sm:inline">{t.saveAction}</span>
          </Button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:px-0 sm:py-6 md:py-8">
        <div className="border-term-border border-b pb-2">
          <label className="sr-only" htmlFor="note-name">
            {t.nameLabel}
          </label>
          <Input
            id="note-name"
            className="h-auto rounded-none border-0 bg-transparent px-0 py-2 font-mono font-semibold text-2xl text-term-bright shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:text-3xl"
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <p className="m-0 font-mono text-2xs text-term-muted">
            {t.markdownHint}
          </p>
        </div>
        <div hidden={isPreviewing}>
          <ClientOnly
            fallback={
              <Skeleton className="h-[32rem] w-full rounded-lg border border-term-border" />
            }
          >
            <Suspense
              fallback={
                <Skeleton className="h-[32rem] w-full rounded-lg border border-term-border" />
              }
            >
              <MarkdownNoteEditor
                ref={editorRef}
                initialMarkdown={markdown}
                label={t.editorLabel}
                onChange={setMarkdown}
                placeholder={t.editorPlaceholder}
              />
            </Suspense>
          </ClientOnly>
        </div>
        <div hidden={!isPreviewing}>
          <div className="min-h-[32rem] rounded-lg border border-term-border bg-term-bg/45 p-5 sm:p-8">
            <MarkdownNoteViewer emptyLabel={t.emptyNote} markdown={markdown} />
          </div>
        </div>
        <NoteAiComposer
          disabled={!name.trim()}
          isRefining={isNoteRefining}
          onRefine={onRefineNote}
          t={t}
        />
        <div className="flex justify-end border-term-border border-t pt-3">
          <Button
            className="min-h-11 md:min-h-8"
            disabled={isNoteSubmitting}
            onClick={onDeleteNote}
            type="button"
            variant="destructive"
          >
            <Trash2 />
            {t.deleteAction}
          </Button>
        </div>
      </div>
    </div>
  );
}
