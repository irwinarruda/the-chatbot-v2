import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioWaveform } from "~/components/AudioWaveform";
import { usePrefs } from "~/components/PrefsProvider";
import { getDictionary } from "~/i18n";
import {
  type AudioInputOption,
  getStoredAudioInputDeviceId,
  listAudioInputOptions,
  resolveSelectedAudioInput,
  storeAudioInputDeviceId,
} from "~/utils/audioInputDevices";
import {
  createRecordedAudioBlob,
  pickSupportedRecordingMimeType,
} from "~/utils/webAudioRecording";
import "./ChatPage.css";

interface ChatMessage {
  id: string;
  type: string;
  userType: string;
  text?: string;
  buttonReply?: string;
  buttonReplyOptions?: string[];
  mediaUrl?: string;
  mimeType?: string;
  transcript?: string;
  createdAt: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
}

interface WebChatEvent {
  type: "text" | "interactive_button" | "audio" | "error";
  data: {
    to?: string;
    text?: string;
    buttons?: string[];
    mediaUrl?: string;
    mimeType?: string;
    transcript?: string;
  };
}

export function ChatPage() {
  const { locale, theme, toggleTheme, toggleLocale } = usePrefs();
  const dictionary = getDictionary(locale);
  const t = dictionary.chatPage;
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auth check + load messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/web/auth/me");
        if (!res.ok) {
          throw new Error("Authentication required");
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          navigate({ to: "/chat/not-registered" });
          return;
        }
        setUser(data);

        const msgRes = await fetch("/api/v1/web/messages");
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const mapped: ChatMessage[] = (msgData.messages ?? []).map(
            (m: Record<string, unknown>) => ({
              id: m.id,
              type: m.type,
              userType: m.user_type,
              text: m.text,
              buttonReply: m.button_reply,
              buttonReplyOptions: m.button_reply_options,
              mediaUrl: m.media_url,
              mimeType: m.mime_type,
              transcript: m.transcript,
              createdAt: m.created_at,
            }),
          );
          if (!cancelled) setMessages(mapped);
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
              {
                id: crypto.randomUUID(),
                type: "Text",
                userType: "Bot",
                text: event.data.text,
                createdAt: now,
              },
            ]);
          } else if (event.type === "interactive_button") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                type: "Interactive",
                userType: "Bot",
                text: event.data.text,
                buttonReplyOptions: event.data.buttons,
                createdAt: now,
              },
            ]);
          } else if (event.type === "audio") {
            setMessages((prev) => {
              let idx = -1;
              for (let i = prev.length - 1; i >= 0; i--) {
                if (
                  prev[i].type === "Audio" &&
                  prev[i].userType === "User" &&
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

      const audioInputs = listAudioInputOptions(devices);
      setAudioInputOptions(audioInputs);
      setSelectedAudioInputId((current) => {
        const storedDeviceId = getStoredAudioInputDeviceId(window.localStorage);
        return resolveSelectedAudioInput(
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
    storeAudioInputDeviceId(window.localStorage, selectedAudioInputId);
  }, [selectedAudioInputId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;
      setIsSending(true);
      setInput("");
      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        type: "Text",
        userType: "User",
        text: text.trim(),
        createdAt: new Date().toISOString(),
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
        inputRef.current?.focus();
      }
    },
    [isSending, t.errorSending],
  );

  const sendButtonReply = useCallback(
    async (buttonText: string) => {
      if (isSending) return;
      setIsSending(true);
      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        type: "Interactive",
        userType: "User",
        buttonReply: buttonText,
        createdAt: new Date().toISOString(),
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
      const audioInputs = listAudioInputOptions(devices);
      setAudioInputOptions(audioInputs);
      setSelectedAudioInputId((current) =>
        resolveSelectedAudioInput(audioInputs, current || selectedAudioInputId),
      );

      const recordingMimeType = pickSupportedRecordingMimeType(
        MediaRecorder.isTypeSupported.bind(MediaRecorder),
      );
      const mediaRecorder =
        recordingMimeType != null
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
        const recordedBlob = createRecordedAudioBlob(
          audioChunksRef.current,
          mediaRecorder.mimeType,
        );

        if (recordedBlob.size === 0) {
          setError(t.errorSending);
          return;
        }

        setIsSending(true);
        const localAudioUrl = URL.createObjectURL(recordedBlob);
        const optimistic: ChatMessage = {
          id: crypto.randomUUID(),
          type: "Audio",
          userType: "User",
          mediaUrl: localAudioUrl,
          mimeType: recordedBlob.type,
          createdAt: new Date().toISOString(),
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

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleLogout = async () => {
    await fetch("/api/v1/web/auth/logout", { method: "POST" });
    navigate({ to: "/" });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <main className="chat-shell">
        <div className="chat-window">
          <div className="chat-loading">
            <span className="chat-loading-cursor" />
            <span>{t.loading}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-shell">
      <div className="chat-window">
        {/* Chrome bar */}
        <div className="chat-chrome">
          <div className="terminal-dots">
            <span className="terminal-dot terminal-dot--close" />
            <span className="terminal-dot terminal-dot--minimize" />
            <span className="terminal-dot terminal-dot--maximize" />
          </div>
          <span className="chat-chrome-title">
            {t.windowTitle}
            {user ? ` — ${user.name}` : ""}
          </span>
          <div className="chat-chrome-actions">
            <span
              className={`chat-status-dot${sseConnected ? " chat-status-dot--online" : ""}`}
              title={sseConnected ? t.connected : t.disconnected}
            />
            <button
              type="button"
              className="terminal-chrome-btn"
              onClick={toggleLocale}
            >
              {locale === "pt-BR" ? "PT" : "EN"}
            </button>
            <button
              type="button"
              className="terminal-chrome-btn"
              onClick={toggleTheme}
            >
              {theme === "light" ? "\u2600" : "\u263D"}
            </button>
            <button
              type="button"
              className="terminal-chrome-btn chat-logout-btn"
              onClick={handleLogout}
              title={t.logout}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="chat-error">
            <span>{error}</span>
            <button
              type="button"
              className="chat-error-dismiss"
              onClick={() => setError(null)}
            >
              x
            </button>
          </div>
        )}

        {/* Messages area */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-prompt">$</span> {t.emptyState}
              <span className="terminal-cursor" />
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message chat-message--${msg.userType}`}
            >
              <div className="chat-message-label">
                {msg.userType === "User" ? t.you : t.bot}
              </div>
              <div className="chat-message-bubble">
                {msg.type === "Audio" && msg.mediaUrl ? (
                  <div className="chat-audio-container">
                    <AudioWaveform src={msg.mediaUrl} theme={theme} />
                    {msg.transcript && (
                      <p className="chat-audio-transcript">{msg.transcript}</p>
                    )}
                  </div>
                ) : msg.type === "Interactive" &&
                  msg.userType === "Bot" &&
                  msg.buttonReplyOptions ? (
                  <div className="chat-button-reply">
                    <p className="chat-message-text">{msg.text}</p>
                    <div className="chat-button-options">
                      {msg.buttonReplyOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="chat-button-option"
                          onClick={() => sendButtonReply(opt)}
                          disabled={isSending}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="chat-message-text">
                    {msg.buttonReply ?? msg.text ?? ""}
                  </p>
                )}
              </div>
              <div className="chat-message-time">
                {new Date(msg.createdAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="chat-input-area">
          {isRecording ? (
            <div className="chat-recording">
              <span className="chat-recording-dot" />
              <span className="chat-recording-time">
                {t.recording} {formatTime(recordingDuration)}
              </span>
              <button
                type="button"
                className="chat-stop-btn"
                onClick={stopRecording}
                title={t.stopRecording}
              >
                {t.stopRecording}
              </button>
            </div>
          ) : (
            <form className="chat-form" onSubmit={handleSubmit}>
              <div className="chat-form-meta">
                <span className="chat-form-meta-hint">
                  <span className="chat-form-meta-key">enter</span>
                  <span className="chat-form-meta-sep">·</span>
                  <span>{t.send}</span>
                </span>
                <label
                  className="chat-device-chip"
                  data-disabled={
                    audioInputOptions.length < 2 || isSending || isRecording
                  }
                  title={t.audioInputLabel}
                >
                  <span className="chat-device-chip-icon" aria-hidden="true">
                    <MicIcon />
                  </span>
                  <span className="chat-device-chip-label">
                    {audioInputOptions.find(
                      (o) => o.deviceId === selectedAudioInputId,
                    )?.label ?? t.audioInputUnavailable}
                  </span>
                  <ChevronIcon />
                  <select
                    className="chat-device-chip-select"
                    value={selectedAudioInputId}
                    onChange={handleAudioInputChange}
                    disabled={
                      isSending || isRecording || audioInputOptions.length < 2
                    }
                    aria-label={t.audioInputLabel}
                  >
                    {audioInputOptions.length === 0 ? (
                      <option value="">{t.audioInputUnavailable}</option>
                    ) : (
                      audioInputOptions.map((option) => (
                        <option key={option.deviceId} value={option.deviceId}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
              <div
                className="chat-input-shell"
                data-focused={undefined}
                data-disabled={isSending || undefined}
              >
                <span className="chat-input-prompt">{">"}</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.placeholder}
                  disabled={isSending}
                  autoComplete="off"
                />
                <div className="chat-input-actions">
                  <button
                    type="button"
                    className="chat-mic-btn"
                    onClick={startRecording}
                    disabled={isSending}
                    title={t.startRecording}
                    aria-label={t.startRecording}
                  >
                    <MicIcon />
                  </button>
                  <span className="chat-input-divider" aria-hidden="true" />
                  <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!input.trim() || isSending}
                    title={t.send}
                    aria-label={t.send}
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
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

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function MicIcon() {
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
      <rect x="9" y="1" width="6" height="14" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="21" x2="12" y2="17" />
    </svg>
  );
}
