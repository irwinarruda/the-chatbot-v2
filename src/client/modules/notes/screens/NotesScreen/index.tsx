import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ChevronRight, FileText, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NotesSearchDTO } from "~/client/modules/notes/app/dtos/NotesSearchDTO";
import type { NoteErrorCode } from "~/client/modules/notes/app/services/NoteService";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "~/client/shared/components/ui/empty";
import { Input } from "~/client/shared/components/ui/input";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";

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
  const resetFeature = useApp((state) => state.resetNotes);
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
  const errorMessage = clientErrorMessage(noteError, errorMessages);

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

  useEffect(() => resetFeature, [resetFeature]);

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
          <Alert className="mb-4" variant="destructive">
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
            className="mb-4 gap-0 border-border bg-muted/45 py-0 shadow-none"
            size="sm"
          >
            <CardContent className="grid gap-3 p-3 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
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
          <div className="mb-2 flex items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-wide">
            <FileText className="size-3.5 text-primary" />
            {t.listLabel}
          </div>
          {isNoteBootstrapping ? (
            <div aria-busy="true" aria-live="polite" className="space-y-2">
              <span className="sr-only">{t.loading}</span>
              {loadingRows.map((row) => (
                <Skeleton
                  key={row}
                  className="h-16 rounded-lg border border-border bg-muted/50"
                />
              ))}
            </div>
          ) : notes.length > 0 ? (
            <ul className="m-0 list-none space-y-2 p-0">
              {notes.map((note) => (
                <li key={note.id}>
                  <Card
                    className="gap-0 border-border border-l-2 bg-background/35 py-0 shadow-none transition-colors hover:border-l-brand hover:bg-muted/70"
                    size="sm"
                  >
                    <Link
                      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg px-2.5 py-2"
                      params={{ noteId: note.id }}
                      search={search}
                      to="/notes/$noteId"
                    >
                      <FileText className="mt-0.5 size-4 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground text-sm transition-colors group-hover:text-primary">
                          {note.name}
                        </span>
                        <span className="mt-1 line-clamp-2 block font-sans text-muted-foreground text-sm leading-relaxed">
                          {getNoteExcerpt(note.markdown, t.emptyNote)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <time
                          className="hidden text-2xs sm:block"
                          dateTime={note.updatedAt}
                        >
                          {new Date(note.updatedAt).toLocaleDateString(
                            prefs.locale,
                          )}
                        </time>
                        <ChevronRight className="mt-0.5 size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
                      </span>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="rounded-lg border border-border bg-background/40 py-14">
              <EmptyHeader>
                <EmptyTitle className="text-muted-foreground text-xs">
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
