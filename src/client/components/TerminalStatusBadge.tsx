import { Badge } from "~/client/components/ui/badge";

export function TerminalStatusBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="secondary"
      className="mt-4 h-auto gap-2 rounded-md border border-term-green/25 bg-term-green/10 px-3.5 py-1.5 font-medium text-[0.8125rem] text-term-green hover:bg-term-green/10"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-term-green" />
      <span>{label}</span>
    </Badge>
  );
}
