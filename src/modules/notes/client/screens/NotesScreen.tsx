import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ChevronRight, FileText, Plus, Search, X } from "lucide-react";
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
import { Card, CardContent } from "~/shared/client/components/ui/card";
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

function getNoteExcerpt(markdown: string, emptyLabel: string) {
  const excerpt = markdown
    .replace(/[`#>*_[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!excerpt) return emptyLabel;
  return excerpt;
}

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
      navigationClassName={hasSelectedNote ? "mb-3" : undefined}
      windowClassName={
        hasSelectedNote
          ? "relative overflow-hidden p-0 sm:pt-3 sm:pb-0 md:pb-0"
          : "relative overflow-hidden"
      }
    >
      {!hasSelectedNote && (
        <TerminalPageHeader
          heading={t.heading}
          subtitle={t.subtitle}
          withLogo={false}
        />
      )}
      {errorMessage && (
        <div className={hasSelectedNote ? "px-4 pt-4 sm:px-6" : undefined}>
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
        </div>
      )}
      {hasSelectedNote ? (
        <Outlet />
      ) : (
        <section aria-label={t.listLabel} className="min-h-0 flex-1">
          <Card
            className="mb-4 gap-0 border-term-border bg-term-chrome/45 py-0 shadow-none"
            size="sm"
          >
            <CardContent className="grid gap-3 p-3 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-term-muted" />
                <Input
                  aria-label={t.searchPlaceholder}
                  className="min-h-11 pl-8 text-base md:min-h-8 md:text-sm"
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  type="search"
                  value={search.q ?? ""}
                />
              </div>
              <form className="flex gap-2" onSubmit={onCreateNote}>
                <Input
                  aria-label={t.newNamePlaceholder}
                  className="min-h-11 min-w-0 text-base md:min-h-8 md:text-sm"
                  maxLength={160}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder={t.newNamePlaceholder}
                  value={newName}
                />
                <Button
                  className="min-h-11 shrink-0 md:min-h-8"
                  disabled={isNoteSubmitting || !newName.trim()}
                  type="submit"
                >
                  <Plus />
                  {t.createAction}
                </Button>
              </form>
            </CardContent>
          </Card>
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
                  className="h-16 rounded-lg border border-term-border bg-term-chrome/50"
                />
              ))}
            </div>
          ) : notes.length > 0 ? (
            <ul className="m-0 list-none space-y-2 p-0">
              {notes.map((note) => (
                <li key={note.id}>
                  <Card
                    className="gap-0 border-term-border border-l-2 bg-term-bg/35 py-0 shadow-none transition-colors hover:border-l-term-green hover:bg-term-chrome/70"
                    size="sm"
                  >
                    <Link
                      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg px-2.5 py-2"
                      params={{ noteId: note.id }}
                      search={search}
                      to="/notes/$noteId"
                    >
                      <FileText className="mt-0.5 size-4 text-term-green" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-sm text-term-bright transition-colors group-hover:text-term-green">
                          {note.name}
                        </span>
                        <span className="mt-1 line-clamp-2 block font-sans text-sm text-term-muted leading-relaxed">
                          {getNoteExcerpt(note.markdown, t.emptyNote)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-term-muted">
                        <time
                          className="hidden text-2xs sm:block"
                          dateTime={note.updatedAt}
                        >
                          {new Date(note.updatedAt).toLocaleDateString(
                            prefs.locale,
                          )}
                        </time>
                        <ChevronRight className="mt-0.5 size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-term-green motion-reduce:transition-none" />
                      </span>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="rounded-lg border border-term-border bg-term-bg/40 py-14">
              <EmptyHeader>
                <EmptyTitle className="text-term-muted text-xs">
                  {t.emptyState}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      )}
    </TerminalWindow>
  );
}
