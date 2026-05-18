import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "~/client/components/ui/button";
import { cn } from "~/client/components/ui/lib";

export function Dialog({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm">
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className={cn(
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-auto",
          "rounded-lg border border-term-border bg-term-window shadow-2xl",
          "shadow-black/40",
        )}
        role="dialog"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-term-border border-b bg-term-chrome px-4 py-3">
          <h2 className="m-0 truncate pr-3 font-semibold text-sm text-term-bright">
            {title}
          </h2>
          <Button
            aria-label="Close"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
