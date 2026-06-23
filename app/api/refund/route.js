// app/api/refund/route.js
import { NextResponse } from "next/server";
import { runAgent } from "../../../lib/refundAgent";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { sessionId, conversationHistory = [], userMessage } = body;

  if (!userMessage) {
    return NextResponse.json({ error: "userMessage is required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing OPENAI_API_KEY. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  try {
    const result = await runAgent({
      sessionId: sessionId || `session-${Date.now()}`,
      conversationHistory,
      userMessage,
    });

    return NextResponse.json({
      reply: result.reply,
      conversationHistory: result.conversationHistory,
    });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json(
      { error: "The agent failed to process this request." },
      { status: 500 }
    );
  }
}
