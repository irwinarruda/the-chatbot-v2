import { AlertTriangle } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
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
} from "~/client/shared/components/ui/alert-dialog";

export function ConfirmDialog({
  cancelLabel,
  children,
  confirmLabel,
  description,
  isDestructive = true,
  isDisabled = false,
  onConfirm,
  title,
  trigger,
}: {
  cancelLabel: string;
  children?: ReactNode;
  confirmLabel: string;
  description: ReactNode;
  isDestructive?: boolean;
  isDisabled?: boolean;
  onConfirm: () => void;
  title: ReactNode;
  trigger: ReactElement;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia
            className={
              isDestructive
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/10 text-warning"
            }
          >
            <AlertTriangle />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDisabled}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isDisabled}
            onClick={onConfirm}
            variant={isDestructive ? "destructive" : "default"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
