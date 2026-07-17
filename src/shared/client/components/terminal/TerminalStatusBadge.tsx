import { Badge } from "~/shared/client/components/ui/badge";

export function TerminalStatusBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="mt-4 h-auto gap-2 border-term-green/25 bg-term-green/8 px-3 py-1.5 font-medium font-mono text-[0.75rem] text-term-green"
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-term-green-dot"
      />
      <span>{label}</span>
    </Badge>
  );
}
