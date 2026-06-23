"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const POLL_MS = 1500;

function timeLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortSession(id) {
  if (!id) return "—";
  return id.replace("session-", "").slice(0, 8);
}

function TypeBadge({ type, decision }) {
  const map = {
    user_message: { label: "Customer", cls: styles.badgeNeutral },
    tool_call: { label: "Tool call", cls: styles.badgeAmber },
    tool_result: { label: "Tool result", cls: styles.badgeNeutral },
    tool_error: { label: "Tool error", cls: styles.badgeDenied },
    decision: {
      label: decision === "approve" ? "Decision · Approved" : "Decision · Denied",
      cls: decision === "approve" ? styles.badgeApproved : styles.badgeDenied,
    },
    final_response: { label: "Agent reply", cls: styles.badgeTerracotta },
    agent_error: { label: "Agent error", cls: styles.badgeDenied },
  };
  const cfg = map[type] || { label: type, cls: styles.badgeNeutral };
  return <span className={`${styles.badge} ${cfg.cls}`}>{cfg.label}</span>;
}

function LogRow({ log }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMeta}>
        <span className={`mono ${styles.timestamp}`}>{timeLabel(log.timestamp)}</span>
        <span className={`mono ${styles.sessionTag}`}>#{shortSession(log.sessionId)}</span>
        <TypeBadge type={log.type} decision={log.decision} />
      </div>

      <div className={styles.rowBody}>
        {log.type === "user_message" && <p className={styles.text}>"{log.content}"</p>}

        {log.type === "tool_call" && (
          <>
            <p className={styles.toolName}>{log.tool}</p>
            {log.reasoning && <p className={styles.reasoning}>{log.reasoning}</p>}
            {log.args && Object.keys(log.args).length > 1 && (
              <pre className={styles.codeBlock}>{JSON.stringify(omit(log.args, "reasoning"), null, 2)}</pre>
            )}
          </>
        )}

        {log.type === "tool_result" && (
          <>
            <p className={styles.toolName}>{log.tool} → result</p>
            <pre className={styles.codeBlock}>{JSON.stringify(log.result, null, 2)}</pre>
          </>
        )}

        {log.type === "tool_error" && (
          <>
            <p className={styles.toolName}>{log.tool} → error</p>
            <p className={styles.errorText}>{log.error}</p>
          </>
        )}

        {log.type === "final_response" && <p className={styles.text}>{log.content}</p>}

        {log.type === "agent_error" && <p className={styles.errorText}>{log.error}</p>}

        {log.type === "decision" && (
          <div className={styles.decisionWrap}>
            <div
              className={`${styles.stamp} ${log.decision === "approve" ? styles.stampApproved : styles.stampDenied}`}
            >
              {log.decision === "approve" ? "Approved" : "Denied"}
            </div>
            <div className={styles.decisionDetails}>
              <p className={styles.reasoning}>{log.reasoning}</p>
              {log.policyReasons?.length > 0 && (
                <ul className={styles.reasonList}>
                  {log.policyReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              <div className={styles.decisionFooter}>
                <span>Order: {log.orderId}</span>
                {log.decision === "approve" && (
                  <>
                    <span>Refund: ₹{log.refundAmount}</span>
                    <span>ID: {log.refundId}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function omit(obj, key) {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

export default function DashboardPage() {
  const [logs, setLogs] = useState([]);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/logs");
        const data = await res.json();
        if (active) setLogs(data.logs || []);
      } catch {
        // dashboard keeps last known state on a transient fetch failure
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const sessions = useMemo(() => {
    const set = new Set(logs.map((l) => l.sessionId).filter(Boolean));
    return Array.from(set);
  }, [logs]);

  const visible = useMemo(() => {
    const filtered = sessionFilter === "all" ? logs : logs.filter((l) => l.sessionId === sessionFilter);
    return [...filtered].reverse(); // newest first
  }, [logs, sessionFilter]);

  const stats = useMemo(() => {
    const approved = logs.filter((l) => l.type === "decision" && l.decision === "approve").length;
    const denied = logs.filter((l) => l.type === "decision" && l.decision === "deny").length;
    const toolCalls = logs.filter((l) => l.type === "tool_call").length;
    const errors = logs.filter((l) => l.type === "tool_error" || l.type === "agent_error").length;
    return { approved, denied, toolCalls, errors, sessions: sessions.length };
  }, [logs, sessions]);

  async function handleClear() {
    if (!confirm("Clear the entire audit ledger? This can't be undone.")) return;
    setClearing(true);
    await fetch("/api/logs", { method: "DELETE" });
    setLogs([]);
    setClearing(false);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>RD</span>
          <span className="mono">Audit Ledger</span>
        </div>
        <a href="/" className={styles.chatLink}>
          ← Customer chat
        </a>
      </header>

      <div className={styles.statsStrip}>
        <Stat label="Approved" value={stats.approved} tone="approved" />
        <Stat label="Denied" value={stats.denied} tone="denied" />
        <Stat label="Tool calls" value={stats.toolCalls} tone="neutral" />
        <Stat label="Errors / retries" value={stats.errors} tone="amber" />
        <Stat label="Sessions" value={stats.sessions} tone="neutral" />
      </div>

      <div className={styles.controls}>
        <select
          className={styles.select}
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
        >
          <option value="all">All sessions</option>
          {sessions.map((s) => (
            <option key={s} value={s}>
              Case #{shortSession(s)}
            </option>
          ))}
        </select>
        <button className={styles.clearBtn} onClick={handleClear} disabled={clearing}>
          Clear ledger
        </button>
      </div>

      <main className={styles.feed}>
        {visible.length === 0 && (
          <div className={styles.emptyFeed}>
            No entries yet. Open the customer chat in another tab and send a message —
            this ledger updates automatically every {POLL_MS / 1000}s.
          </div>
        )}
        {visible.map((log) => (
          <LogRow key={log.id} log={log} />
        ))}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.statValue} ${styles["tone_" + tone]}`}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
