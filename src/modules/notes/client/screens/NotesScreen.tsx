import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { FileText, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NotesSearchDTO } from "~/modules/notes/client/entities/dtos/NotesSearchDTO";
import type { NoteErrorCode } from "~/modules/notes/client/state/noteSlice";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/shared/client/components/ui/alert";
import { Button } from "~/shared/client/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "~/shared/client/components/ui/empty";
import { Input } from "~/shared/client/components/ui/input";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

const loadingRows = ["first", "second", "third", "fourth"];

export function NotesScreen({ search }: { search: NotesSearchDTO }) {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const prefs = usePrefs();
  const notes = useApp((state) => state.notes);
  const noteError = useApp((state) => state.noteError);
  const isNoteBootstrapping = useApp((state) => state.isNoteBootstrapping);
  const isNoteSubmitting = useApp((state) => state.isNoteSubmitting);
  const bootstrapNotes = useApp((state) => state.bootstrapNotes);
  const createNote = useApp((state) => state.createNote);
  const clearNoteError = useApp((state) => state.clearNoteError);
  const [newName, setNewName] = useState("");
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.notesPage;
  const hasSelectedNote = pathname.startsWith("/notes/");
  const errorMessages: Record<NoteErrorCode, string> = {
    loading: t.errorLoading,
    saving: t.errorSaving,
    deleting: t.errorDeleting,
    refining: t.errorRefining,
  };
  const errorMessage = noteError ? errorMessages[noteError] : undefined;

  function onSearchChange(value: string) {
    navigate({ to: "/notes", search: value.trim() ? { q: value } : {} });
  }

  async function onCreateNote(event: React.FormEvent) {
    event.preventDefault();
    const note = await createNote(newName);
    if (!note) return;
    setNewName("");
    navigate({
      to: "/notes/$noteId",
      params: { noteId: note.id },
      search,
    });
  }

  useEffect(() => {
    void bootstrapNotes(search.q);
  }, [search.q]);

  return (
    <TerminalWindow
      title={t.windowTitle}
      wide
      activePath="/notes"
      dictionary={dictionary}
      showLogout
      mainClassName="items-stretch sm:items-start"
      frameClassName="page-frame-min-height"
      windowClassName="relative overflow-hidden"
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      {errorMessage && (
        <Alert
          className="mb-4 border-term-red/30 bg-term-red/10"
          variant="destructive"
        >
          <X />
          <AlertDescription>{errorMessage}</AlertDescription>
          <AlertAction>
            <Button
              aria-label={dictionary.common.dismiss}
              onClick={clearNoteError}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}
      <div className="min-h-0 flex-1 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:border md:border-term-border">
        <aside
          className={
            hasSelectedNote
              ? "hidden min-h-0 border-term-border bg-term-bg/35 md:block md:border-r"
              : "min-h-0 border-term-border bg-term-bg/35 md:border-r"
          }
        >
          <div className="space-y-3 border-term-border border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-term-muted" />
              <Input
                aria-label={t.searchPlaceholder}
                className="pl-8 text-base md:text-sm"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t.searchPlaceholder}
                type="search"
                value={search.q ?? ""}
              />
            </div>
            <form className="flex gap-2" onSubmit={onCreateNote}>
              <Input
                aria-label={t.newNamePlaceholder}
                className="min-w-0 text-base md:text-sm"
                maxLength={160}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t.newNamePlaceholder}
                value={newName}
              />
              <Button
                aria-label={t.createAction}
                className="min-h-11 shrink-0 md:min-h-8"
                disabled={isNoteSubmitting || !newName.trim()}
                size="icon"
                type="submit"
              >
                <Plus />
              </Button>
            </form>
          </div>
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2 font-mono text-2xs text-term-muted uppercase tracking-wide">
              <FileText className="size-3.5 text-term-green" />
              {t.listLabel}
            </div>
            {isNoteBootstrapping ? (
              <div aria-busy="true" aria-live="polite" className="space-y-2">
                <span className="sr-only">{t.loading}</span>
                {loadingRows.map((row) => (
                  <Skeleton
                    key={row}
                    className="h-16 rounded border border-term-border bg-term-chrome/50"
                  />
                ))}
              </div>
            ) : notes.length > 0 ? (
              <ul className="m-0 list-none space-y-1 p-0">
                {notes.map((note) => {
                  const isActive = pathname === `/notes/${note.id}`;
                  return (
                    <li key={note.id}>
                      <Link
                        className={
                          isActive
                            ? "block border-term-green border-l-2 bg-term-green/8 px-3 py-2 text-term-green"
                            : "block border-transparent border-l-2 px-3 py-2 text-term-bright hover:border-term-green/50 hover:bg-term-chrome/70"
                        }
                        params={{ noteId: note.id }}
                        search={search}
                        to="/notes/$noteId"
                      >
                        <span className="line-clamp-2 block font-medium text-sm">
                          {note.name}
                        </span>
                        <time
                          className="mt-1 block text-2xs text-term-muted"
                          dateTime={note.updatedAt}
                        >
                          {new Date(note.updatedAt).toLocaleDateString(
                            prefs.locale,
                          )}
                        </time>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty className="border border-term-border border-dashed py-8">
                <EmptyHeader>
                  <EmptyTitle className="text-term-muted text-xs">
                    {t.emptyState}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </aside>
        <section
          aria-label={t.editorLabel}
          className={
            hasSelectedNote
              ? "min-w-0 bg-term-window"
              : "hidden min-w-0 bg-term-window md:block"
          }
        >
          {hasSelectedNote ? (
            <Outlet />
          ) : (
            <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-term-muted">
              <p className="max-w-sm">{t.selectState}</p>
            </div>
          )}
        </section>
      </div>
    </TerminalWindow>
  );
}
