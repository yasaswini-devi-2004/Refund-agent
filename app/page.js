"use client";
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import StopIcon from '@mui/icons-material/Stop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

function newSessionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const SUGGESTIONS = [
  {
    label: "Standard refund",
    text: "Hi, I'm sneha.iyer@example.com. I'd like a refund for order ORD1003, I just don't want it anymore.",
  },
  {
    label: "Non-refundable item",
    text: "Hi, I'm karthik.s@example.com. Can I get a refund on my eBook order ORD1004?",
  },
  {
    label: "Defective item",
    text: "Hi, I'm rahul.verma@example.com. My gaming mouse from order ORD1012 arrived broken.",
  },
  {
    label: "Past the window",
    text: "Hi, I'm siddharth.rao@example.com. I'd like to return my earbuds, order ORD1014 — just changed my mind.",
  },
];

export default function ChatPage() {
  const [directory, setDirectory] = useState([]);
  const [showSamples, setShowSamples] = useState(false);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    setSessionId(newSessionId());
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => setDirectory(data.customers || []));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Lightweight, dependency-free voice layer using the browser's built-in
  // Web Speech API: SpeechRecognition for mic input, SpeechSynthesis for
  // spoken replies. No API keys, no extra services — works in Chrome/Edge
  // out of the box. For production you'd swap this for the OpenAI Realtime
  // API or LiveKit; see README for that upgrade path.
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setVoiceSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      send(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }

  function speak(text) {
  console.log("speak called");
  console.log("voiceOn =", voiceOn);
  console.log("text =", text);

  if (!voiceOn) {
    console.log("Voice disabled");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.onstart = () => {
    console.log("Started speaking");
  };

  utterance.onend = () => {
    console.log("Finished speaking");
  };

  utterance.onerror = (e) => {
    console.log("Speech Error:", e);
  };

  window.speechSynthesis.speak(utterance);
}

  function startNewConversation() {
    setMessages([]);
    setSessionId(newSessionId());
    setInput("");
  }

  async function send(text) {
    const userMessage = (text ?? input).trim();
    if (!userMessage || sending) return;

    const nextMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          conversationHistory: messages,
          userMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages([...nextMessages, { role: "assistant", content: data.error || "Something went wrong." }]);
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
        speak(data.reply);
      }
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "Network error — is the dev server running?" }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send();
  }

  function fillFromSample(c) {
    setInput(`Hi, I'm ${c.email}. I'd like to ask about order ${c.sampleOrderId}.`);
    setShowSamples(false);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>RD</span>
          <span className="mono">RefundDesk</span>
        </div>
        <div className={styles.topbarActions}>
          <button className={styles.newChatBtn} onClick={startNewConversation}>
            New conversation
          </button>
          <a href="/dashboard" className={styles.dashboardLink}>
            Admin ledger →
          </a>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.chatPane}>
          <div className={styles.thread} ref={scrollRef}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <p>
                  No messages yet. Tell the agent your account email and what happened —
                  it'll look everything else up itself.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s.label} className={styles.chip} onClick={() => send(s.text)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.bubbleRow} ${m.role === "user" ? styles.rowUser : styles.rowAgent}`}
              >
                <div className={`${styles.bubble} ${m.role === "user" ? styles.bubbleUser : styles.bubbleAgent}`}>
                  {m.role === "assistant" && <div className={styles.bubbleLabel}>RefundBot</div>}
                  <div className={styles.bubbleText}>{m.content}</div>
                </div>
              </div>
            ))}

            {sending && (
              <div className={`${styles.bubbleRow} ${styles.rowAgent}`}>
                <div className={`${styles.bubble} ${styles.bubbleAgent}`}>
                  <div className={styles.bubbleLabel}>RefundBot</div>
                  <div className={styles.typing}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.sampleWrap}>
            <button className={styles.sampleToggle} onClick={() => setShowSamples((v) => !v)}>
              {showSamples ? "Hide sample test accounts" : "Need a test account? View sample data"}
            </button>
            {showSamples && (
              <div className={styles.samplePanel}>
                <p className={styles.sampleHint}>
                  Click one to drop it into the input — these are mock CRM records, not a login.
                </p>
                <div className={styles.sampleGrid}>
                  {directory.map((c) => (
                    <button key={c.id} className={styles.sampleRow} onClick={() => fillFromSample(c)}>
                      <span className={styles.sampleName}>{c.name}</span>
                      <span className={styles.sampleMeta}>
                        {c.email} · {c.sampleOrderId}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form className={styles.inputRow} onSubmit={handleSubmit}>
            {voiceSupported && (
              <button
                type="button"
                className={`${styles.micBtn} ${listening ? styles.micActive : ""}`}
                onClick={toggleListening}
                title={listening ? "Stop listening" : "Speak your message"}
                aria-label="Toggle voice input"
              >
                {listening ? <StopIcon /> : <KeyboardVoiceIcon />}
              </button>
            )}
            <input
              ref={inputRef}
              className={styles.input}
              placeholder={listening ? "Listening…" : "Tell us your email and what happened…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className={styles.sendBtn} type="submit" disabled={sending || !input.trim()}>
              Send
            </button>
            {voiceSupported && (
              <button
              type="button"
              className={`${styles.voiceToggle} ${
              voiceOn ? styles.voiceToggleOn : ""
              }`}
              onClick={() => {
              if (voiceOn) {
              window.speechSynthesis.cancel();
           }

              setVoiceOn((v) => !v);
           }}
>
           {voiceOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
          </button>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}
