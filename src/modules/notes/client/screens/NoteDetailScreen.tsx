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
    <div className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-term-border border-b bg-term-chrome/95 p-3 backdrop-blur-sm">
        <Button
          className="min-h-11 md:hidden"
          render={<Link search={search} to="/notes" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft />
          {t.backAction}
        </Button>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span
            className={
              isDirty
                ? "mr-auto text-2xs text-term-amber uppercase"
                : "mr-auto text-2xs text-term-green uppercase"
            }
          >
            {isDirty ? t.unsavedStatus : t.savedStatus}
          </span>
          <Button
            aria-pressed={!isPreviewing}
            className="min-h-11 md:min-h-8"
            onClick={() => setIsPreviewing(false)}
            size="sm"
            type="button"
            variant={isPreviewing ? "ghost" : "outline"}
          >
            <Pencil />
            {t.editAction}
          </Button>
          <Button
            aria-pressed={isPreviewing}
            className="min-h-11 md:min-h-8"
            onClick={() => setIsPreviewing(true)}
            size="sm"
            type="button"
            variant={isPreviewing ? "outline" : "ghost"}
          >
            <Eye />
            {t.previewAction}
          </Button>
          <Button
            className="min-h-11 md:min-h-8"
            disabled={!isDirty || isNoteSubmitting || !name.trim()}
            onClick={onSaveNote}
            size="sm"
            type="button"
          >
            <Save />
            {t.saveAction}
          </Button>
        </div>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div>
          <label
            className="mb-1.5 block font-mono text-2xs text-term-muted uppercase tracking-wide"
            htmlFor="note-name"
          >
            {t.nameLabel}
          </label>
          <Input
            id="note-name"
            className="h-11 font-semibold text-base text-term-bright md:h-8 md:text-sm"
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        {isPreviewing ? (
          <div className="min-h-96 rounded border border-term-border bg-term-bg/45 p-4 sm:p-6">
            <MarkdownNoteViewer emptyLabel={t.emptyNote} markdown={markdown} />
          </div>
        ) : (
          <ClientOnly
            fallback={
              <Skeleton className="h-96 w-full rounded border border-term-border" />
            }
          >
            <Suspense
              fallback={
                <Skeleton className="h-96 w-full rounded border border-term-border" />
              }
            >
              <MarkdownNoteEditor
                ref={editorRef}
                initialMarkdown={note.markdown}
                label={t.editorLabel}
                onChange={setMarkdown}
                placeholder={t.editorPlaceholder}
              />
            </Suspense>
          </ClientOnly>
        )}
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
