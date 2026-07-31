export interface ParsedChatCommand {
  raw: string;
  name: string;
  arguments: Record<string, string>;
}

export function parseChatCommand(text: string): ParsedChatCommand | undefined {
  const match = /^\/effort(?:\s+(\S+))?\s*$/i.exec(text.trim());
  if (!match) return undefined;
  const level = match[1]?.toLowerCase();
  const commandArguments: Record<string, string> = {};
  if (level) commandArguments.level = level;
  return {
    raw: text.trim(),
    name: "effort",
    arguments: commandArguments,
  };
}
