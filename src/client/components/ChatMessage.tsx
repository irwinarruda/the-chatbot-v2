import { memo, useMemo, useState } from "react";
import {
  type WhatsAppBlockNode,
  type WhatsAppInlineNode,
  WhatsAppMessageParser,
} from "~/client/utils/WhatsAppMessageParser";
import type { SharedChatMessage } from "~/shared/types/web-chat";
import { AudioWaveform } from "./AudioWaveform";
import { Button } from "./ui/button";

interface ChatMessageProps {
  message: SharedChatMessage;
  theme: "dark" | "light";
  locale: string;
  isSending: boolean;
  youLabel: string;
  botLabel: string;
  showMoreLabel: string;
  showLessLabel: string;
  onButtonReply: (text: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  theme,
  locale,
  isSending,
  youLabel,
  botLabel,
  showMoreLabel,
  showLessLabel,
  onButtonReply,
}: ChatMessageProps) {
  const isUser = message.userType === "user";
  const isAudio = message.type === "audio" && Boolean(message.mediaUrl);

  return (
    <div
      className={`flex w-fit flex-col ${
        isAudio ? "max-w-[85%] sm:max-w-80" : "max-w-[85%] sm:max-w-[80%]"
      } ${isUser ? "ml-auto" : "mr-auto"}`}
    >
      <div
        className={`mb-0.5 px-0.5 font-semibold text-2xs uppercase tracking-wider ${
          isUser ? "text-right text-term-cyan" : "text-left text-term-green"
        }`}
      >
        {isUser ? youLabel : botLabel}
      </div>
      <div
        className={`rounded-lg border px-3.5 py-2.5 ${
          isUser
            ? "border-term-green/20 bg-term-green/8"
            : "border-term-border bg-term-bg"
        }`}
      >
        {isAudio && message.mediaUrl ? (
          <div className="flex flex-col gap-2">
            <AudioWaveform src={message.mediaUrl} theme={theme} />
            {message.transcript ? (
              <AudioTranscript
                text={message.transcript}
                showMoreLabel={showMoreLabel}
                showLessLabel={showLessLabel}
              />
            ) : null}
          </div>
        ) : message.type === "interactive" &&
          message.userType === "bot" &&
          message.buttonReplyOptions ? (
          <div className="flex flex-col gap-2.5">
            <FormattedChatText text={message.text ?? ""} />
            <div className="flex flex-wrap gap-1.5">
              {message.buttonReplyOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  onClick={() => {
                    void onButtonReply(option);
                  }}
                  disabled={isSending}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-term-blue/30 bg-term-blue/8 text-[0.8125rem] text-term-blue hover:border-term-cyan/40 hover:bg-term-cyan/10 hover:text-term-cyan"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <FormattedChatText text={message.buttonReply ?? message.text ?? ""} />
        )}
      </div>
      <div
        className={`mt-0.5 px-0.5 text-2xs text-term-muted ${
          isUser ? "text-right" : "text-left"
        }`}
      >
        {new Date(message.createdAt).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
});

function AudioTranscript({
  text,
  showMoreLabel,
  showLessLabel,
}: {
  text: string;
  showMoreLabel: string;
  showLessLabel: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = text.length > 420;

  return (
    <div className="w-full text-[0.8125rem] text-term-muted italic leading-snug [&_*]:text-term-muted">
      <div
        className={
          shouldCollapse && !isExpanded
            ? "relative max-h-34 overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:h-10 after:bg-linear-to-b after:from-transparent after:to-term-green/8 after:content-['']"
            : undefined
        }
      >
        <FormattedChatText text={text} />
      </div>
      {shouldCollapse ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-1 h-auto rounded border-0 px-0 py-0 font-semibold text-[0.75rem] text-term-cyan hover:bg-transparent hover:text-term-green"
        >
          {isExpanded ? showLessLabel : showMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}

function FormattedChatText({ text }: { text: string }) {
  const { blocks } = useMemo(() => WhatsAppMessageParser.parse(text), [text]);
  const getBlockKey = useMemo(() => createSiblingKeyFactory(), []);

  if (blocks.length === 0) {
    return (
      <p className="wrap-break-word m-0 whitespace-pre-wrap text-sm text-term-text leading-relaxed" />
    );
  }

  return (
    <div className="wrap-break-word flex flex-col gap-2 text-sm text-term-text leading-relaxed">
      {blocks.map((block) => (
        <MessageBlock key={getBlockKey(serializeBlock(block))} block={block} />
      ))}
    </div>
  );
}

function MessageBlock({ block }: { block: WhatsAppBlockNode }) {
  switch (block.type) {
    case "paragraph": {
      const getParagraphLineKey = createSiblingKeyFactory();

      return (
        <div className="flex flex-col gap-1 whitespace-pre-wrap">
          {block.lines.map((line) => (
            <p
              key={getParagraphLineKey(serializeInlineNodes(line))}
              className="m-0"
            >
              <InlineNodes nodes={line} />
            </p>
          ))}
        </div>
      );
    }
    case "bulletList": {
      const getBulletKey = createSiblingKeyFactory();

      return (
        <ul className="m-0 list-none space-y-1 p-0">
          {block.items.map((item) => (
            <li
              key={getBulletKey(serializeInlineNodes(item))}
              className="relative pl-5 before:absolute before:left-0 before:font-mono before:font-semibold before:text-term-green before:content-['>']"
            >
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ul>
      );
    }
    case "orderedList": {
      const getOrderedKey = createSiblingKeyFactory();

      return (
        <ol
          className="m-0 space-y-1 pl-5 marker:font-semibold marker:text-term-cyan/80"
          start={block.start}
        >
          {block.items.map((item) => (
            <li
              key={getOrderedKey(serializeInlineNodes(item))}
              className="pl-1"
            >
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ol>
      );
    }
    case "quote": {
      const getQuoteKey = createSiblingKeyFactory();

      return (
        <blockquote className="m-0 rounded-r-md border-term-cyan/45 border-l-2 bg-term-cyan/8 px-3 py-2 text-term-text/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-col gap-1">
            {block.lines.map((line) => (
              <p key={getQuoteKey(serializeInlineNodes(line))} className="m-0">
                <InlineNodes nodes={line} />
              </p>
            ))}
          </div>
        </blockquote>
      );
    }
  }
}

function InlineNodes({ nodes }: { nodes: WhatsAppInlineNode[] }) {
  const getInlineKey = createSiblingKeyFactory();

  return (
    <>
      {nodes.map((node) => (
        <InlineNode key={getInlineKey(serializeInlineNode(node))} node={node} />
      ))}
    </>
  );
}

function InlineNode({ node }: { node: WhatsAppInlineNode }) {
  switch (node.type) {
    case "text":
      return <>{node.value}</>;
    case "bold":
      return (
        <strong className="font-semibold text-term-bright">
          <InlineNodes nodes={node.children} />
        </strong>
      );
    case "italic":
      return (
        <em className="text-term-text/95 italic">
          <InlineNodes nodes={node.children} />
        </em>
      );
    case "strikethrough":
      return (
        <span className="text-term-muted line-through decoration-2 decoration-term-red/60">
          <InlineNodes nodes={node.children} />
        </span>
      );
    case "inlineCode":
      return (
        <code className="rounded border border-term-border bg-term-chrome px-1.5 py-0.5 font-mono text-[0.8125em] text-term-amber shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          {node.value}
        </code>
      );
    case "monospace":
      return (
        <code className="rounded-md border border-term-green/20 bg-term-green/8 px-2 py-1 font-mono text-[0.8125em] text-term-green shadow-[0_0_18px_rgba(80,223,170,0.08)]">
          {node.value}
        </code>
      );
  }
}

function serializeBlock(block: WhatsAppBlockNode): string {
  switch (block.type) {
    case "paragraph":
      return `paragraph:${block.lines.map(serializeInlineNodes).join("\\n")}`;
    case "bulletList":
      return `bullet:${block.items.map(serializeInlineNodes).join("|")}`;
    case "orderedList":
      return `ordered:${block.start}:${block.items.map(serializeInlineNodes).join("|")}`;
    case "quote":
      return `quote:${block.lines.map(serializeInlineNodes).join("\\n")}`;
  }
}

function serializeInlineNodes(nodes: WhatsAppInlineNode[]): string {
  return nodes.map(serializeInlineNode).join("");
}

function serializeInlineNode(node: WhatsAppInlineNode): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
    case "monospace":
      return `${node.type}:${node.value}`;
    case "bold":
    case "italic":
    case "strikethrough":
      return `${node.type}:(${serializeInlineNodes(node.children)})`;
  }
}

function createSiblingKeyFactory(): (signature: string) => string {
  const seen = new Map<string, number>();

  return (signature: string) => {
    const count = seen.get(signature) ?? 0;
    seen.set(signature, count + 1);
    return `${signature}:${count}`;
  };
}
