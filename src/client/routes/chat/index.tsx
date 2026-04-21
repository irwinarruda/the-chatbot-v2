import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Mic, Send } from "lucide-react";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AudioWaveform } from "~/client/components/AudioWaveform";
import { usePrefs } from "~/client/components/PrefsProvider";
import { TerminalChromeButton } from "~/client/components/TerminalChromeButton";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { Alert, AlertDescription } from "~/client/components/ui/alert";
import { Button } from "~/client/components/ui/button";
import { Input } from "~/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/client/components/ui/native-select";
import { getDictionary } from "~/client/i18n";
import {
  AudioInputDevices,
  type AudioInputOption,
} from "~/client/utils/AudioInputDevices";
import { WebAudioRecording } from "~/client/utils/WebAudioRecording";
import { WebChatApi } from "~/client/utils/WebChatApi";
import {
  type WhatsAppBlockNode,
  type WhatsAppInlineNode,
  WhatsAppMessageParser,
} from "~/client/utils/WhatsAppMessageParser";
import { requireChatAccess } from "~/server/tanstack/functions/require-chat-access";
import type {
  SharedChatMessage,
  SharedCurrentUser,
  WebChatEvent,
} from "~/shared/types/web-chat";

export const Route = createFileRoute("/chat/")({
  beforeLoad: async () => {
    const authResult = await requireChatAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/chat/login",
      });
    }
  },
  component: ChatRoute,
  head: () => ({
    meta: [{ title: "Chat - The Chatbot" }],
  }),
});

function ChatRoute() {
  const { locale, theme, toggleTheme, toggleLocale } = usePrefs();
  const dictionary = getDictionary(locale);
  const t = dictionary.chatPage;
  const navigate = useNavigate();
  const [user, setUser] = useState<SharedCurrentUser | undefined>(undefined);
  const [messages, setMessages] = useState<SharedChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);
  const [audioInputOptions, setAudioInputOptions] = useState<
    AudioInputOption[]
  >([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [messagesEndEl, setMessagesEndEl] = useState<
    HTMLDivElement | undefined
  >(undefined);
  const [inputEl, setInputEl] = useState<HTMLInputElement | undefined>(
    undefined,
  );
  const mediaRecorderRef = useRef<MediaRecorder | undefined>(undefined);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const scrollToBottom = useCallback(() => {
    messagesEndEl?.scrollIntoView({ behavior: "smooth" });
  }, [messagesEndEl]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/web/auth/me");
        if (!res.ok) {
          if (res.status === 401) {
            navigate({ to: "/chat/login" });
            return;
          }
          throw new Error("Authentication required");
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.error) {
          navigate({ to: "/chat/not-registered" });
          return;
        }

        setUser(WebChatApi.parseCurrentUserResponse(data));

        const msgRes = await fetch("/api/v1/web/messages");
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          if (!cancelled) {
            setMessages(WebChatApi.parseWebMessagesResponse(msgData));
          }
        }
      } catch {
        if (!cancelled) {
          setError(t.errorLoading);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, t.errorLoading]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!user) return;

    const abortController = new AbortController();
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const eventSource = new EventSource("/api/v1/web/stream");

      eventSource.onopen = () => setSseConnected(true);
      eventSource.onmessage = (eventMessage) => {
        try {
          const event: WebChatEvent = JSON.parse(eventMessage.data);
          const now = new Date().toISOString();

          if (event.type === "text") {
            setMessages((prev) => [
              ...prev,
              createChatMessage({
                id: crypto.randomUUID(),
                type: "text",
                userType: "bot",
                text: event.data.text,
                createdAt: now,
              }),
            ]);
          } else if (event.type === "interactive_button") {
            setMessages((prev) => [
              ...prev,
              createChatMessage({
                id: crypto.randomUUID(),
                type: "interactive",
                userType: "bot",
                text: event.data.text,
                buttonReplyOptions: event.data.buttons,
                createdAt: now,
              }),
            ]);
          } else if (event.type === "audio") {
            setMessages((prev) => {
              let pendingAudioIndex = -1;

              for (let i = prev.length - 1; i >= 0; i--) {
                if (
                  prev[i].type === "audio" &&
                  prev[i].userType === "user" &&
                  !prev[i].transcript
                ) {
                  pendingAudioIndex = i;
                  break;
                }
              }

              if (pendingAudioIndex < 0) {
                return prev;
              }

              const updated = [...prev];
              updated[pendingAudioIndex] = {
                ...updated[pendingAudioIndex],
                mediaUrl:
                  updated[pendingAudioIndex].mediaUrl ?? event.data.mediaUrl,
                mimeType:
                  updated[pendingAudioIndex].mimeType ?? event.data.mimeType,
                transcript: event.data.transcript,
              };
              return updated;
            });
          }
        } catch {
          // Ignore malformed event payloads.
        }
      };
      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource.close();
        retryTimeout = setTimeout(connect, 3000);
      };
      abortController.signal.addEventListener("abort", () => {
        eventSource.close();
      });
    }

    connect();

    return () => {
      abortController.abort();
      clearTimeout(retryTimeout);
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const syncAudioInputs = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

      const devices = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;

      const audioInputs = AudioInputDevices.listOptions(devices);
      setAudioInputOptions(audioInputs);
      setSelectedAudioInputId((current) => {
        const storedDeviceId = AudioInputDevices.getStoredDeviceId({
          getItem: (key) => window.localStorage.getItem(key) ?? undefined,
        });

        return AudioInputDevices.resolveSelected(
          audioInputs,
          current || storedDeviceId || undefined,
        );
      });
    };

    void syncAudioInputs();

    const handleDeviceChange = () => {
      void syncAudioInputs();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedAudioInputId) return;
    AudioInputDevices.storeDeviceId(window.localStorage, selectedAudioInputId);
  }, [selectedAudioInputId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;

      setIsSending(true);
      setInput("");

      const optimistic: SharedChatMessage = {
        ...createChatMessage({
          id: crypto.randomUUID(),
          type: "text",
          userType: "user",
          text: text.trim(),
          createdAt: new Date().toISOString(),
        }),
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        await fetch("/api/v1/web/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      } catch {
        setError(t.errorSending);
      } finally {
        setIsSending(false);
        inputEl?.focus();
      }
    },
    [inputEl, isSending, t.errorSending],
  );

  const sendButtonReply = useCallback(
    async (buttonText: string) => {
      if (isSending) return;

      setIsSending(true);

      const optimistic: SharedChatMessage = {
        ...createChatMessage({
          id: crypto.randomUUID(),
          type: "interactive",
          userType: "user",
          buttonReply: buttonText,
          createdAt: new Date().toISOString(),
        }),
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        await fetch("/api/v1/web/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buttonReply: buttonText }),
        });
      } catch {
        setError(t.errorSending);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, t.errorSending],
  );

  const startRecording = useCallback(async () => {
    try {
      const audioConstraint = selectedAudioInputId
        ? {
            deviceId: { exact: selectedAudioInputId },
          }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraint,
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = AudioInputDevices.listOptions(devices);
      setAudioInputOptions(audioInputs);
      setSelectedAudioInputId((current) =>
        AudioInputDevices.resolveSelected(
          audioInputs,
          current || selectedAudioInputId,
        ),
      );

      const recordingMimeType = WebAudioRecording.pickSupportedMimeType(
        MediaRecorder.isTypeSupported.bind(MediaRecorder),
      );
      const mediaRecorder =
        recordingMimeType !== undefined
          ? new MediaRecorder(stream, { mimeType: recordingMimeType })
          : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        const recordedBlob = WebAudioRecording.createRecordedBlob(
          audioChunksRef.current,
          mediaRecorder.mimeType,
        );

        if (recordedBlob.size === 0) {
          setError(t.errorSending);
          return;
        }

        setIsSending(true);

        const localAudioUrl = URL.createObjectURL(recordedBlob);
        const optimistic: SharedChatMessage = {
          ...createChatMessage({
            id: crypto.randomUUID(),
            type: "audio",
            userType: "user",
            mediaUrl: localAudioUrl,
            mimeType: recordedBlob.type,
            createdAt: new Date().toISOString(),
          }),
        };

        setMessages((prev) => [...prev, optimistic]);

        try {
          await fetch("/api/v1/web/audio", {
            method: "POST",
            headers: {
              "Content-Type": recordedBlob.type,
            },
            body: recordedBlob,
          });
        } catch {
          setError(t.errorSending);
        } finally {
          setIsSending(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((duration) => duration + 1);
      }, 1000);
    } catch {
      setError(t.errorMicrophone);
    }
  }, [selectedAudioInputId, t.errorSending, t.errorMicrophone]);

  const handleAudioInputChange = useCallback<
    NonNullable<ComponentProps<"select">["onChange"]>
  >((event) => {
    setSelectedAudioInputId(event.target.value);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    setRecordingDuration(0);
  }, []);

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = (
    event,
  ) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleLogout = async () => {
    await fetch("/api/v1/web/auth/logout", { method: "POST" });
    navigate({ to: "/chat/login" });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const hasMessages = messages.length > 0;
  const mainClassName = hasMessages
    ? "items-stretch sm:items-center"
    : undefined;
  const frameClassName = hasMessages
    ? "h-dvh sm:h-[calc(100dvh-3rem)] md:h-[calc(100dvh-5rem)]"
    : undefined;
  const windowClassName = [
    "flex min-h-0 flex-1 flex-col overflow-hidden",
    "p-0 sm:p-0 md:p-0",
  ].join(" ");
  const windowTitle = user ? `${t.windowTitle} - ${user.name}` : t.windowTitle;

  if (isLoading) {
    return (
      <main className="flex min-h-dvh w-full items-stretch bg-term-bg">
        <div className="flex h-dvh w-full flex-col">
          <div className="flex flex-1 items-center justify-center gap-2 bg-term-window text-sm text-term-muted">
            <span className="terminal-cursor" />
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
      showNavigation={false}
      chromeControls={
        <>
          <span
            title={sseConnected ? t.connected : t.disconnected}
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
              sseConnected
                ? "bg-term-green-dot motion-safe:animate-glow-pulse"
                : "bg-term-muted"
            }`}
          />
          <TerminalChromeButton onClick={toggleLocale} title={locale}>
            {locale === "pt-BR" ? "PT" : "EN"}
          </TerminalChromeButton>
          <TerminalChromeButton
            onClick={toggleTheme}
            title={theme === "light" ? "dark" : "light"}
          >
            {theme === "light" ? "\u2600" : "\u263D"}
          </TerminalChromeButton>
          <Button
            type="button"
            onClick={handleLogout}
            title={t.logout}
            variant="ghost"
            size="xs"
            className="min-h-6 rounded border border-transparent px-1.5 py-0.5 text-[0.6875rem] text-term-red leading-none hover:border-term-red hover:bg-term-red/10 hover:text-term-red"
          >
            {t.logout}
          </Button>
        </>
      }
      mainClassName={mainClassName}
      frameClassName={frameClassName}
      windowClassName={windowClassName}
    >
      {error ? (
        <Alert
          variant="destructive"
          className="shrink-0 rounded-none border-term-red/25 border-x-0 border-t-0 border-b bg-term-red/12 px-4 py-2"
        >
          <AlertDescription className="flex items-center justify-between gap-3 text-[0.8125rem] text-term-red [&_p:not(:last-child)]:mb-0">
            <span>{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setError(undefined)}
              className="size-6 rounded border-0 p-0 text-term-red hover:bg-term-red/10 hover:text-term-red"
            >
              ×
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={
          hasMessages
            ? "flex flex-1 flex-col gap-2 overflow-y-auto p-4 sm:p-5"
            : "flex min-h-48 flex-col gap-2 p-4 sm:p-5"
        }
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-term-muted">
            <span className="mr-1 font-semibold text-term-green">$</span>
            {t.emptyState}
            <span className="terminal-cursor" />
          </div>
        ) : null}

        {messages.map((message) => {
          const isUser = message.userType === "user";

          return (
            <div
              key={message.id}
              className={`flex max-w-[85%] flex-col sm:max-w-[80%] ${
                isUser ? "self-end" : "self-start"
              }`}
            >
              <div
                className={`mb-0.5 px-0.5 font-semibold text-2xs uppercase tracking-wider ${
                  isUser
                    ? "text-right text-term-cyan"
                    : "text-left text-term-green"
                }`}
              >
                {isUser ? t.you : t.bot}
              </div>
              <div
                className={`rounded-lg border px-3.5 py-2.5 ${
                  isUser
                    ? "border-term-green/20 bg-term-green/8"
                    : "border-term-border bg-term-bg"
                }`}
              >
                {message.type === "audio" && message.mediaUrl ? (
                  <div className="flex flex-col gap-2">
                    <AudioWaveform src={message.mediaUrl} theme={theme} />
                    {message.transcript ? (
                      <div className="max-w-70 text-[0.8125rem] text-term-muted italic leading-snug">
                        <FormattedChatText text={message.transcript} />
                      </div>
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
                            void sendButtonReply(option);
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
                  <FormattedChatText
                    text={message.buttonReply ?? message.text ?? ""}
                  />
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
        })}

        <div ref={(node) => setMessagesEndEl(node ?? undefined)} />
      </div>

      <div className="shrink-0 border-term-border border-t bg-linear-to-b from-term-chrome to-term-chrome/80 px-4 py-3">
        {isRecording ? (
          <div className="flex items-center gap-2.5 py-1">
            <span className="h-2 w-2 shrink-0 rounded-full bg-term-red motion-safe:animate-blink" />
            <span className="flex-1 text-sm text-term-red">
              {t.recording} {formatTime(recordingDuration)}
            </span>
            <Button
              type="button"
              onClick={stopRecording}
              title={t.stopRecording}
              variant="destructive"
              size="sm"
              className="rounded-md border border-term-red/40 bg-term-red/8 px-3.5 py-1.5 text-[0.8125rem] text-term-red hover:border-term-red/60 hover:bg-term-red/15 hover:text-term-red"
            >
              {t.stopRecording}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="group/form flex flex-col gap-1.5"
          >
            <div className="flex min-h-4.5 items-center justify-between gap-3 px-1 text-2xs text-term-muted opacity-75 transition-opacity duration-200 group-focus-within/form:opacity-100 group-hover/form:opacity-100">
              <span className="hidden items-center gap-1.5 tracking-wide sm:inline-flex">
                <span className="inline-block rounded border border-term-border bg-term-bg px-1.5 py-px text-[0.625rem] text-term-text tracking-wider">
                  enter
                </span>
                <span className="opacity-50">.</span>
                <span>{t.send}</span>
              </span>
              <div
                data-disabled={
                  audioInputOptions.length < 2 || isSending || isRecording
                }
                title={t.audioInputLabel}
                className="relative w-full max-w-55 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
              >
                <span
                  className="pointer-events-none absolute top-1/2 left-2.5 z-10 inline-flex h-3 w-3 -translate-y-1/2 items-center justify-center text-term-muted"
                  aria-hidden="true"
                >
                  <Mic className="size-3" />
                </span>
                <NativeSelect
                  size="sm"
                  className="w-full **:data-[slot=native-select-icon]:right-2 **:data-[slot=native-select-icon]:size-3 **:data-[slot=native-select]:h-6 **:data-[slot=native-select-icon]:text-term-muted [&_[data-slot=native-select]]:rounded [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pr-7 [&_[data-slot=native-select]]:pl-7 [&_[data-slot=native-select]]:text-2xs [&_[data-slot=native-select]]:text-term-muted [&_[data-slot=native-select]]:transition-colors [&_[data-slot=native-select]]:hover:border-term-amber/25 [&_[data-slot=native-select]]:hover:bg-term-amber/8 [&_[data-slot=native-select]]:hover:text-term-amber [&_[data-slot=native-select]]:focus-visible:border-term-amber/40 [&_[data-slot=native-select]]:focus-visible:ring-0"
                  value={selectedAudioInputId}
                  onChange={handleAudioInputChange}
                  disabled={
                    isSending || isRecording || audioInputOptions.length < 2
                  }
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
            </div>

            <div
              data-disabled={isSending || undefined}
              className="flex items-stretch gap-0 rounded-lg border border-term-border bg-term-bg pr-1.5 pl-3.5 transition-all duration-200 focus-within:border-term-green focus-within:shadow-[0_0_0_3px_rgba(80,223,170,0.12)] data-disabled:opacity-70"
            >
              <span
                className="mr-3 inline-flex select-none items-center font-mono font-semibold text-base text-term-green leading-none"
                style={{ textShadow: "0 0 8px rgba(80,223,170,0.35)" }}
              >
                {">"}
              </span>
              <Input
                ref={(node) => setInputEl(node ?? undefined)}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t.placeholder}
                disabled={isSending}
                autoComplete="off"
                className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-1.5 py-2.5 font-mono text-sm text-term-text caret-term-green shadow-none ring-0 placeholder:text-term-muted/70 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent"
              />
              <div className="ml-1.5 inline-flex shrink-0 items-center gap-0.5 py-1">
                <Button
                  type="button"
                  onClick={() => {
                    void startRecording();
                  }}
                  disabled={isSending}
                  title={t.startRecording}
                  aria-label={t.startRecording}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md border-0 bg-transparent p-0 text-term-muted hover:bg-term-amber/10 hover:text-term-amber dark:hover:bg-term-amber/10"
                >
                  <Mic className="size-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  title={t.send}
                  aria-label={t.send}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md border-0 bg-transparent p-0 text-term-muted hover:bg-term-green/10 hover:text-term-green enabled:text-term-green dark:hover:bg-term-green/10"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </TerminalWindow>
  );
}

function FormattedChatText({ text }: { text: string }) {
  const { blocks } = WhatsAppMessageParser.parse(text);
  const getBlockKey = createSiblingKeyFactory();

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

function createChatMessage(
  message: Pick<SharedChatMessage, "id" | "type" | "userType" | "createdAt"> &
    Partial<SharedChatMessage>,
): SharedChatMessage {
  return {
    id: message.id,
    type: message.type,
    userType: message.userType,
    text: message.text,
    buttonReply: message.buttonReply,
    buttonReplyOptions: message.buttonReplyOptions,
    mediaUrl: message.mediaUrl,
    mimeType: message.mimeType,
    transcript: message.transcript,
    createdAt: message.createdAt,
  };
}
