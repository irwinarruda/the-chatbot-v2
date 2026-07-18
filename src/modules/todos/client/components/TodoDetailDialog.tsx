import { Calendar, CheckCircle2, Circle, Trash2, Volume2 } from "lucide-react";
import { type SubmitEventHandler, useEffect, useState } from "react";
import {
  toTodoDueDateInputValue,
  toTodoDueDateRequestValue,
} from "~/modules/todos/client/services/todoService";
import type { TodoDTO } from "~/modules/todos/entities/dtos/TodoDTO";
import { AudioWaveform } from "~/shared/client/components/AudioWaveform";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/shared/client/components/ui/alert-dialog";
import { Button } from "~/shared/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/shared/client/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "~/shared/client/components/ui/field";
import { Input } from "~/shared/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shared/client/components/ui/select";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import { Textarea } from "~/shared/client/components/ui/textarea";
import type { Dictionary } from "~/shared/client/i18n";

export function TodoDetailDialog({
  isSubmitting,
  mode = "edit",
  onClose,
  onDelete,
  onSave,
  open,
  t,
  theme,
  todo,
}: {
  isSubmitting: boolean;
  mode?: "create" | "edit";
  onClose: () => void;
  onDelete?: () => void;
  onSave: (patch: {
    name: string;
    description: string;
    dueDate: string | null;
    status: TodoDTO["status"];
  }) => void;
  open: boolean;
  t: Dictionary["todoPage"];
  theme: "dark" | "light";
  todo?: TodoDTO;
}) {
  const isCreate = mode === "create";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TodoDTO["status"]>("Pending");
  const source = todo?.sourceMessage;
  const modalTitle = isCreate ? t.createPrompt : (todo?.name ?? t.detailTitle);
  const submitLabel = isCreate ? t.createAction : t.saveAction;
  const statusLabel =
    status === "Completed" ? t.statusCompleted : t.statusPending;
  const showForm = isCreate || Boolean(todo);

  function onOpenChange(nextOpen: boolean) {
    if (!nextOpen) onClose();
  }

  const onFormSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    onSave({
      name,
      description,
      dueDate: toTodoDueDateRequestValue(dueDate),
      status,
    });
  };

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setName("");
      setDescription("");
      setDueDate("");
      setStatus("Pending");
      return;
    }
    if (!todo) return;
    setName(todo.name);
    setDescription(todo.description);
    setDueDate(toTodoDueDateInputValue(todo.dueDate));
    setStatus(todo.status);
  }, [isCreate, open, todo]);

  return (
    <TerminalResponsiveOverlay
      bodyClassName="space-y-4"
      closeLabel={t.cancelAction}
      description={t.subtitle}
      footer={
        showForm ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!isCreate && onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      disabled={isSubmitting}
                      type="button"
                      variant="destructive"
                    />
                  }
                >
                  <Trash2 />
                  {t.deleteAction}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-term-red/10 text-term-red">
                      <Trash2 />
                    </AlertDialogMedia>
                    <AlertDialogTitle>
                      {t.deleteAction}: {modalTitle}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t.deleteConfirmation}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.cancelAction}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isSubmitting}
                      onClick={onDelete}
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 />
                      {t.deleteAction}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={onClose} type="button" variant="outline">
                {t.cancelAction}
              </Button>
              <Button
                disabled={isSubmitting || !name.trim()}
                form="todo-detail-form"
                type="submit"
              >
                {submitLabel}
              </Button>
            </div>
          </div>
        ) : undefined
      }
      onOpenChange={onOpenChange}
      open={open}
      title={modalTitle}
    >
      {!showForm ? (
        <div aria-live="polite" className="space-y-3" role="status">
          <span className="sr-only">{t.loading}</span>
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : (
        <form
          id="todo-detail-form"
          className="space-y-4"
          onSubmit={onFormSubmit}
        >
          <FieldGroup className="gap-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
              <Field>
                <FieldLabel htmlFor="todo-detail-name">
                  {t.createNamePlaceholder}
                </FieldLabel>
                <Input
                  id="todo-detail-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="todo-detail-status">
                  {status === "Completed" ? (
                    <CheckCircle2 className="size-3.5 text-term-green" />
                  ) : (
                    <Circle className="size-3.5 text-term-amber" />
                  )}
                  {t.statusLabel}
                </FieldLabel>
                <Select
                  onValueChange={(value) => {
                    if (!value) return;
                    setStatus(value as TodoDTO["status"]);
                  }}
                  value={status}
                >
                  <SelectTrigger id="todo-detail-status" className="w-full">
                    <SelectValue>{statusLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="Pending">
                      <Circle className="text-term-amber" />
                      {t.statusPending}
                    </SelectItem>
                    <SelectItem value="Completed">
                      <CheckCircle2 className="text-term-green" />
                      {t.statusCompleted}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="todo-detail-description">
                {t.createDescriptionPlaceholder}
              </FieldLabel>
              <Textarea
                id="todo-detail-description"
                className="min-h-32"
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t.createDescriptionPlaceholder}
                value={description}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="todo-detail-due-date">
                <Calendar className="size-3.5 text-term-amber" />
                {t.dueDateLabel}
              </FieldLabel>
              <Input
                id="todo-detail-due-date"
                className="md:max-w-56"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </Field>
          </FieldGroup>
          {!isCreate && source && (
            <Card
              className="gap-3 border-term-border bg-term-bg/55 py-3 shadow-none"
              size="sm"
            >
              <CardHeader className="px-3">
                <CardTitle className="flex items-center gap-2 font-medium text-2xs text-term-cyan uppercase tracking-wide">
                  <Volume2 className="size-3.5" />
                  {t.audioLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3">
                {source.mediaUrl ? (
                  <AudioWaveform src={source.mediaUrl} theme={theme} />
                ) : null}
                {source.transcript ? (
                  <div>
                    <div className="mb-1 text-2xs text-term-muted uppercase tracking-wide">
                      {t.transcriptLabel}
                    </div>
                    <p className="m-0 whitespace-pre-wrap text-sm text-term-text leading-relaxed">
                      {source.transcript}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </form>
      )}
    </TerminalResponsiveOverlay>
  );
}
