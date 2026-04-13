import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioWaveform } from "~/components/AudioWaveform";
import { usePrefs } from "~/components/PrefsProvider";
import { getDictionary } from "~/i18n";
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
          navigate({ to: "/api/v1/web/auth/login" });
          return;
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
                type: "text",
                userType: "bot",
                text: event.data.text,
                createdAt: now,
              },
            ]);
          } else if (event.type === "interactive_button") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                type: "interactive",
                userType: "bot",
                text: event.data.text,
                buttonReplyOptions: event.data.buttons,
                createdAt: now,
              },
            ]);
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;
      setIsSending(true);
      setInput("");
      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        type: "text",
        userType: "user",
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
        type: "interactive",
        userType: "user",
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        const blob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        if (blob.size === 0) return;
        setIsSending(true);
        const optimistic: ChatMessage = {
          id: crypto.randomUUID(),
          type: "audio",
          userType: "user",
          text: t.audioSent,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        try {
          await fetch("/api/v1/web/audio", {
            method: "POST",
            headers: {
              "Content-Type": mediaRecorder.mimeType,
            },
            body: blob,
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
  }, [t.audioSent, t.errorSending, t.errorMicrophone]);

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
                {msg.userType === "user" ? t.you : t.bot}
              </div>
              <div className="chat-message-bubble">
                {msg.type === "audio" && msg.mediaUrl ? (
                  <div className="chat-audio-container">
                    <AudioWaveform src={msg.mediaUrl} theme={theme} />
                    {msg.transcript && (
                      <p className="chat-audio-transcript">{msg.transcript}</p>
                    )}
                  </div>
                ) : msg.type === "interactive" &&
                  msg.userType === "bot" &&
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
              <button
                type="button"
                className="chat-mic-btn"
                onClick={startRecording}
                disabled={isSending}
                title={t.startRecording}
              >
                <MicIcon />
              </button>
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!input.trim() || isSending}
                title={t.send}
              >
                <SendIcon />
              </button>
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
