import { memo, useState } from "react";
import {
  type WhatsAppBlockNode,
  type WhatsAppInlineNode,
  WhatsAppMessageParser,
} from "~/client/modules/chat/parsers/WhatsAppMessageParser";
import { AudioWaveform } from "~/client/shared/components/AudioWaveform";
import { Button } from "~/client/shared/components/ui/button";
import type { ChatMessageDTO as ChatMessageEntity } from "~/contracts/http/chat/chat";
import { type ChatActivityLabels, GenerationTrace } from "./ChatActivity";

interface ChatMessageProps {
  message: ChatMessageEntity;
  theme: "dark" | "light";
  locale: string;
  isSending: boolean;
  youLabel: string;
  botLabel: string;
  showMoreLabel: string;
  showLessLabel: string;
  activityLabels: ChatActivityLabels;
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
  activityLabels,
  onButtonReply,
}: ChatMessageProps) {
  const isUser = message.userType === "user";
  const isAudio = message.type === "audio" && Boolean(message.mediaUrl);
  const timestamp = new Date(message.createdAt).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!isUser) {
    return (
      <article className="w-full py-2">
        <div className="mb-1.5 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider">
          <span aria-hidden="true" className="font-bold text-primary">
            {">"}
          </span>
          <span className="font-semibold text-primary">{botLabel}</span>
          <time dateTime={message.createdAt} className="text-muted-foreground">
            {timestamp}
          </time>
        </div>
        <div className="pl-4">
          {message.trace && (
            <GenerationTrace trace={message.trace} labels={activityLabels} />
          )}
          <MessageContent
            message={message}
            theme={theme}
            isAudio={isAudio}
            isSending={isSending}
            showMoreLabel={showMoreLabel}
            showLessLabel={showLessLabel}
            onButtonReply={onButtonReply}
          />
        </div>
      </article>
    );
  }

  return (
    <article
      className={`ml-auto flex w-fit flex-col ${
        isAudio ? "max-w-[88%] sm:max-w-80" : "max-w-[88%] sm:max-w-[75%]"
      }`}
    >
      <div className="mb-1 flex items-center justify-end gap-2 px-0.5 font-mono text-2xs uppercase tracking-wider">
        <span className="font-semibold text-foreground">{youLabel}</span>
        <time dateTime={message.createdAt} className="text-muted-foreground">
          {timestamp}
        </time>
      </div>
      <div className="rounded-lg border border-border bg-muted px-3.5 py-2.5">
        <MessageContent
          message={message}
          theme={theme}
          isAudio={isAudio}
          isSending={isSending}
          showMoreLabel={showMoreLabel}
          showLessLabel={showLessLabel}
          onButtonReply={onButtonReply}
        />
      </div>
    </article>
  );
});

function MessageContent({
  message,
  theme,
  isAudio,
  isSending,
  showMoreLabel,
  showLessLabel,
  onButtonReply,
}: {
  message: ChatMessageEntity;
  theme: "dark" | "light";
  isAudio: boolean;
  isSending: boolean;
  showMoreLabel: string;
  showLessLabel: string;
  onButtonReply: (text: string) => void;
}) {
  if (isAudio && message.mediaUrl) {
    return (
      <div className="flex flex-col gap-2">
        <AudioWaveform src={message.mediaUrl} theme={theme} />
        {message.transcript && (
          <AudioTranscript
            text={message.transcript}
            showMoreLabel={showMoreLabel}
            showLessLabel={showLessLabel}
          />
        )}
      </div>
    );
  }
  if (
    message.type === "interactive" &&
    message.userType === "bot" &&
    message.buttonReplyOptions
  ) {
    return (
      <div className="flex flex-col gap-3">
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
              className="rounded-lg font-mono text-sm shadow-none"
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    );
  }
  if (message.type === "command") {
    return (
      <p className="m-0 font-mono text-base text-syntax-function leading-7">
        <span aria-hidden="true" className="mr-2 text-primary">
          $
        </span>
        {message.text}
      </p>
    );
  }
  return <FormattedChatText text={message.buttonReply ?? message.text ?? ""} />;
}

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
  const onToggleExpanded = () => setIsExpanded((current) => !current);

  return (
    <div className="w-full text-base text-muted-foreground italic leading-7 [&_*]:text-muted-foreground">
      <div
        className={
          shouldCollapse && !isExpanded
            ? "relative max-h-34 overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:h-10 after:bg-linear-to-b after:from-transparent after:to-muted after:content-['']"
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
          onClick={onToggleExpanded}
          className="mt-1 h-11 pointer-fine:h-7 rounded-md border-0 px-2 font-mono text-info text-xs hover:bg-info/10 hover:text-info"
        >
          {isExpanded ? showLessLabel : showMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}

function FormattedChatText({ text }: { text: string }) {
  const { blocks } = WhatsAppMessageParser.parse(text);
  const getBlockKey = createSiblingKeyFactory();

  if (blocks.length === 0) {
    return (
      <p className="wrap-break-word m-0 whitespace-pre-wrap text-base text-foreground leading-7" />
    );
  }

  return (
    <div className="wrap-break-word flex flex-col gap-2.5 text-base text-foreground leading-7">
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
              className="relative pl-5 before:absolute before:left-0 before:font-mono before:font-semibold before:text-syntax-keyword before:content-['>']"
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
          className="m-0 space-y-1 pl-5 marker:font-semibold marker:text-syntax-keyword"
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
        <blockquote className="m-0 rounded-r-md border-syntax-keyword/60 border-l-2 bg-muted px-3 py-2 text-muted-foreground">
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
      return <LinkedText value={node.value} />;
    case "bold":
      return (
        <strong className="font-semibold text-syntax-param">
          <InlineNodes nodes={node.children} />
        </strong>
      );
    case "italic":
      return (
        <em className="text-syntax-string italic">
          <InlineNodes nodes={node.children} />
        </em>
      );
    case "strikethrough":
      return (
        <span className="text-muted-foreground line-through decoration-2 decoration-destructive/60">
          <InlineNodes nodes={node.children} />
        </span>
      );
    case "inlineCode":
      return (
        <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.8125em] text-syntax-function">
          {node.value}
        </code>
      );
    case "monospace":
      return (
        <code className="rounded-md border border-border bg-code px-2 py-1 font-mono text-[0.8125em] text-syntax-function">
          {node.value}
        </code>
      );
  }
}

function LinkedText({ value }: { value: string }) {
  const parts = value.split(/(https?:\/\/[^\s]+)/g);
  const getPartKey = createSiblingKeyFactory();

  return (
    <>
      {parts.map((part) =>
        /^https?:\/\/[^\s]+$/.test(part) ? (
          <a
            key={getPartKey(part)}
            href={part}
            className="text-foreground underline decoration-syntax-type underline-offset-2 transition-colors hover:text-syntax-type focus-visible:text-syntax-type"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
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
