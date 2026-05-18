import { Plus } from "lucide-react";
import type { SubmitEventHandler } from "react";
import type { TodoDraft } from "~/client/stores/slices/todoSlice";
import type { Dictionary } from "../i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Textarea } from "./ui/textarea";

export function TodoComposer({
  canSave,
  draft,
  isSubmitting,
  onChange,
  onSubmit,
  t,
}: {
  canSave: boolean;
  draft: TodoDraft;
  isSubmitting: boolean;
  onChange: (patch: Partial<TodoDraft>) => void;
  onSubmit: () => void;
  t: Dictionary["todoPage"];
}) {
  const onFormSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form
      className="border border-term-border bg-term-bg/60 p-3"
      onSubmit={onFormSubmit}
    >
      <div className="mb-2 flex items-center gap-2 text-2xs text-term-green uppercase">
        <span>&gt;</span>
        <span>{t.createPrompt}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <Input
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={t.createNamePlaceholder}
          value={draft.name}
        />
        <Input
          className="md:w-40"
          onChange={(event) => onChange({ dueDate: event.target.value })}
          type="date"
          value={draft.dueDate}
        />
        <NativeSelect
          className="w-full md:w-36"
          onChange={(event) =>
            onChange({ status: event.target.value as TodoDraft["status"] })
          }
          value={draft.status}
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
        className="mt-2 min-h-20"
        onChange={(event) => onChange({ description: event.target.value })}
        placeholder={t.createDescriptionPlaceholder}
        value={draft.description}
      />
      <div className="mt-3 flex justify-end">
        <Button disabled={!canSave || isSubmitting} type="submit">
          <Plus />
          {t.createAction}
        </Button>
      </div>
    </form>
  );
}
