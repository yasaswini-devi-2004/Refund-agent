// lib/logStore.js
//
// In-memory store for agent reasoning logs. Good enough for a single dev
// server / demo instance, which is what this assignment runs as. If you
// ever deploy this to a serverless/multi-instance environment, swap this
// module for Redis, a database table, or Server-Sent Events backed by one —
// the call sites (addLog / getLogs / clearLogs) wouldn't need to change.

let logs = [];
let idCounter = 0;

/**
 * @param {object} entry - shape varies by `type`, but every entry gets an
 *   auto id + ISO timestamp attached here. Common `type` values:
 *   "user_message" | "tool_call" | "tool_result" | "tool_error" |
 *   "decision" | "final_response" | "agent_error"
 */
export function addLog(entry) {
  const log = {
    id: ++idCounter,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  logs.push(log);
  // Cap memory usage for long-running dev servers.
  if (logs.length > 1000) logs.shift();
  return log;
}

export function getLogs(sessionId) {
  if (sessionId) return logs.filter((l) => l.sessionId === sessionId);
  return logs;
}

export function clearLogs() {
  logs = [];
  idCounter = 0;
}
