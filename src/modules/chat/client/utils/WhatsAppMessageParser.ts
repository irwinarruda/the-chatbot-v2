export type WhatsAppInlineNode =
  | { type: "text"; value: string }
  | {
      type: "bold" | "italic" | "strikethrough";
      children: WhatsAppInlineNode[];
    }
  | { type: "inlineCode" | "monospace"; value: string };

export type WhatsAppBlockNode =
  | { type: "paragraph"; lines: WhatsAppInlineNode[][] }
  | { type: "bulletList"; items: WhatsAppInlineNode[][] }
  | { type: "orderedList"; start: number; items: WhatsAppInlineNode[][] }
  | { type: "quote"; lines: WhatsAppInlineNode[][] };

type WhatsAppWrappedInlineType = Exclude<WhatsAppInlineNode["type"], "text">;

export class WhatsAppMessageParser {
  static parse(text: string): { blocks: WhatsAppBlockNode[] } {
    const normalized = WhatsAppMessageParser.stripAssistantEnvelope(text)
      .replace(/\r\n?/g, "\n")
      .trim();
    if (!normalized) {
      return { blocks: [] };
    }

    const lines = normalized.split("\n");
    const blocks: WhatsAppBlockNode[] = [];

    let index = 0;
    while (index < lines.length) {
      while (index < lines.length && lines[index].trim() === "") {
        index += 1;
      }

      if (index >= lines.length) {
        break;
      }

      const bulletMatch = WhatsAppMessageParser.matchBulletLine(lines[index]);
      if (bulletMatch) {
        const items: WhatsAppInlineNode[][] = [];
        while (index < lines.length) {
          const match = WhatsAppMessageParser.matchBulletLine(lines[index]);
          if (!match) break;
          items.push(WhatsAppMessageParser.parseInline(match));
          index += 1;
        }
        blocks.push({ type: "bulletList", items });
        continue;
      }

      const orderedMatch = WhatsAppMessageParser.matchOrderedLine(lines[index]);
      if (orderedMatch) {
        const items: WhatsAppInlineNode[][] = [];
        const start = Number.parseInt(orderedMatch.order, 10);
        while (index < lines.length) {
          const match = WhatsAppMessageParser.matchOrderedLine(lines[index]);
          if (!match) break;
          items.push(WhatsAppMessageParser.parseInline(match.content));
          index += 1;
        }
        blocks.push({ type: "orderedList", start, items });
        continue;
      }

      const quoteMatch = WhatsAppMessageParser.matchQuoteLine(lines[index]);
      if (quoteMatch !== undefined) {
        const quoteLines: WhatsAppInlineNode[][] = [];
        while (index < lines.length) {
          const match = WhatsAppMessageParser.matchQuoteLine(lines[index]);
          if (match === undefined) break;
          quoteLines.push(WhatsAppMessageParser.parseInline(match));
          index += 1;
        }
        blocks.push({ type: "quote", lines: quoteLines });
        continue;
      }

      const paragraphLines: WhatsAppInlineNode[][] = [];
      while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "") break;
        if (WhatsAppMessageParser.matchBulletLine(line)) break;
        if (WhatsAppMessageParser.matchOrderedLine(line)) break;
        if (WhatsAppMessageParser.matchQuoteLine(line) !== undefined) break;
        paragraphLines.push(WhatsAppMessageParser.parseInline(line));
        index += 1;
      }
      blocks.push({ type: "paragraph", lines: paragraphLines });
    }

    return { blocks };
  }

  private static stripAssistantEnvelope(text: string): string {
    const buttonMatch = text.match(
      /^\s*\[Button\]\[[^\]]*\](?<body>[\s\S]*)$/i,
    );
    if (buttonMatch?.groups?.body !== undefined) {
      return buttonMatch.groups.body.trim();
    }

    const textMatch = text.match(/^\s*\[Text\](?<body>[\s\S]*)$/i);
    if (textMatch?.groups?.body !== undefined) {
      return textMatch.groups.body.trim();
    }

    return text;
  }

  private static matchBulletLine(line: string): string | undefined {
    const match = line.match(/^\s*[-*]\s+(?<content>.+)$/);
    return match?.groups?.content?.trim() ?? undefined;
  }

  private static matchOrderedLine(
    line: string,
  ): { order: string; content: string } | undefined {
    const match = line.match(/^\s*(?<order>\d+)\.\s+(?<content>.+)$/);
    if (!match?.groups?.order || !match.groups.content) {
      return undefined;
    }
    return {
      order: match.groups.order,
      content: match.groups.content.trim(),
    };
  }

  private static matchQuoteLine(line: string): string | undefined {
    const match = line.match(/^\s*>\s?(?<content>.*)$/);
    if (!match) {
      return undefined;
    }
    return match.groups?.content ?? "";
  }

  private static parseInline(text: string): WhatsAppInlineNode[] {
    return WhatsAppMessageParser.compactTextNodes(
      WhatsAppMessageParser.parseInlineSegment(text),
    );
  }

  private static parseInlineSegment(text: string): WhatsAppInlineNode[] {
    const nodes: WhatsAppInlineNode[] = [];
    let cursor = 0;
    let buffer = "";

    while (cursor < text.length) {
      const token = WhatsAppMessageParser.readInlineToken(text, cursor);
      if (!token) {
        buffer += text[cursor];
        cursor += 1;
        continue;
      }

      if (buffer) {
        nodes.push({ type: "text", value: buffer });
        buffer = "";
      }

      if (token.type === "inlineCode" || token.type === "monospace") {
        nodes.push({ type: token.type, value: token.content });
      } else {
        nodes.push({
          type: token.type,
          children: WhatsAppMessageParser.parseInlineSegment(token.content),
        });
      }
      cursor = token.nextIndex;
    }

    if (buffer) {
      nodes.push({ type: "text", value: buffer });
    }

    return nodes;
  }

  private static readInlineToken(
    text: string,
    start: number,
  ):
    | {
        type: WhatsAppWrappedInlineType;
        content: string;
        nextIndex: number;
      }
    | undefined {
    const markerParsers = [
      { marker: "```", type: "monospace" as const },
      { marker: "`", type: "inlineCode" as const },
      { marker: "*", type: "bold" as const },
      { marker: "_", type: "italic" as const },
      { marker: "~", type: "strikethrough" as const },
    ];

    for (const parser of markerParsers) {
      if (!text.startsWith(parser.marker, start)) {
        continue;
      }

      const end = text.indexOf(parser.marker, start + parser.marker.length);
      if (end === -1) {
        return undefined;
      }

      const content = text.slice(start + parser.marker.length, end);
      if (!WhatsAppMessageParser.isValidWrappedContent(content)) {
        return undefined;
      }

      return {
        type: parser.type,
        content,
        nextIndex: end + parser.marker.length,
      };
    }

    return undefined;
  }

  private static isValidWrappedContent(content: string): boolean {
    return content.trim().length > 0 && !/^\s|\s$/.test(content);
  }

  private static compactTextNodes(
    nodes: WhatsAppInlineNode[],
  ): WhatsAppInlineNode[] {
    const compacted: WhatsAppInlineNode[] = [];

    for (const node of nodes) {
      const previous = compacted[compacted.length - 1];
      if (node.type === "text" && previous?.type === "text") {
        previous.value += node.value;
        continue;
      }
      compacted.push(node);
    }

    return compacted;
  }
}
