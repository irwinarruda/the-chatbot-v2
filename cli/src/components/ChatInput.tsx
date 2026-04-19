import type { TextareaRenderable } from "@opentui/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { theme } from "../theme.ts";

export function ChatInput({
  onSend,
  disabled,
  focused,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  focused?: boolean;
}) {
  const [textarea, setTextarea] = useState<TextareaRenderable | undefined>(
    undefined,
  );

  const handleSubmit = useCallback(() => {
    if (!textarea || disabled) return;
    const text = textarea.plainText.trim();
    if (!text) return;
    onSend(text);
    textarea.clear();
  }, [disabled, onSend, textarea]);

  useEffect(() => {
    if (!textarea) return;
    textarea.onSubmit = handleSubmit;
  }, [handleSubmit, textarea]);

  const keyBindings = useMemo(
    () => [
      { name: "return", action: "submit" as const },
      { name: "return", shift: true, action: "newline" as const },
    ],
    [],
  );

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      minHeight={3}
      maxHeight={10}
      flexShrink={0}
      flexDirection="row"
      alignItems="flex-start"
      gap={1}
    >
      <text fg={theme.green[500]}>{"> "}</text>
      <textarea
        ref={(node) => setTextarea(node ?? undefined)}
        flexGrow={1}
        placeholder={
          disabled ? "Waiting for connection..." : "Type a message..."
        }
        keyBindings={keyBindings}
        backgroundColor={theme.neutral[850]}
        focusedBackgroundColor={theme.neutral[800]}
        textColor={theme.neutral[100]}
        cursorColor={theme.green[400]}
        focused={focused}
      />
    </box>
  );
}
