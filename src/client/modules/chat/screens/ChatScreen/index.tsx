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
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatErrorCode } from "~/client/modules/chat/app/services/ChatService";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "~/client/shared/components/ui/empty";
import { Label } from "~/client/shared/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/client/shared/components/ui/native-select";
import { Textarea } from "~/client/shared/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import { isReasoningEffort } from "~/domain/chat/reasoning-effort";
import { ChatMessage } from "./ChatMessage";
import { ChatResponseProgress } from "./ChatResponseProgress";

export function ChatScreen() {
  "use no memo";
  const navigate = useNavigate();
  const prefs = usePrefs();
  const currentUser = useApp((s) => s.currentUser);
  const chatMessages = useApp((s) => s.chatMessages);
  const chatInput = useApp((s) => s.chatInput);
  const chatResponseProgress = useApp((s) => s.chatResponseProgress);
  const currentModel = useApp((s) => s.currentModel);
  const availableModels = useApp((s) => s.availableModels);
  const reasoningEffort = useApp((s) => s.reasoningEffort);
  const supportedReasoningEfforts = useApp((s) => s.supportedReasoningEfforts);
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
  const resetChat = useApp((state) => state.resetChat);
  const resetRecording = useApp((state) => state.resetRecording);
  const bootstrapChat = useApp((s) => s.bootstrapChat);
  const refreshChat = useApp((s) => s.refreshChat);
  const watchAudioInputs = useApp((s) => s.watchAudioInputs);
  const selectAudioInput = useApp((s) => s.selectAudioInput);
  const sendChatInput = useApp((s) => s.sendChatInput);
  const setModel = useApp((s) => s.setModel);
  const setReasoningEffort = useApp((s) => s.setReasoningEffort);
  const sendButtonReply = useApp((s) => s.sendButtonReply);
  const startRecording = useApp((s) => s.startRecording);
  const stopRecording = useApp((s) => s.stopRecording);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.chatPage;
  const inputElRef = useRef<HTMLTextAreaElement | null>(null);
  const assistantProgressRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAssistantResponding =
    isChatSubmitting && chatMessages.at(-1)?.userType === "user";
  let currentModelId = "";
  if (currentModel) currentModelId = currentModel.model;
  let lastChatItemIndex = chatMessages.length - 1;
  let chatItemCount = chatMessages.length;
  if (isAssistantResponding) {
    lastChatItemIndex = chatMessages.length;
    chatItemCount += 1;
  }
  const getChatItemKey = useCallback(
    (index: number) => chatMessages[index]?.id ?? "assistant-progress",
    [chatMessages],
  );
  const virtualizer = useVirtualizer({
    count: chatItemCount,
    getScrollElement: () => parentRef.current,
    getItemKey: getChatItemKey,
    estimateSize: (index) => {
      if (index === chatMessages.length) return 180;
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
  const measureAssistantProgress = useCallback(
    (element: HTMLDivElement | null) => {
      assistantProgressRef.current = element;
      virtualizer.measureElement(element);
    },
    [virtualizer],
  );
  const chatErrorMessages: Record<ChatErrorCode, string> = {
    microphone: t.errorMicrophone,
    sending: t.errorSending,
    loading: t.errorLoading,
  };
  const chatErrorMessage = clientErrorMessage(chatError, chatErrorMessages);
  let windowTitle = t.windowTitle;
  if (currentUser) windowTitle = `${t.windowTitle} - ${currentUser.name}`;
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

  function onModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = availableModels.find(
      (model) => model.model === event.target.value,
    );
    if (!selected) return;
    void setModel(selected);
  }

  function onReasoningEffortChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!isReasoningEffort(event.target.value)) return;
    void setReasoningEffort(event.target.value);
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
    if (!isNearBottomRef.current || !isAssistantResponding) return;
    const animationFrame = requestAnimationFrame(() => {
      if (assistantProgressRef.current) {
        virtualizer.measureElement(assistantProgressRef.current);
      }
      virtualizer.scrollToIndex(lastChatItemIndex, { align: "end" });
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [
    chatResponseProgress,
    isAssistantResponding,
    lastChatItemIndex,
    virtualizer,
  ]);

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
        navigate({ to: "/login", search: { redirect: "/chat" } });
      } else if (result === "not_registered") {
        navigate({ to: "/not-registered", search: { redirect: "/chat" } });
      }
    });
    return () => {
      cancelled = true;
      resetRecording();
      resetChat();
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

  useEffect(() => watchAudioInputs(), []);

  if (isChatBootstrapping) {
    return (
      <main className="min-viewport-height flex w-full items-stretch bg-background">
        <div className="viewport-height flex w-full flex-col">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-1 items-center justify-center gap-2 bg-card font-mono text-muted-foreground text-sm"
          >
            <span className="terminal-cursor" aria-hidden="true" />
            <span>{t.loading}</span>
          </div>
        </div>
      </main>
    );
  }

  const hasAudioInputChoice = audioInputOptions.length > 1;

  return (
    <AppShell
      title={windowTitle}
      activePath="/chat"
      layout="fill"
      dictionary={dictionary}
      showLogout
    >
      {chatErrorMessage ? (
        <Alert
          variant="destructive"
          className="shrink-0 rounded-none border-x-0 border-t-0 border-b px-4 py-2.5"
        >
          <AlertDescription className="flex items-center justify-between gap-3 text-sm [&_p:not(:last-child)]:mb-0">
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
              className="pointer-fine:size-7 size-11 rounded-md border-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3.5" />
            </TooltipButton>
          </AlertDescription>
        </Alert>
      ) : null}

      <header className="hidden h-14 shrink-0 items-center gap-2 border-border border-b px-6 lg:flex">
        <h1 className="m-0 font-semibold text-foreground text-sm">
          {dictionary.nav.chat}
        </h1>
        <span className="text-muted-foreground text-xs">{t.syncedHint}</span>
      </header>
      <div
        ref={parentRef}
        onScroll={onScroll}
        className="chat-scroll-fade relative flex-1 overflow-y-auto overscroll-y-contain px-[max(0.75rem,env(safe-area-inset-left))] pt-4 pb-10 pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-5 sm:pt-6"
      >
        {chatMessages.length === 0 ? (
          <Empty className="h-full rounded-none border-0 px-4 py-10">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-10 border border-brand/20 bg-brand/10 text-primary"
              >
                <MessageSquare className="size-4" aria-hidden="true" />
              </EmptyMedia>
              <EmptyDescription className="m-0 text-base text-muted-foreground leading-7">
                <span
                  aria-hidden="true"
                  className="mr-1 font-mono font-semibold text-primary"
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
            className="mx-auto w-full max-w-2xl"
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
                    ref={measureAssistantProgress}
                    data-index={virtualItem.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <ChatResponseProgress
                      progress={chatResponseProgress}
                      respondingLabel={t.responding}
                      respondingElapsedLabel={t.respondingElapsed}
                      labels={t}
                    />
                  </div>
                );
              }
              const message = chatMessages[virtualItem.index];
              const previousMessage = chatMessages[virtualItem.index - 1];
              const dayLabel = getChatDayLabel(
                message.createdAt,
                previousMessage?.createdAt,
                prefs.locale,
              );
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
                      copiedLabel={t.copiedAction}
                      copyLabel={t.copyAction}
                      dayLabel={dayLabel}
                      message={message}
                      locale={prefs.locale}
                      isSending={isChatSubmitting}
                      youLabel={t.you}
                      botLabel={t.bot}
                      showMoreLabel={t.showMoreTranscript}
                      showLessLabel={t.showLessTranscript}
                      activityLabels={t}
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
        className="relative shrink-0 bg-background px-[max(0.75rem,env(safe-area-inset-left))] pt-2.5 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-3 sm:pb-4"
      >
        {showScrollBtn && chatMessages.length > 0 && (
          <div className="pointer-events-none absolute right-[max(1rem,env(safe-area-inset-right))] bottom-full z-10 mb-4 sm:right-auto sm:left-1/2 sm:flex sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:justify-end">
            <TooltipButton
              type="button"
              onClick={onScrollToBottom}
              label={t.scrollToLatest}
              variant="outline"
              size="icon"
              className="pointer-events-auto rounded-full border-border bg-muted/95 p-0 text-muted-foreground shadow-lg shadow-scrim/15 backdrop-blur-sm hover:border-brand/35 hover:bg-brand/12 hover:text-primary"
            >
              <ArrowDown className="size-4" />
            </TooltipButton>
          </div>
        )}
        {isRecording ? (
          <Card
            size="sm"
            className="mx-auto w-full max-w-2xl gap-0 rounded-xl border-destructive/30 bg-background/90 py-0 shadow-scrim/10 shadow-sm"
          >
            <CardContent className="flex flex-wrap items-center gap-2.5 px-3 py-3">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-blink"
              />
              <span
                role="timer"
                aria-live="off"
                className="min-w-32 flex-1 font-mono text-destructive text-sm tabular-nums"
              >
                {t.recording} {formatTime(recordingDuration)}
              </span>
              <Button
                type="button"
                onClick={onCancelRecording}
                variant="outline"
                className="rounded-lg border-border bg-transparent font-mono text-muted-foreground text-sm shadow-none hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                {t.cancelRecording}
              </Button>
              <Button
                type="button"
                onClick={onSendRecording}
                variant="destructive"
                className="rounded-lg border border-destructive/40 bg-destructive/10 font-mono text-destructive text-sm shadow-none hover:border-destructive/60 hover:bg-destructive/15 hover:text-destructive"
              >
                <Send className="size-3.5" />
                {t.sendRecording}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={onSubmit}
            className="group/form mx-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-2 shadow-scrim/10 shadow-sm transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-ring/60 focus-within:ring-3 focus-within:ring-ring/10"
          >
            <Label htmlFor="chat-message-input" className="sr-only">
              {t.placeholder}
            </Label>
            <div className="flex min-w-0 items-start gap-2 px-1.5">
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
                className="max-h-40 min-h-12 min-w-0 resize-none appearance-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-2 pointer-fine:text-sm text-base text-foreground leading-6 caret-brand shadow-none ring-0 placeholder:text-muted-foreground focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0"
              />
            </div>

            <div className="mt-1 flex min-h-8 min-w-0 items-center gap-1.5">
              <div className="flex min-w-0 items-center gap-1">
                <NativeSelect
                  id="chat-model"
                  size="sm"
                  className="w-fit min-w-0 max-w-48 **:data-[slot=native-select-icon]:right-1.5 [&_[data-slot=native-select]]:field-sizing-content **:data-[slot=native-select-icon]:size-3 **:data-[slot=native-select-icon]:text-muted-foreground [&_[data-slot=native-select]]:h-11 pointer-fine:[&_[data-slot=native-select]]:h-7 [&_[data-slot=native-select]]:truncate [&_[data-slot=native-select]]:rounded-md [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pr-6 [&_[data-slot=native-select]]:pl-2 [&_[data-slot=native-select]]:text-muted-foreground [&_[data-slot=native-select]]:text-sm pointer-fine:[&_[data-slot=native-select]]:text-xs [&_[data-slot=native-select]]:transition-colors [&_[data-slot=native-select]]:hover:border-border [&_[data-slot=native-select]]:hover:bg-accent [&_[data-slot=native-select]]:focus-visible:border-brand/40 [&_[data-slot=native-select]]:focus-visible:ring-0"
                  value={currentModelId}
                  onChange={onModelChange}
                  disabled={isChatSubmitting || availableModels.length === 0}
                  aria-label={t.modelLabel}
                >
                  {availableModels.map((model) => (
                    <NativeSelectOption
                      key={`${model.provider}/${model.model}`}
                      value={model.model}
                    >
                      {model.model}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NativeSelect
                  id="chat-reasoning-effort"
                  size="sm"
                  className="w-fit **:data-[slot=native-select-icon]:right-1.5 [&_[data-slot=native-select]]:field-sizing-content **:data-[slot=native-select-icon]:size-3 **:data-[slot=native-select-icon]:text-muted-foreground [&_[data-slot=native-select]]:h-11 pointer-fine:[&_[data-slot=native-select]]:h-7 [&_[data-slot=native-select]]:rounded-md [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pr-6 [&_[data-slot=native-select]]:pl-2 [&_[data-slot=native-select]]:text-muted-foreground [&_[data-slot=native-select]]:text-sm pointer-fine:[&_[data-slot=native-select]]:text-xs [&_[data-slot=native-select]]:transition-colors [&_[data-slot=native-select]]:hover:border-border [&_[data-slot=native-select]]:hover:bg-accent [&_[data-slot=native-select]]:focus-visible:border-brand/40 [&_[data-slot=native-select]]:focus-visible:ring-0"
                  value={reasoningEffort}
                  onChange={onReasoningEffortChange}
                  disabled={isChatSubmitting}
                  aria-label={t.reasoningEffortLabel}
                >
                  {supportedReasoningEfforts.map((effort) => (
                    <NativeSelectOption key={effort} value={effort}>
                      {t.reasoningEffortShort} · {effort}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                {hasAudioInputChoice && (
                  <div
                    data-disabled={!canSelectAudioInput}
                    className="relative hidden w-44 min-w-0 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 sm:block"
                  >
                    <Label htmlFor="chat-audio-input" className="sr-only">
                      {t.audioInputLabel}
                    </Label>
                    <span
                      className="pointer-events-none absolute top-1/2 left-2.5 z-10 inline-flex size-3 -translate-y-1/2 items-center justify-center text-muted-foreground"
                      aria-hidden="true"
                    >
                      <Mic className="size-3" />
                    </span>
                    <NativeSelect
                      id="chat-audio-input"
                      size="sm"
                      className="w-full **:data-[slot=native-select-icon]:right-2 **:data-[slot=native-select-icon]:size-3 **:data-[slot=native-select-icon]:text-muted-foreground [&_[data-slot=native-select]]:h-11 pointer-fine:[&_[data-slot=native-select]]:h-7 [&_[data-slot=native-select]]:rounded-md [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pr-7 [&_[data-slot=native-select]]:pl-7 [&_[data-slot=native-select]]:font-mono [&_[data-slot=native-select]]:text-muted-foreground [&_[data-slot=native-select]]:text-sm pointer-fine:[&_[data-slot=native-select]]:text-xs [&_[data-slot=native-select]]:transition-colors [&_[data-slot=native-select]]:hover:border-border [&_[data-slot=native-select]]:hover:bg-accent [&_[data-slot=native-select]]:hover:text-accent-foreground [&_[data-slot=native-select]]:focus-visible:border-brand/40 [&_[data-slot=native-select]]:focus-visible:ring-0"
                      value={selectedAudioInputId}
                      onChange={onAudioInputChange}
                      disabled={!canSelectAudioInput}
                      aria-label={t.audioInputLabel}
                    >
                      {audioInputOptions.map((option) => (
                        <NativeSelectOption
                          key={option.deviceId}
                          value={option.deviceId}
                        >
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                <TooltipButton
                  type="button"
                  onClick={onStartRecording}
                  disabled={isChatSubmitting}
                  label={t.startRecording}
                  variant="ghost"
                  size="icon"
                  className="pointer-fine:size-8 size-11 rounded-lg border border-transparent bg-transparent p-0 text-muted-foreground hover:border-brand/20 hover:bg-brand/12 hover:text-primary"
                >
                  <Mic className="size-4" />
                </TooltipButton>
                <TooltipButton
                  type="submit"
                  disabled={!canSendChatInput}
                  label={t.send}
                  size="icon"
                  className="pointer-fine:size-8 size-11 rounded-lg border border-brand/25 bg-primary p-0 text-primary-foreground shadow-brand/10 shadow-sm hover:bg-primary-hover hover:text-primary-foreground disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  <ArrowUp className="size-4" />
                </TooltipButton>
              </div>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}

type TooltipButtonProps = ComponentProps<typeof Button> & {
  label: string;
};

function TooltipButton({ label, ...props }: TooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} aria-label={label} />} />
      <TooltipContent className="border border-border font-mono text-xs shadow-lg">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function getChatDayLabel(
  createdAt: string,
  previousCreatedAt: string | undefined,
  locale: string,
): string | undefined {
  const day = new Date(createdAt).toDateString();
  if (previousCreatedAt && new Date(previousCreatedAt).toDateString() === day)
    return undefined;
  return new Date(createdAt).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
