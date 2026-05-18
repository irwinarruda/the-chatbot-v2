import { Calendar, CheckCircle2, Circle, Trash2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AudioWaveform } from "~/client/components/AudioWaveform";
import type { Todo } from "~/client/entities/Todo";
import type { Dictionary } from "~/client/i18n";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Textarea } from "./ui/textarea";

export function TodoDetailDialog({
  isSubmitting,
  onClose,
  onDelete,
  onSave,
  open,
  t,
  todo,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (patch: {
    name: string;
    description: string;
    dueDate?: string;
    status: Todo["status"];
  }) => void;
  open: boolean;
  t: Dictionary["todoPage"];
  todo?: Todo;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Todo["status"]>("Pending");
  const source = todo?.sourceMessage;
  const modalTitle = todo?.name ?? t.detailTitle;

  useEffect(() => {
    if (!todo) return;
    setName(todo.name);
    setDescription(todo.description);
    setDueDate(todo.dueDate ? todo.dueDate.slice(0, 10) : "");
    setStatus(todo.status);
  }, [todo]);

  return (
    <Dialog onClose={onClose} open={open} title={modalTitle}>
      <div className="space-y-4 p-4">
        {!todo ? (
          <p className="m-0 text-sm text-term-muted">{t.loading}</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <NativeSelect
                className="w-full md:w-40"
                onChange={(event) =>
                  setStatus(event.target.value as Todo["status"])
                }
                value={status}
              >
                <NativeSelectOption value="Pending">
                  {t.statusPending}
                </NativeSelectOption>
                <NativeSelectOption value="Completed">
                  {t.statusCompleted}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <Textarea
              className="min-h-28"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t.createDescriptionPlaceholder}
              value={description}
            />
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="flex items-center gap-2 text-sm text-term-muted">
                <Calendar className="size-4 text-term-amber" />
                <Input
                  aria-label={t.dueAll}
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  value={dueDate}
                />
              </div>
              <span className="inline-flex items-center gap-1 text-sm text-term-muted">
                {status === "Completed" ? <CheckCircle2 /> : <Circle />}
                {status === "Completed" ? t.statusCompleted : t.statusPending}
              </span>
            </div>
            {source ? (
              <section className="border border-term-border bg-term-bg/55 p-3">
                <div className="mb-2 flex items-center gap-2 text-2xs text-term-cyan uppercase">
                  <Volume2 className="size-3.5" />
                  {t.audioLabel}
                </div>
                {source.mediaUrl ? (
                  <AudioWaveform src={source.mediaUrl} />
                ) : null}
                {source.transcript ? (
                  <div className="mt-3">
                    <div className="mb-1 text-2xs text-term-muted uppercase">
                      {t.transcriptLabel}
                    </div>
                    <p className="m-0 whitespace-pre-wrap text-sm text-term-text">
                      {source.transcript}
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}
            <div className="flex flex-wrap justify-between gap-2 border-term-border border-t pt-4">
              <Button
                disabled={isSubmitting}
                onClick={onDelete}
                type="button"
                variant="destructive"
              >
                <Trash2 />
                {t.deleteAction}
              </Button>
              <div className="flex gap-2">
                <Button onClick={onClose} type="button" variant="outline">
                  {t.cancelAction}
                </Button>
                <Button
                  disabled={isSubmitting || !name.trim()}
                  onClick={() =>
                    onSave({
                      name,
                      description,
                      dueDate: dueDate || undefined,
                      status,
                    })
                  }
                  type="button"
                >
                  {t.saveAction}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
