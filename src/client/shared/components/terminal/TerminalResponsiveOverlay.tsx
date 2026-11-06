import { XIcon } from "lucide-react";
import { type ReactNode, useRef, useSyncExternalStore } from "react";
import { Button } from "~/client/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/client/shared/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "~/client/shared/components/ui/drawer";
import { cn } from "~/client/shared/components/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";

const DESKTOP_OVERLAY_QUERY = "(min-width: 48rem)";

function subscribeToDesktopOverlay(onChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_OVERLAY_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getDesktopOverlaySnapshot() {
  return window.matchMedia(DESKTOP_OVERLAY_QUERY).matches;
}

function getDesktopOverlayServerSnapshot() {
  return false;
}

export function TerminalResponsiveOverlay({
  bodyClassName,
  children,
  closeLabel,
  contentClassName,
  description,
  descriptionClassName,
  footer,
  headerClassName,
  onOpenChange,
  open,
  title,
  titleClassName,
}: {
  bodyClassName?: string;
  children: ReactNode;
  closeLabel: string;
  contentClassName?: string;
  description: ReactNode;
  descriptionClassName?: string;
  footer?: ReactNode;
  headerClassName?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
  titleClassName?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopOverlay,
    getDesktopOverlaySnapshot,
    getDesktopOverlayServerSnapshot,
  );

  if (isDesktop) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent
          className={cn(
            "flex max-w-2xl flex-col gap-0 overflow-hidden border-border bg-card p-0",
            contentClassName,
          )}
          initialFocus={() =>
            bodyRef.current?.querySelector<HTMLElement>(
              "input:not([type=hidden]), textarea, [role=combobox]",
            ) ?? true
          }
          showCloseButton={false}
        >
          <DialogHeader className="shrink-0 border-border border-b px-4 py-3">
            <div
              className={cn(
                "flex items-start justify-between gap-3",
                headerClassName,
              )}
            >
              <div className="min-w-0 space-y-1">
                <DialogTitle
                  className={cn(
                    "font-semibold text-foreground text-sm",
                    titleClassName,
                  )}
                >
                  {title}
                </DialogTitle>
                <DialogDescription
                  className={cn(
                    "text-muted-foreground text-xs",
                    descriptionClassName,
                  )}
                >
                  {description}
                </DialogDescription>
              </div>
              <DialogClose
                aria-label={closeLabel}
                render={<Button size="icon-sm" variant="ghost" />}
              >
                <XIcon />
              </DialogClose>
            </div>
          </DialogHeader>
          <div
            ref={bodyRef}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4",
              footer && "pb-5",
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer && (
            <DialogFooter className="m-0 shrink-0 rounded-none border-border bg-transparent">
              {footer}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      onOpenChange={onOpenChange}
      open={open}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerContent
        className={cn(
          "max-h-[calc(100dvh-env(safe-area-inset-top))] border-border bg-card motion-reduce:duration-0",
          contentClassName,
        )}
      >
        <DrawerHeader className="gap-1 border-border border-b pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] text-left">
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              headerClassName,
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <DrawerTitle
                className={cn(
                  "text-left font-semibold text-foreground text-sm",
                  titleClassName,
                )}
              >
                {title}
              </DrawerTitle>
              <DrawerDescription
                className={cn(
                  "text-left text-muted-foreground text-xs leading-relaxed",
                  descriptionClassName,
                )}
              >
                {description}
              </DrawerDescription>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DrawerClose
                    aria-label={closeLabel}
                    render={<Button size="icon-sm" variant="ghost" />}
                  />
                }
              >
                <XIcon />
              </TooltipTrigger>
              <TooltipContent>{closeLabel}</TooltipContent>
            </Tooltip>
          </div>
        </DrawerHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]",
            footer ? "pb-5" : "pb-[max(1rem,env(safe-area-inset-bottom))]",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer && (
          <DrawerFooter className="shrink-0 border-border border-t pt-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
