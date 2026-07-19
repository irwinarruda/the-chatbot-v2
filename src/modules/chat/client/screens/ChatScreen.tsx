import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  MessageSquare,
  Mic,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChatMessage } from "~/modules/chat/client/components/ChatMessage";
import { audioInputService } from "~/modules/chat/client/services/audioInputService";
import type { ChatErrorCode } from "~/modules/chat/client/state/chatSlice";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
import { Button } from "~/shared/client/components/ui/button";
import { Card, CardContent } from "~/shared/client/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "~/shared/client/components/ui/empty";
import { Label } from "~/shared/client/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/shared/client/components/ui/native-select";
import { Textarea } from "~/shared/client/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

export function ChatScreen() {
  // TanStack Virtual reads mutable virtualizer state during render.
  "use no memo";
  const navigate = useNavigate();
  const prefs = usePrefs();
  const currentUser = useApp((s) => s.currentUser);
  const chatMessages = useApp((s) => s.chatMessages);
  const chatInput = useApp((s) => s.chatInput);
  const chatError = useApp((s) => s.chatError);
  const isChatBootstrapping = useApp((s) => s.isChatBootstrapping);
  const isChatSubmitting = useApp((s) => s.isChatSubmitting);
  const audioInputOptions = useApp((s) => s.audioInputOptions);
  const selectedAudioInputId = useApp((s) => s.selectedAudioInputId);
  const isRecording = useApp((s) => s.isRecording);
  const recordingDuration = useApp((s) => s.recordingDuration);
  const canSendChatInput = useApp((s) => s.canSendChatInput);
  const canSelectAudioInput = useApp((s) => s.canSelectAudioInput);
  const setChatInput = useApp((s) => s.setChatInput);
  const clearChatError = useApp((s) => s.clearChatError);
  const bootstrapChat = useApp((s) => s.bootstrapChat);
  const refreshChat = useApp((s) => s.refreshChat);
  const syncAudioInputs = useApp((s) => s.syncAudioInputs);
  const selectAudioInput = useApp((s) => s.selectAudioInput);
  const sendChatInput = useApp((s) => s.sendChatInput);
  const sendButtonReply = useApp((s) => s.sendButtonReply);
  const startRecording = useApp((s) => s.startRecording);
  const stopRecording = useApp((s) => s.stopRecording);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.chatPage;
  const inputElRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAssistantResponding =
    isChatSubmitting && chatMessages.at(-1)?.userType === "user";
  const lastChatItemIndex = isAssistantResponding
    ? chatMessages.length
    : chatMessages.length - 1;
  const virtualizer = useVirtualizer({
    count: chatMessages.length + (isAssistantResponding ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (index === chatMessages.length) return 56;
      const msg = chatMessages[index];
      if (msg.type === "audio" && msg.mediaUrl) return 90;
      if (
        msg.type === "interactive" &&
        msg.userType === "bot" &&
        msg.buttonReplyOptions
      )
        return 120;
      return 60;
    },
    overscan: 5,
  });
  const chatErrorMessages: Record<ChatErrorCode, string> = {
    microphone: t.errorMicrophone,
    sending: t.errorSending,
    loading: t.errorLoading,
  };
  const chatErrorMessage = chatError ? chatErrorMessages[chatError] : undefined;
  const windowTitle = currentUser
    ? `${t.windowTitle} - ${currentUser.name}`
    : t.windowTitle;
  function onScroll() {
    const el = parentRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }

  function resizeInput(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  function onInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(event.target.value);
    resizeInput(event.target);
  }

  async function onSend() {
    if (!canSendChatInput) return;
    if (inputElRef.current) inputElRef.current.style.height = "auto";
    await sendChatInput();
    inputElRef.current?.focus();
  }

  function onAudioInputChange(event: ChangeEvent<HTMLSelectElement>) {
    void selectAudioInput(event.target.value);
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSend();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    void onSend();
  }

  function onScrollToBottom() {
    isNearBottomRef.current = true;
    setShowScrollBtn(false);
    virtualizer.scrollToIndex(lastChatItemIndex, { align: "end" });
  }

  function onCancelRecording() {
    stopRecording(false);
  }

  function onSendRecording() {
    stopRecording(true);
  }

  function onStartRecording() {
    startRecording();
  }

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  useEffect(() => {
    if (isNearBottomRef.current && chatMessages.length > 0) {
      virtualizer.scrollToIndex(lastChatItemIndex, { align: "end" });
    }
  }, [chatMessages.length, lastChatItemIndex, virtualizer]);

  useEffect(() => {
    const inputEl = inputElRef.current;
    if (!inputEl) return;
    resizeInput(inputEl);
  }, [chatInput]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current && chatMessages.length > 0) {
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(lastChatItemIndex, { align: "end" });
        });
      }
    });
    observer.observe(composer);
    return () => observer.disconnect();
  }, [chatMessages.length, lastChatItemIndex, virtualizer]);

  useEffect(() => {
    let cancelled = false;
    bootstrapChat().then((result) => {
      if (cancelled) return;
      if (result === "unauthorized") {
        navigate({ to: "/chat/login" });
      } else if (result === "not_registered") {
        navigate({ to: "/chat/not-registered" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshChat();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    void syncAudioInputs();
    return audioInputService.subscribeToDeviceChanges(() => {
      void syncAudioInputs();
    });
  }, []);

  if (isChatBootstrapping) {
    return (
      <main className="min-viewport-height flex w-full items-stretch bg-term-bg">
        <div className="viewport-height flex w-full flex-col">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-1 items-center justify-center gap-2 bg-term-window font-mono text-sm text-term-muted"
          >
            <span className="terminal-cursor" aria-hidden="true" />
            <span>{t.loading}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <TerminalWindow
      title={windowTitle}
      wide
      activePath="/chat"
      dictionary={dictionary}
      showLogout
      mainClassName="items-stretch sm:items-center"
      frameClassName="chat-frame-height"
      navigationClassName="sm:mx-auto sm:mt-3 sm:w-full sm:max-w-3xl"
      windowClassName="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0 md:p-0"
      showShadow={false}
    >
      {chatErrorMessage ? (
        <Alert
          variant="destructive"
          className="shrink-0 rounded-none border-term-red/25 border-x-0 border-t-0 border-b bg-term-red/12 px-4 py-2.5"
        >
          <AlertDescription className="flex items-center justify-between gap-3 text-sm text-term-red [&_p:not(:last-child)]:mb-0">
            <span className="flex min-w-0 items-center gap-2">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              <span>{chatErrorMessage}</span>
            </span>
            <TooltipButton
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={clearChatError}
              label={dictionary.common.dismiss}
              className="pointer-fine:size-7 size-11 rounded-md border-0 p-0 text-term-red hover:bg-term-red/10 hover:text-term-red"
            >
              <X className="size-3.5" />
            </TooltipButton>
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        ref={parentRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto overscroll-y-contain px-[max(0.75rem,env(safe-area-inset-left))] py-4 pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-5 sm:py-6"
      >
        {chatMessages.length === 0 ? (
          <Empty className="h-full rounded-none border-0 px-4 py-10">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-10 border border-term-green/20 bg-term-green/8 text-term-green"
              >
                <MessageSquare className="size-4" aria-hidden="true" />
              </EmptyMedia>
              <EmptyDescription className="m-0 text-base text-term-muted leading-7">
                <span
                  aria-hidden="true"
                  className="mr-1 font-mono font-semibold text-term-green"
                >
                  $
                </span>
                {t.emptyState}
                <span className="terminal-cursor" aria-hidden="true" />
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div
            className="mx-auto w-full max-w-3xl"
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              if (virtualItem.index === chatMessages.length) {
                return (
                  <div
                    key="assistant-progress"
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div
                      role="status"
                      aria-live="polite"
                      className="w-full py-2"
                    >
                      <div className="mb-1.5 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider">
                        <span
                          aria-hidden="true"
                          className="font-bold text-term-green"
                        >
                          {">"}
                        </span>
                        <span className="font-semibold text-term-green">
                          {t.bot}
                        </span>
                        <span className="text-term-muted normal-case tracking-normal">
                          {t.responding}
                        </span>
                      </div>
                      <div className="pl-4">
                        <span className="terminal-cursor" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                );
              }
              const message = chatMessages[virtualItem.index];
              return (
                <div
                  key={message.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="pb-2">
                    <ChatMessage
                      message={message}
                      theme={prefs.theme}
                      locale={prefs.locale}
                      isSending={isChatSubmitting}
                      youLabel={t.you}
                      botLabel={t.bot}
                      showMoreLabel={t.showMoreTranscript}
                      showLessLabel={t.showLessTranscript}
                      onButtonReply={sendButtonReply}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        ref={composerRef}
        className="relative shrink-0 border-term-border/50 border-t bg-linear-to-t from-term-window via-term-window to-term-window/90 px-[max(0.75rem,env(safe-area-inset-left))] pt-2.5 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-3 sm:pb-4"
      >
        {showScrollBtn && chatMessages.length > 0 && (
          <div className="pointer-events-none absolute right-[max(1rem,env(safe-area-inset-right))] bottom-full z-10 mb-4 sm:right-auto sm:left-1/2 sm:flex sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:justify-end">
            <TooltipButton
              type="button"
              onClick={onScrollToBottom}
              label={t.scrollToLatest}
              variant="outline"
              size="icon"
              className="pointer-events-auto rounded-full border-term-border bg-term-chrome/95 p-0 text-term-muted shadow-black/15 shadow-lg backdrop-blur-sm hover:border-term-green/35 hover:bg-term-green/10 hover:text-term-green"
            >
              <ArrowDown className="size-4" />
            </TooltipButton>
          </div>
        )}
        {isRecording ? (
          <Card
            size="sm"
            className="mx-auto w-full max-w-3xl gap-0 rounded-xl border-term-red/30 bg-term-bg/90 py-0 shadow-black/10 shadow-sm"
          >
            <CardContent className="flex flex-wrap items-center gap-2.5 px-3 py-3">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-term-red motion-safe:animate-blink"
              />
              <span
                role="timer"
                aria-live="off"
                className="min-w-32 flex-1 font-mono text-sm text-term-red tabular-nums"
              >
                {t.recording} {formatTime(recordingDuration)}
              </span>
              <Button
                type="button"
                onClick={onCancelRecording}
                variant="outline"
                className="rounded-lg border-term-border bg-transparent font-mono text-sm text-term-muted shadow-none hover:border-term-red/35 hover:bg-term-red/10 hover:text-term-red"
              >
                <Trash2 className="size-3.5" />
                {t.cancelRecording}
              </Button>
              <Button
                type="button"
                onClick={onSendRecording}
                variant="destructive"
                className="rounded-lg border border-term-red/40 bg-term-red/8 font-mono text-sm text-term-red shadow-none hover:border-term-red/60 hover:bg-term-red/15 hover:text-term-red"
              >
                <Send className="size-3.5" />
                {t.sendRecording}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={onSubmit}
            className="group/form mx-auto w-full max-w-3xl rounded-xl border border-term-border bg-term-chrome/55 p-2 shadow-sm transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-ring focus-within:bg-term-bg/80 focus-within:shadow-field focus-within:ring-3 focus-within:ring-ring/50"
          >
            <Label htmlFor="chat-message-input" className="sr-only">
              {t.placeholder}
            </Label>
            <div className="flex min-w-0 items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-2.5 shrink-0 font-mono font-semibold text-base text-term-green [text-shadow:0_0_8px_rgba(80,223,170,0.35)]"
              >
                {">"}
              </span>
              <Textarea
                id="chat-message-input"
                ref={inputElRef}
                rows={1}
                value={chatInput}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                placeholder={t.placeholder}
                enterKeyHint="send"
                autoComplete="off"
                className="max-h-40 min-h-12 min-w-0 resize-none appearance-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-2 font-mono pointer-fine:text-sm text-base text-term-text leading-6 caret-term-green shadow-none ring-0 placeholder:text-term-muted/70 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>

            <div className="mt-1 flex min-h-8 items-center justify-between gap-3 border-term-border/60 border-t pt-2">
              <div
                data-disabled={!canSelectAudioInput}
                className="relative w-full max-w-55 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
              >
                <Label htmlFor="chat-audio-input" className="sr-only">
                  {t.audioInputLabel}
                </Label>
                <span
                  className="pointer-events-none absolute top-1/2 left-2.5 z-10 inline-flex size-3 -translate-y-1/2 items-center justify-center text-term-muted"
                  aria-hidden="true"
                >
                  <Mic className="size-3" />
                </span>
                <NativeSelect
                  id="chat-audio-input"
                  size="sm"
                  className="w-full **:data-[slot=native-select-icon]:right-2 **:data-[slot=native-select-icon]:size-3 **:data-[slot=native-select-icon]:text-term-muted [&_[data-slot=native-select]]:h-11 pointer-fine:[&_[data-slot=native-select]]:h-7 [&_[data-slot=native-select]]:rounded-md [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pr-7 [&_[data-slot=native-select]]:pl-7 [&_[data-slot=native-select]]:font-mono [&_[data-slot=native-select]]:text-sm [&_[data-slot=native-select]]:text-term-muted pointer-fine:[&_[data-slot=native-select]]:text-xs [&_[data-slot=native-select]]:transition-colors [&_[data-slot=native-select]]:hover:border-term-amber/25 [&_[data-slot=native-select]]:hover:bg-term-amber/8 [&_[data-slot=native-select]]:hover:text-term-amber [&_[data-slot=native-select]]:focus-visible:border-term-amber/40 [&_[data-slot=native-select]]:focus-visible:ring-0"
                  value={selectedAudioInputId}
                  onChange={onAudioInputChange}
                  disabled={!canSelectAudioInput}
                  aria-label={t.audioInputLabel}
                >
                  {audioInputOptions.length === 0 ? (
                    <NativeSelectOption value="">
                      {t.audioInputUnavailable}
                    </NativeSelectOption>
                  ) : (
                    audioInputOptions.map((option) => (
                      <NativeSelectOption
                        key={option.deviceId}
                        value={option.deviceId}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))
                  )}
                </NativeSelect>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1.5">
                <TooltipButton
                  type="button"
                  onClick={onStartRecording}
                  disabled={isChatSubmitting}
                  label={t.startRecording}
                  variant="ghost"
                  size="icon"
                  className="rounded-lg border border-transparent bg-transparent p-0 text-term-muted hover:border-term-amber/20 hover:bg-term-amber/10 hover:text-term-amber dark:hover:bg-term-amber/10"
                >
                  <Mic className="size-4" />
                </TooltipButton>
                <TooltipButton
                  type="submit"
                  disabled={!canSendChatInput}
                  label={t.send}
                  size="icon"
                  className="rounded-lg border border-term-green/25 bg-term-green p-0 text-term-bg shadow-sm shadow-term-green/10 hover:bg-term-green-dim hover:text-term-bg disabled:border-term-border disabled:bg-term-chrome disabled:text-term-muted disabled:shadow-none"
                >
                  <ArrowUp className="size-4" />
                </TooltipButton>
              </div>
            </div>
          </form>
        )}
      </div>
    </TerminalWindow>
  );
}

type TooltipButtonProps = ComponentProps<typeof Button> & {
  label: string;
};

function TooltipButton({ label, ...props }: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} aria-label={label} />} />
      <TooltipContent className="border border-term-border font-mono text-xs shadow-lg">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
