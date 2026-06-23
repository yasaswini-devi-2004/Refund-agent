// lib/openai.js
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  // Don't throw at import time (breaks `next build`); the route handler
  // will surface a clear error if a request actually comes in without a key.
  console.warn(
    "[lib/openai] OPENAI_API_KEY is not set. Add it to .env.local."
  );
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Centralized so it's a one-line change if you want to swap models later.
export const AGENT_MODEL = process.env.OPENAI_AGENT_MODEL ||"openai/gpt-oss-20b";
