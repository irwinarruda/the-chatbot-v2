import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioWaveform } from "~/client/components/AudioWaveform";
import { usePrefs } from "~/client/components/PrefsProvider";
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
import type {
  SharedChatMessage,
  SharedCurrentUser,
  WebChatEvent,
} from "~/shared/types/web-chat";

export function ChatPage() {
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

  // Auth check + load messages
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
        if (!cancelled) setError(t.errorLoading);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, t.errorLoading]);

  // Auto-scroll on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // SSE connection
  useEffect(() => {
    if (!user) return;
    const abortController = new AbortController();
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const eventSource = new EventSource("/api/v1/web/stream");
      eventSource.onopen = () => setSseConnected(true);
      eventSource.onmessage = (e) => {
        try {
          const event: WebChatEvent = JSON.parse(e.data);
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
              let idx = -1;
              for (let i = prev.length - 1; i >= 0; i--) {
                if (
                  prev[i].type === "audio" &&
                  prev[i].userType === "user" &&
                  !prev[i].transcript
                ) {
                  idx = i;
                  break;
                }
              }
              if (idx < 0) return prev;
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                mediaUrl: updated[idx].mediaUrl ?? event.data.mediaUrl,
                mimeType: updated[idx].mimeType ?? event.data.mimeType,
                transcript: event.data.transcript,
              };
              return updated;
            });
          }
        } catch {
          // ignore parse errors
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
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
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
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError(t.errorMicrophone);
    }
  }, [selectedAudioInputId, t.errorSending, t.errorMicrophone]);

  const handleAudioInputChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedAudioInputId(event.target.value);
    },
    [],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    setRecordingDuration(0);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleLogout = async () => {
    await fetch("/api/v1/web/auth/logout", { method: "POST" });
    navigate({ to: "/chat/login" });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasMessages = messages.length > 0;
  const shellClass = hasMessages
    ? "flex min-h-dvh items-stretch justify-center bg-term-bg sm:items-center sm:p-6 md:p-10"
    : "flex min-h-dvh items-start justify-center bg-term-bg sm:p-6 md:p-10";
  const frameClass = hasMessages
    ? "flex h-dvh w-full flex-col sm:h-[calc(100dvh-3rem)] sm:max-w-4xl md:h-[calc(100dvh-5rem)]"
    : "flex w-full flex-col sm:max-w-4xl";
  const bodyClass =
    "flex min-h-0 flex-1 flex-col overflow-hidden bg-term-window sm:rounded-b-xl sm:border sm:border-term-border sm:border-t-0 sm:shadow-2xl sm:shadow-black/10";

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
    <main className={shellClass}>
      <div className={frameClass}>
        {/* Chrome bar */}
        <div className="flex shrink-0 items-center gap-3 border-b-0 bg-term-chrome px-3 py-2 sm:rounded-t-xl sm:border sm:border-term-border sm:px-4">
          <div className="flex shrink-0 gap-2" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-term-red" />
            <span className="h-3 w-3 rounded-full bg-term-yellow" />
            <span className="h-3 w-3 rounded-full bg-term-green-dot" />
          </div>
          <span className="flex-1 truncate text-center text-xs tracking-wide text-term-muted">
            {t.windowTitle}
            {user ? ` — ${user.name}` : ""}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              title={sseConnected ? t.connected : t.disconnected}
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                sseConnected
                  ? "motion-safe:animate-glow-pulse bg-term-green-dot"
                  : "bg-term-muted"
              }`}
            />
            <ChromeBtn onClick={toggleLocale}>
              {locale === "pt-BR" ? "PT" : "EN"}
            </ChromeBtn>
            <ChromeBtn onClick={toggleTheme}>
              {theme === "light" ? "\u2600" : "\u263D"}
            </ChromeBtn>
            <Button
              type="button"
              onClick={handleLogout}
              title={t.logout}
              variant="ghost"
              size="xs"
              className="min-h-6 rounded border border-transparent px-1.5 py-0.5 text-[0.6875rem] leading-none text-term-red hover:border-term-red hover:bg-term-red/10 hover:text-term-red"
            >
              {t.logout}
            </Button>
          </div>
        </div>

        <div className={bodyClass}>
          {/* Error banner */}
          {error && (
            <Alert
              variant="destructive"
              className="shrink-0 rounded-none border-x-0 border-t-0 border-b border-term-red/25 bg-term-red/12 px-4 py-2"
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
          )}

          {/* Messages */}
          <div
            className={
              hasMessages
                ? "flex flex-1 flex-col gap-2 overflow-y-auto p-4 sm:p-5"
                : "flex min-h-[12rem] flex-col gap-2 p-4 sm:p-5"
            }
          >
            {messages.length === 0 && (
              <div className="flex flex-1 items-center justify-center text-sm text-term-muted">
                <span className="mr-1 font-semibold text-term-green">$</span>
                {t.emptyState}
                <span className="terminal-cursor" />
              </div>
            )}
            {messages.map((msg) => {
              const isUser = msg.userType === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex max-w-[85%] flex-col sm:max-w-[80%] ${
                    isUser ? "self-end" : "self-start"
                  }`}
                >
                  <div
                    className={`mb-0.5 px-0.5 text-2xs font-semibold uppercase tracking-wider ${
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
                    {msg.type === "audio" && msg.mediaUrl ? (
                      <div className="flex flex-col gap-2">
                        <AudioWaveform src={msg.mediaUrl} theme={theme} />
                        {msg.transcript && (
                          <div className="max-w-[280px] text-[0.8125rem] italic leading-snug text-term-muted">
                            <FormattedChatText text={msg.transcript} />
                          </div>
                        )}
                      </div>
                    ) : msg.type === "interactive" &&
                      msg.userType === "bot" &&
                      msg.buttonReplyOptions ? (
                      <div className="flex flex-col gap-2.5">
                        <FormattedChatText text={msg.text ?? ""} />
                        <div className="flex flex-wrap gap-1.5">
                          {msg.buttonReplyOptions.map((opt) => (
                            <Button
                              key={opt}
                              type="button"
                              onClick={() => sendButtonReply(opt)}
                              disabled={isSending}
                              variant="outline"
                              size="sm"
                              className="rounded-md border-term-blue/30 bg-term-blue/8 text-[0.8125rem] text-term-blue hover:border-term-cyan/40 hover:bg-term-cyan/10 hover:text-term-cyan"
                            >
                              {opt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <FormattedChatText
                        text={msg.buttonReply ?? msg.text ?? ""}
                      />
                    )}
                  </div>
                  <div
                    className={`mt-0.5 px-0.5 text-2xs text-term-muted ${
                      isUser ? "text-right" : "text-left"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
            <div ref={(node) => setMessagesEndEl(node ?? undefined)} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-term-border bg-gradient-to-b from-term-chrome to-term-chrome/80 px-4 py-3">
            {isRecording ? (
              <div className="flex items-center gap-2.5 py-1">
                <span className="motion-safe:animate-blink h-2 w-2 shrink-0 rounded-full bg-term-red" />
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
                {/* Meta row */}
                <div className="flex min-h-[18px] items-center justify-between gap-3 px-1 text-2xs text-term-muted opacity-75 transition-opacity duration-200 group-hover/form:opacity-100 group-focus-within/form:opacity-100">
                  <span className="hidden items-center gap-1.5 tracking-wide sm:inline-flex">
                    <span className="inline-block rounded border border-term-border bg-term-bg px-1.5 py-px text-[0.625rem] tracking-wider text-term-text">
                      enter
                    </span>
                    <span className="opacity-50">·</span>
                    <span>{t.send}</span>
                  </span>
                  <div
                    data-disabled={
                      audioInputOptions.length < 2 || isSending || isRecording
                    }
                    title={t.audioInputLabel}
                    className="relative w-full max-w-[220px] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  >
                    <span
                      className="pointer-events-none absolute top-1/2 left-2.5 z-10 inline-flex h-3 w-3 -translate-y-1/2 items-center justify-center text-term-muted"
                      aria-hidden="true"
                    >
                      <MicIcon size={11} />
                    </span>
                    <NativeSelect
                      size="sm"
                      className="w-full [&_[data-slot=native-select]]:h-6 [&_[data-slot=native-select]]:rounded [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:py-0.5 [&_[data-slot=native-select]]:pr-7 [&_[data-slot=native-select]]:pl-7 [&_[data-slot=native-select]]:text-2xs [&_[data-slot=native-select]]:text-term-muted [&_[data-slot=native-select]]:transition-colors [&_[data-slot=native-select]]:hover:border-term-amber/25 [&_[data-slot=native-select]]:hover:bg-term-amber/8 [&_[data-slot=native-select]]:hover:text-term-amber [&_[data-slot=native-select]]:focus-visible:border-term-amber/40 [&_[data-slot=native-select]]:focus-visible:ring-0 [&_[data-slot=native-select-icon]]:right-2 [&_[data-slot=native-select-icon]]:size-3 [&_[data-slot=native-select-icon]]:text-term-muted"
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

                {/* Input shell */}
                <div
                  data-disabled={isSending || undefined}
                  className="flex items-stretch gap-0 rounded-lg border border-term-border bg-term-bg pl-3.5 pr-1.5 transition-all duration-200 focus-within:border-term-green focus-within:shadow-[0_0_0_3px_rgba(80,223,170,0.12)] data-[disabled]:opacity-70"
                >
                  <span
                    className="mr-3 inline-flex select-none items-center font-mono text-base font-semibold leading-none text-term-green"
                    style={{ textShadow: "0 0 8px rgba(80,223,170,0.35)" }}
                  >
                    {">"}
                  </span>
                  <Input
                    ref={(node) => setInputEl(node ?? undefined)}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t.placeholder}
                    disabled={isSending}
                    autoComplete="off"
                    className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-1.5 py-2.5 font-mono text-sm text-term-text caret-term-green shadow-none ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-term-muted/70 disabled:cursor-not-allowed disabled:bg-transparent"
                  />
                  <div className="inline-flex shrink-0 items-center gap-0.5 py-1 ml-1.5">
                    <Button
                      type="button"
                      onClick={startRecording}
                      disabled={isSending}
                      title={t.startRecording}
                      aria-label={t.startRecording}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md border-0 bg-transparent p-0 text-term-muted hover:bg-term-amber/10 dark:hover:bg-term-amber/10 hover:text-term-amber"
                    >
                      <MicIcon />
                    </Button>
                    <Button
                      type="submit"
                      disabled={!input.trim() || isSending}
                      title={t.send}
                      aria-label={t.send}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md border-0 bg-transparent p-0 text-term-muted enabled:text-term-green hover:bg-term-green/10 dark:hover:bg-term-green/10 hover:text-term-green"
                    >
                      <SendIcon />
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        <div
          className="mx-4 hidden h-2 rounded-b-xl bg-black/20 blur-sm sm:block"
          aria-hidden="true"
        />
      </div>
    </main>
  );
}

function ChromeBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      size="xs"
      className="min-h-6 rounded border border-transparent px-1.5 py-0.5 text-[0.6875rem] leading-none text-term-muted hover:border-term-border hover:bg-term-bg hover:text-term-bright"
    >
      {children}
    </Button>
  );
}

function FormattedChatText({ text }: { text: string }) {
  const { blocks } = WhatsAppMessageParser.parse(text);
  const getBlockKey = createSiblingKeyFactory();

  if (blocks.length === 0) {
    return (
      <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-term-text" />
    );
  }

  return (
    <div className="flex flex-col gap-2 break-words text-sm leading-relaxed text-term-text">
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
        <ul className="m-0 space-y-1 pl-5 marker:text-term-green/80">
          {block.items.map((item) => (
            <li key={getBulletKey(serializeInlineNodes(item))} className="pl-1">
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
        <blockquote className="m-0 rounded-r-md border-l-2 border-term-cyan/45 bg-term-cyan/8 px-3 py-2 text-term-text/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
        <em className="italic text-term-text/95">
          <InlineNodes nodes={node.children} />
        </em>
      );
    case "strikethrough":
      return (
        <span className="text-term-muted line-through decoration-term-red/60 decoration-2">
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

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="1" width="6" height="14" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="21" x2="12" y2="17" />
    </svg>
  );
}
