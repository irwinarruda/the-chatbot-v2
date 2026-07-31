import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  LoaderCircle,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiGenerationTraceDTO } from "~/modules/chat/entities/dtos/ChatDTO";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { Button } from "~/shared/client/components/ui/button";

export interface ChatActivityLabels {
  traceShow: string;
  traceHide: string;
  traceReasoning: string;
  traceReasonings: string;
  traceTool: string;
  traceTools: string;
  traceTokens: string;
  traceRedacted: string;
  toolRunning: string;
  toolSucceeded: string;
  toolFailed: string;
  toolUnknown: string;
  toolInput: string;
  toolOutput: string;
}

interface ReasoningActivityProps {
  text: string;
  label: string;
  redacted?: boolean;
  redactedLabel: string;
  isLive?: boolean;
}

interface ToolActivityProps {
  name: string;
  argumentsValue?: unknown;
  outcome?: unknown;
  runningLabel: string;
  succeededLabel: string;
  failedLabel: string;
  unknownLabel: string;
  inputLabel: string;
  outputLabel: string;
}

export function GenerationTrace({
  trace,
  labels,
}: {
  trace: AiGenerationTraceDTO[];
  labels: ChatActivityLabels;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reasoningCount = trace.reduce(
    (count, generation) =>
      count +
      generation.items.filter((item) => item.type === "reasoning").length,
    0,
  );
  const toolCount = trace.reduce(
    (count, generation) =>
      count +
      generation.items.filter((item) => item.type === "toolCall").length,
    0,
  );
  const reasoningCountLabel =
    reasoningCount === 1 ? labels.traceReasoning : labels.traceReasonings;
  const toolCountLabel = toolCount === 1 ? labels.traceTool : labels.traceTools;

  return (
    <div className="mb-2 border-term-border border-b pb-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? labels.traceHide : labels.traceShow}
        onClick={() => setIsExpanded((current) => !current)}
        className="h-auto min-h-11 pointer-fine:min-h-8 max-w-full flex-wrap justify-start gap-1.5 rounded px-1.5 py-1.5 text-left font-mono text-term-muted text-xs leading-normal hover:bg-term-chrome/55 hover:text-term-bright"
      >
        <ChevronRight
          aria-hidden="true"
          className="size-3 transition-transform data-[expanded=true]:rotate-90"
          data-expanded={isExpanded}
        />
        {labels.traceShow}
        {reasoningCount > 0 && (
          <span>
            · {reasoningCount} {reasoningCountLabel}
          </span>
        )}
        {toolCount > 0 && (
          <span>
            · {toolCount} {toolCountLabel}
          </span>
        )}
      </Button>
      {isExpanded && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {trace.map((generation) => (
            <GenerationActivity
              key={generation.id}
              generation={generation}
              labels={labels}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReasoningActivity({
  text,
  label,
  redacted,
  redactedLabel,
  isLive,
}: ReasoningActivityProps) {
  return (
    <div className="relative pl-5">
      <span
        aria-hidden="true"
        className="absolute top-0.5 left-0 text-term-magenta"
      >
        ∴
      </span>
      <span className="sr-only">{label}: </span>
      <CompactReasoningMarkdown
        markdown={redacted ? redactedLabel : text}
        isLive={isLive}
      />
    </div>
  );
}

function GenerationActivity({
  generation,
  labels,
}: {
  generation: AiGenerationTraceDTO;
  labels: ChatActivityLabels;
}) {
  const toolResults = new Map(
    generation.items
      .filter((item) => item.type === "toolResult")
      .map((item) => [item.callId, item.outcome]),
  );
  const toolCallIds = new Set(
    generation.items
      .filter((item) => item.type === "toolCall")
      .map((item) => item.callId),
  );

  return (
    <section className="flex flex-col gap-1.5 border-term-border border-l pl-3 [&>[data-slot=chat-tool-activity]+[data-slot=chat-tool-activity]]:-mt-1.5">
      {generation.items.map((item, index) => {
        const itemKey = `${generation.id}:${item.type}:${index}`;
        if (item.type === "reasoning") {
          return (
            <ReasoningActivity
              key={itemKey}
              text={item.text}
              label={labels.traceReasoning}
              redacted={item.redacted}
              redactedLabel={labels.traceRedacted}
            />
          );
        }
        if (item.type === "text") {
          return (
            <ReasoningActivity
              key={itemKey}
              text={item.text}
              label={labels.traceReasoning}
              redactedLabel={labels.traceRedacted}
            />
          );
        }
        if (item.type === "toolCall") {
          return (
            <ToolActivity
              key={itemKey}
              name={item.name}
              argumentsValue={item.arguments}
              outcome={toolResults.get(item.callId)}
              runningLabel={labels.toolRunning}
              succeededLabel={labels.toolSucceeded}
              failedLabel={labels.toolFailed}
              unknownLabel={labels.toolUnknown}
              inputLabel={labels.toolInput}
              outputLabel={labels.toolOutput}
            />
          );
        }
        if (toolCallIds.has(item.callId)) return null;
        return (
          <ToolActivity
            key={itemKey}
            name={item.callId}
            outcome={item.outcome}
            runningLabel={labels.toolRunning}
            succeededLabel={labels.toolSucceeded}
            failedLabel={labels.toolFailed}
            unknownLabel={labels.toolUnknown}
            inputLabel={labels.toolInput}
            outputLabel={labels.toolOutput}
          />
        );
      })}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 font-mono text-2xs text-term-muted">
        <span className="text-term-green">
          {generation.model ?? generation.provider ?? "unknown"}
        </span>
        <span>{generation.reasoningEffort}</span>
        {generation.usage && (
          <span>
            {generation.usage.totalTokens.toLocaleString()} {labels.traceTokens}
          </span>
        )}
      </div>
    </section>
  );
}

export function ToolActivity({
  name,
  argumentsValue,
  outcome,
  runningLabel,
  succeededLabel,
  failedLabel,
  unknownLabel,
  inputLabel,
  outputLabel,
}: ToolActivityProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getToolStatus(
    outcome,
    runningLabel,
    succeededLabel,
    failedLabel,
    unknownLabel,
  );
  const hasDetails = argumentsValue !== undefined || outcome !== undefined;
  const preview = getToolPreview(outcome ?? argumentsValue);

  return (
    <div data-slot="chat-tool-activity">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={hasDetails ? isExpanded : undefined}
        onClick={() => {
          if (hasDetails) setIsExpanded((current) => !current);
        }}
        className="h-auto pointer-fine:h-auto min-h-11 pointer-fine:min-h-6 w-full justify-start gap-1.5 rounded px-1.5 py-0 text-left font-mono text-term-muted text-xs hover:bg-term-chrome/55 hover:text-term-bright"
      >
        <Wrench
          aria-hidden="true"
          className="size-3.5 shrink-0 text-term-blue"
        />
        <span className="shrink-0 text-term-bright">{name}</span>
        {preview && (
          <span className="min-w-0 flex-1 truncate text-term-muted">
            {preview}
          </span>
        )}
        <span
          className={`ml-auto inline-flex shrink-0 items-center gap-1 ${status.className}`}
        >
          <status.Icon
            aria-hidden="true"
            className={`size-3 ${status.iconClassName}`}
          />
          {status.label}
        </span>
        {hasDetails && (
          <ChevronRight
            aria-hidden="true"
            data-expanded={isExpanded}
            className="size-3 shrink-0 transition-transform data-[expanded=true]:rotate-90"
          />
        )}
      </Button>
      {hasDetails && isExpanded && (
        <div className="ml-3 space-y-1 border-term-border border-l py-1 pl-5">
          {argumentsValue !== undefined && (
            <ToolDetail label={inputLabel} value={argumentsValue} />
          )}
          {outcome !== undefined && (
            <ToolDetail label={outputLabel} value={outcome} />
          )}
        </div>
      )}
    </div>
  );
}

function ToolDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 font-mono text-2xs text-term-muted uppercase tracking-wide">
        {label}
      </div>
      <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-term-text text-xs leading-relaxed">
        {stringifyToolValue(value)}
      </pre>
    </div>
  );
}

function CompactReasoningMarkdown({
  markdown,
  isLive,
}: {
  markdown: string;
  isLive?: boolean;
}) {
  return (
    <div className="wrap-break-word min-w-0 text-[0.8125rem] text-term-text leading-[1.5] [&_a]:text-term-blue [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-1.5 [&_blockquote]:border-term-cyan/45 [&_blockquote]:border-l-2 [&_blockquote]:pl-2.5 [&_code]:rounded [&_code]:bg-term-chrome [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em] [&_code]:text-term-amber [&_em]:italic [&_h1]:my-1.5 [&_h1]:font-semibold [&_h1]:text-sm [&_h1]:text-term-bright [&_h2]:my-1.5 [&_h2]:font-semibold [&_h2]:text-[0.8125rem] [&_h2]:text-term-bright [&_h3]:my-1.5 [&_h3]:font-medium [&_h3]:text-[0.8125rem] [&_h3]:text-term-cyan [&_hr]:my-1.5 [&_hr]:border-term-border [&_li+li]:mt-1 [&_li]:my-0 [&_ol]:my-1.5 [&_ol]:pl-5 [&_p+p]:mt-1.5 [&_p]:my-0 [&_pre]:my-1.5 [&_pre]:max-h-72 [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:border [&_pre]:border-term-border [&_pre]:bg-term-bg [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-term-bright [&_table]:my-1.5 [&_table]:w-full [&_table]:text-left [&_td]:border [&_td]:border-term-border [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-term-border [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-term-bright [&_ul]:my-1.5 [&_ul]:list-['>__'] [&_ul]:pl-5 [&_ul]:marker:text-term-green">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ children, href }) {
            return (
              <a href={href} rel="noreferrer" target="_blank">
                {children}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
      {isLive && <span className="terminal-cursor" aria-hidden="true" />}
    </div>
  );
}

function getToolStatus(
  outcome: unknown,
  runningLabel: string,
  succeededLabel: string,
  failedLabel: string,
  unknownLabel: string,
) {
  const status = getOutcomeStatus(outcome);
  if (!status) {
    return {
      Icon: LoaderCircle,
      label: runningLabel,
      className: "text-term-amber",
      iconClassName: "motion-safe:animate-spin",
    };
  }
  if (status === ToolResultStatus.Succeeded) {
    return {
      Icon: Check,
      label: succeededLabel,
      className: "text-term-green",
      iconClassName: "",
    };
  }
  if (status === ToolResultStatus.Failed) {
    return {
      Icon: CircleAlert,
      label: failedLabel,
      className: "text-term-red",
      iconClassName: "",
    };
  }
  return {
    Icon: CircleHelp,
    label: unknownLabel,
    className: "text-term-amber",
    iconClassName: "",
  };
}

function getOutcomeStatus(outcome: unknown): string | undefined {
  if (!outcome || typeof outcome !== "object" || !("status" in outcome)) {
    return undefined;
  }
  if (typeof outcome.status !== "string") return undefined;
  return outcome.status;
}

function getToolPreview(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const compact = stringifyToolValue(value).replace(/\s+/g, " ").trim();
  if (compact.length <= 96) return compact;
  return `${compact.slice(0, 95)}…`;
}

function stringifyToolValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? String(value);
}
