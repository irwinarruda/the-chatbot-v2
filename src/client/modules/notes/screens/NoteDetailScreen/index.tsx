import {
  ClientOnly,
  Link,
  // biome-ignore lint/suspicious/noDeprecatedImports: the object-syntax overload is current; only legacy overloads are deprecated
  useBlocker,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Eye, Pencil, Save, Sparkles, Trash2 } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { NotesSearchDTO } from "~/client/modules/notes/app/dtos/NotesSearchDTO";
import { ConfirmDialog } from "~/client/shared/components/ConfirmDialog";
import { Button } from "~/client/shared/components/ui/button";
import { Input } from "~/client/shared/components/ui/input";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { MarkdownNoteEditorMethods } from "./MarkdownNoteEditor.client";
import { MarkdownNoteViewer } from "./MarkdownNoteViewer";
import { NoteAiComposer } from "./NoteAiComposer";

const MarkdownNoteEditor = lazy(() =>
  import("./MarkdownNoteEditor.client").then((module) => ({
    default: module.MarkdownNoteEditor,
  })),
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
  const closeNote = useApp((state) => state.closeNote);
  const loadNote = useApp((state) => state.loadNote);
  const updateNote = useApp((state) => state.updateNote);
  const deleteNote = useApp((state) => state.deleteNote);
  const refineNote = useApp((state) => state.refineNote);
  const editorRef = useRef<MarkdownNoteEditorMethods>(null);
  const [name, setName] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.notesPage;
  const note = selectedNote?.id === noteId ? selectedNote : undefined;
  const isDirty = Boolean(
    note && (name !== note.name || markdown !== note.markdown),
  );

  async function onSaveNote() {
    if (!note || !name.trim()) return;
    const normalizedName = name.trim();
    setName(normalizedName);
    await updateNote(note.id, { name: normalizedName, markdown });
  }

  async function onDeleteNote() {
    if (!note) return;
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
    shouldBlockFn: () => !window.confirm(t.discardConfirmation),
  });

  useEffect(() => {
    void loadNote(noteId);
    return closeNote;
  }, [noteId, loadNote, closeNote]);

  useEffect(() => {
    if (!note) return;
    setName(note.name);
    setMarkdown(note.markdown);
    editorRef.current?.setMarkdown(note.markdown);
  }, [note?.id]);

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
      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-1.5 border-border border-b bg-background/95 px-4 py-2 backdrop-blur-sm sm:-mx-8 sm:gap-2 sm:px-6 lg:top-0">
        <Button
          aria-label={t.backAction}
          className="px-2.5"
          nativeButton={false}
          render={<Link search={search} to="/notes" />}
          size="sm"
          title={t.backAction}
          variant="ghost"
        >
          <ArrowLeft />
          <span className="sr-only">{t.backAction}</span>
        </Button>
        <span
          aria-live="polite"
          className={
            isDirty
              ? "min-w-0 flex-1 truncate text-warning text-xs"
              : "min-w-0 flex-1 truncate text-muted-foreground text-xs"
          }
        >
          {isDirty ? t.unsavedStatus : t.savedStatus}
        </span>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            <Button
              aria-label={t.editAction}
              aria-pressed={!isPreviewing}
              className="px-2.5 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
              onClick={() => setIsPreviewing(false)}
              size="sm"
              title={t.editAction}
              type="button"
              variant="ghost"
            >
              <Pencil />
              {t.editAction}
            </Button>
            <Button
              aria-label={t.previewAction}
              aria-pressed={isPreviewing}
              className="px-2.5 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
              onClick={() => setIsPreviewing(true)}
              size="sm"
              title={t.previewAction}
              type="button"
              variant="ghost"
            >
              <Eye />
              {t.previewAction}
            </Button>
          </div>
          {isDirty && (
            <Button
              aria-label={t.saveAction}
              className="px-2.5"
              disabled={!isDirty || isNoteSubmitting || !name.trim()}
              onClick={onSaveNote}
              size="sm"
              title={t.saveAction}
              type="button"
            >
              <Save />
              {t.saveAction}
            </Button>
          )}
        </div>
      </div>
      <div className="w-full space-y-5 py-5 sm:py-6">
        <div className="border-border border-b pb-2 transition-colors focus-within:border-ring">
          <label className="sr-only" htmlFor="note-name">
            {t.nameLabel}
          </label>
          <Input
            id="note-name"
            className="h-auto rounded-none border-0 bg-transparent px-0 py-1 font-semibold pointer-fine:text-2xl text-2xl text-foreground tracking-tight shadow-none focus-visible:border-transparent focus-visible:ring-0"
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <p className="m-0 text-muted-foreground text-xs">{t.markdownHint}</p>
        </div>
        <div hidden={isPreviewing}>
          <ClientOnly
            fallback={
              <Skeleton className="h-[32rem] w-full rounded-lg border border-border" />
            }
          >
            <Suspense
              fallback={
                <Skeleton className="h-[32rem] w-full rounded-lg border border-border" />
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
          <div className="min-h-[32rem] rounded-lg border border-border bg-background/45 p-5 sm:p-8">
            <MarkdownNoteViewer emptyLabel={t.emptyNote} markdown={markdown} />
          </div>
        </div>
        {isAiOpen ? (
          <NoteAiComposer
            disabled={!name.trim()}
            isRefining={isNoteRefining}
            onRefine={onRefineNote}
            t={t}
          />
        ) : (
          <Button
            className="text-muted-foreground"
            onClick={() => setIsAiOpen(true)}
            type="button"
            variant="ghost"
          >
            <Sparkles className="text-primary" />
            {t.aiOpenAction}
          </Button>
        )}
        <div className="flex justify-end border-border border-t pt-3">
          <ConfirmDialog
            cancelLabel={t.cancelAction}
            confirmLabel={t.deleteAction}
            description={t.deleteConfirmation}
            isDisabled={isNoteSubmitting}
            onConfirm={onDeleteNote}
            title={t.deleteTitle.replace("{name}", note.name)}
            trigger={
              <Button
                className="min-h-11 md:min-h-8"
                disabled={isNoteSubmitting}
                type="button"
                variant="ghost"
              >
                <Trash2 />
                {t.deleteAction}
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
