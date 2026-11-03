import { Badge } from "~/client/shared/components/ui/badge";

export function TerminalStatusBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="mt-4 h-auto gap-2 border-success/25 bg-success/10 px-3 py-1.5 font-medium font-mono text-[0.75rem] text-success"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
      <span>{label}</span>
    </Badge>
  );
}
