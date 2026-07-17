import { Calendar, CheckCircle2, Circle, Plus, X } from "lucide-react";
import type { SubmitEventHandler } from "react";
import type { TodoDraft } from "~/modules/todos/client/state/todoSlice";
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
import { Textarea } from "~/shared/client/components/ui/textarea";
import type { Dictionary } from "~/shared/client/i18n";

export function TodoComposer({
  canSave,
  draft,
  isSubmitting,
  onChange,
  onCancel,
  onSubmit,
  t,
}: {
  canSave: boolean;
  draft: TodoDraft;
  isSubmitting: boolean;
  onChange: (patch: Partial<TodoDraft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: Dictionary["todoPage"];
}) {
  const statusLabel =
    draft.status === "Completed" ? t.statusCompleted : t.statusPending;
  const onFormSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={onFormSubmit}>
      <Card
        className="gap-3 border-term-border bg-term-bg/60 py-3 shadow-none"
        size="sm"
      >
        <CardHeader className="px-3">
          <CardTitle className="flex items-center gap-2 font-medium font-mono text-2xs text-term-green uppercase tracking-wide">
            <span aria-hidden="true">&gt;</span>
            {t.createPrompt}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3">
          <FieldGroup className="gap-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <Field>
                <FieldLabel htmlFor="todo-create-name">
                  {t.createNamePlaceholder}
                </FieldLabel>
                <Input
                  id="todo-create-name"
                  autoFocus
                  onChange={(event) => onChange({ name: event.target.value })}
                  placeholder={t.createNamePlaceholder}
                  value={draft.name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="todo-create-due-date">
                  <Calendar className="size-3.5 text-term-amber" />
                  {t.dueAll}
                </FieldLabel>
                <Input
                  id="todo-create-due-date"
                  onChange={(event) =>
                    onChange({ dueDate: event.target.value })
                  }
                  type="date"
                  value={draft.dueDate}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="todo-create-status">
                  {draft.status === "Completed" ? (
                    <CheckCircle2 className="size-3.5 text-term-green" />
                  ) : (
                    <Circle className="size-3.5 text-term-amber" />
                  )}
                  {t.statusAll}
                </FieldLabel>
                <Select
                  onValueChange={(value) => {
                    if (!value) return;
                    onChange({ status: value as TodoDraft["status"] });
                  }}
                  value={draft.status}
                >
                  <SelectTrigger
                    id="todo-create-status"
                    className="w-full rounded"
                  >
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
              <FieldLabel htmlFor="todo-create-description">
                {t.createDescriptionPlaceholder}
              </FieldLabel>
              <Textarea
                id="todo-create-description"
                className="min-h-24"
                onChange={(event) =>
                  onChange({ description: event.target.value })
                }
                placeholder={t.createDescriptionPlaceholder}
                value={draft.description}
              />
            </Field>
          </FieldGroup>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onCancel} type="button" variant="outline">
              <X />
              {t.cancelAction}
            </Button>
            <Button disabled={!canSave || isSubmitting} type="submit">
              <Plus />
              {t.createAction}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
