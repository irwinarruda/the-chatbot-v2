import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "~/shared/client/components/ui/button";
import { Textarea } from "~/shared/client/components/ui/textarea";
import type { Dictionary } from "~/shared/client/i18n";

export function NoteAiComposer({
  disabled,
  isRefining,
  onRefine,
  t,
}: {
  disabled: boolean;
  isRefining: boolean;
  onRefine: (instruction: string) => Promise<boolean>;
  t: Dictionary["notesPage"];
}) {
  const [instruction, setInstruction] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const refined = await onRefine(instruction);
    if (refined) setInstruction("");
  }

  return (
    <form
      className="border border-term-cyan/20 bg-term-cyan/5 p-3"
      onSubmit={onSubmit}
    >
      <label
        className="mb-2 flex items-center gap-2 font-mono text-2xs text-term-cyan uppercase tracking-wide"
        htmlFor="note-ai-instruction"
      >
        <Sparkles className="size-3.5" />
        {t.aiLabel}
      </label>
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <Textarea
          id="note-ai-instruction"
          className="min-h-20 flex-1 bg-term-bg text-base md:min-h-16 md:text-sm"
          disabled={disabled || isRefining}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t.aiPlaceholder}
          value={instruction}
        />
        <Button
          className="min-h-11 shrink-0 md:min-h-8"
          disabled={disabled || isRefining || !instruction.trim()}
          type="submit"
          variant="outline"
        >
          <Sparkles />
          {isRefining ? t.aiWorking : t.aiAction}
        </Button>
      </div>
      <p className="mt-2 mb-0 text-term-muted text-xs">{t.aiHint}</p>
    </form>
  );
}
