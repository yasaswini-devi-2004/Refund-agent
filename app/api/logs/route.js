// app/api/logs/route.js
import { NextResponse } from "next/server";
import { getLogs, clearLogs } from "../../../lib/logStore";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") || undefined;
  return NextResponse.json({ logs: getLogs(sessionId) });
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ cleared: true });
}
