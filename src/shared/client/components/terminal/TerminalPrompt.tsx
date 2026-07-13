export function TerminalPrompt({ text }: { text: string }) {
  return (
    <>
      <span className="font-semibold text-term-green">$</span> {text}
      <span className="terminal-cursor" />
    </>
  );
}
