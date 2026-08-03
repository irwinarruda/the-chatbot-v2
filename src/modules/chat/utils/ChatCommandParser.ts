interface ParsedEffortChatCommand {
  raw: string;
  name: "effort";
  arguments: Record<string, string>;
}

interface ParsedModelChatCommand {
  raw: string;
  name: "model";
  arguments: Record<string, string>;
}

interface ParsedCompactChatCommand {
  raw: string;
  name: "compact";
  arguments: Record<string, string>;
}

export type ParsedChatCommand =
  | ParsedEffortChatCommand
  | ParsedModelChatCommand
  | ParsedCompactChatCommand;

export function parseChatCommand(text: string): ParsedChatCommand | undefined {
  const raw = text.trim();
  const effortMatch = /^\/effort(?:\s+(\S+))?\s*$/i.exec(raw);
  if (effortMatch) {
    const level = effortMatch[1]?.toLowerCase();
    const commandArguments: Record<string, string> = {};
    if (level) commandArguments.level = level;
    return { raw, name: "effort", arguments: commandArguments };
  }
  if (/^\/compact\s*$/i.test(raw)) {
    return { raw, name: "compact", arguments: {} };
  }
  const modelMatch = /^\/model(?:\s+([\s\S]*))?$/i.exec(raw);
  if (!modelMatch) return undefined;
  const locator = modelMatch[1]?.trim();
  const commandArguments: Record<string, string> = {};
  if (!locator) {
    return { raw, name: "model", arguments: commandArguments };
  }
  commandArguments.locator = locator;
  const locatorMatch = /^([^/\s]+)\/(\S+)$/.exec(locator);
  if (locatorMatch) {
    const provider = locatorMatch[1]?.toLowerCase();
    const model = locatorMatch[2];
    if (provider && model) {
      commandArguments.provider = provider;
      commandArguments.model = model;
      commandArguments.locator = `${provider}/${model}`;
    }
  }
  return { raw, name: "model", arguments: commandArguments };
}
