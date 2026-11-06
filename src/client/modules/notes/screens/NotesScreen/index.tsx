import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { FileText, Plus, Search, SearchX, X } from "lucide-react";
import { useEffect } from "react";
import type { NotesSearchDTO } from "~/client/modules/notes/app/dtos/NotesSearchDTO";
import type { NoteErrorCode } from "~/client/modules/notes/app/services/NoteService";
import { getAvailableNoteName } from "~/client/modules/notes/parsers/NoteName";
import { ListEmptyState } from "~/client/shared/components/ListEmptyState";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { Input } from "~/client/shared/components/ui/input";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";

const loadingRows = ["first", "second", "third", "fourth"];

function getNoteExcerpt(markdown: string, name: string, emptyLabel: string) {
  const excerpt = markdown
    .split("\n")
    .filter((line) => line.replace(/^#+\s*/, "").trim() !== name.trim())
    .join(" · ")
    .replace(/\[[ xX]\]/g, " ")
    .replace(/[`#>*_[\]()~-]/g, " ")
    .replace(/(\s*·\s*)+/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
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

  async function onCreateNote() {
    const note = await createNote(
      getAvailableNoteName(
        t.untitledNote,
        notes.map((item) => item.name),
      ),
    );
    if (!note) return;
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
    <AppShell
      title={t.windowTitle}
      activePath="/notes"
      dictionary={dictionary}
      showLogout
    >
      {!hasSelectedNote && (
        <TerminalPageHeader
          actions={
            <Button
              disabled={isNoteSubmitting}
              onClick={onCreateNote}
              type="button"
            >
              <Plus />
              {t.createAction}
            </Button>
          }
          heading={t.heading}
          subtitle={t.subtitle}
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
          <div className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={t.searchPlaceholder}
                className="min-h-11 pl-8 text-base md:min-h-9 md:text-sm"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t.searchPlaceholder}
                type="search"
                value={search.q ?? ""}
              />
            </div>
          </div>
          {isNoteBootstrapping ? (
            <div aria-busy="true" aria-live="polite" className="space-y-2">
              <span className="sr-only">{t.loading}</span>
              {loadingRows.map((row) => (
                <Skeleton key={row} className="h-16 rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : notes.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-xl border border-border bg-card p-0">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    className="group flex items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    params={{ noteId: note.id }}
                    search={search}
                    to="/notes/$noteId"
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium text-foreground text-sm">
                          {note.name}
                        </span>
                        <time
                          className="shrink-0 text-muted-foreground text-xs"
                          dateTime={note.updatedAt}
                        >
                          {new Date(note.updatedAt).toLocaleDateString(
                            prefs.locale,
                            { month: "short", day: "numeric" },
                          )}
                        </time>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-muted-foreground text-sm leading-relaxed">
                        {getNoteExcerpt(note.markdown, note.name, t.emptyNote)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ListEmptyState
              icon={search.q ? SearchX : FileText}
              title={search.q ? t.emptyState : t.selectState}
              actions={
                search.q && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSearchChange("")}
                  >
                    <X />
                    {t.clearSearch}
                  </Button>
                )
              }
            />
          )}
        </section>
      )}
    </AppShell>
  );
}
