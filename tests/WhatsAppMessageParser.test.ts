import { describe, expect, test } from "vitest";
import { WhatsAppMessageParser } from "~/client/utils/WhatsAppMessageParser";

describe("whatsAppMessageParser", () => {
  test("strips message envelopes and parses inline WhatsApp styles", () => {
    const parsed = WhatsAppMessageParser.parse(
      "[Text]*Oi* _mundo_ ~riscado~ `code` ```mono```",
    );

    expect(parsed.blocks).toEqual([
      {
        type: "paragraph",
        lines: [
          [
            {
              type: "bold",
              children: [{ type: "text", value: "Oi" }],
            },
            { type: "text", value: " " },
            {
              type: "italic",
              children: [{ type: "text", value: "mundo" }],
            },
            { type: "text", value: " " },
            {
              type: "strikethrough",
              children: [{ type: "text", value: "riscado" }],
            },
            { type: "text", value: " " },
            { type: "inlineCode", value: "code" },
            { type: "text", value: " " },
            { type: "monospace", value: "mono" },
          ],
        ],
      },
    ]);
  });

  test("groups WhatsApp block formats into structured blocks", () => {
    const parsed = WhatsAppMessageParser.parse(
      [
        "Introducao",
        "- item um",
        "* item dois",
        "1. primeiro",
        "2. segundo",
        "> linha um",
        "> linha dois",
      ].join("\n"),
    );

    expect(parsed.blocks).toEqual([
      {
        type: "paragraph",
        lines: [[{ type: "text", value: "Introducao" }]],
      },
      {
        type: "bulletList",
        items: [
          [{ type: "text", value: "item um" }],
          [{ type: "text", value: "item dois" }],
        ],
      },
      {
        type: "orderedList",
        start: 1,
        items: [
          [{ type: "text", value: "primeiro" }],
          [{ type: "text", value: "segundo" }],
        ],
      },
      {
        type: "quote",
        lines: [
          [{ type: "text", value: "linha um" }],
          [{ type: "text", value: "linha dois" }],
        ],
      },
    ]);
  });

  test("removes button envelopes from legacy plain text payloads", () => {
    const parsed = WhatsAppMessageParser.parse(
      "[Button][Sim;Nao]Escolha uma opcao",
    );

    expect(parsed.blocks).toEqual([
      {
        type: "paragraph",
        lines: [[{ type: "text", value: "Escolha uma opcao" }]],
      },
    ]);
  });
});
