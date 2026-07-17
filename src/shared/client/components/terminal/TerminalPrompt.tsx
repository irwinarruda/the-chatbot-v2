export function TerminalPrompt({ text }: { text: string }) {
  return (
    <span className="font-mono">
      <span className="font-semibold text-term-green">$</span> {text}
      <span aria-hidden="true" className="terminal-cursor" />
    </span>
  );
}
