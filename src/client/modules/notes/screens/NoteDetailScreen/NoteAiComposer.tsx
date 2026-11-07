import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import { Textarea } from "~/client/shared/components/ui/textarea";
import type { Dictionary } from "~/client/shared/i18n/dictionary";

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
    <Card
      className="gap-0 rounded-xl border-border bg-card py-0 shadow-none"
      size="sm"
    >
      <CardContent className="p-3">
        <form onSubmit={onSubmit}>
          <label
            className="mb-2 flex items-center gap-2 font-medium text-foreground text-sm"
            htmlFor="note-ai-instruction"
          >
            <Sparkles className="size-4 text-brand-text" />
            {t.aiLabel}
          </label>
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <Textarea
              id="note-ai-instruction"
              className="min-h-20 flex-1 bg-background text-base md:min-h-16 md:text-sm"
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
          <p className="mt-2 mb-0 text-muted-foreground text-xs">{t.aiHint}</p>
        </form>
      </CardContent>
    </Card>
  );
}
