import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "~/shared/client/components/ui/button";
import { cn } from "~/shared/client/components/ui/lib";

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
    <div className="fixed inset-0 z-50 flex items-end pointer-fine:items-center justify-center bg-black/65 pointer-fine:p-3 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className={cn(
          "relative max-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-2xl overflow-auto",
          "pointer-fine:max-h-[calc(100dvh-2rem)] pointer-fine:rounded-lg rounded-t-xl border border-term-border pointer-fine:border-b border-b-0 bg-term-window pb-[env(safe-area-inset-bottom)] pointer-fine:pb-0 shadow-2xl",
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
