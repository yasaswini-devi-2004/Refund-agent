# RefundDesk — AI Customer Support Agent (Refunds)

An AI agent that handles e-commerce refund requests end-to-end: it looks up
the customer and order in a mock CRM, checks the request against a strict,
deterministic refund policy using tool calls, and approves or denies the
refund with a stated reason — all visible live in an admin "audit ledger"
dashboard.

## 1. How it's built (read this before recording your walkthrough)

**Mock data**
- `data/customers.js` — 15 customers, each with one order. The orders are
  deliberately chosen to cover every branch of the policy: standard
  approval, past-window denial, non-refundable categories (digital, gift
  card, grocery), an opened hygiene item, an already-refunded order, an
  undelivered order, and a defective item inside the extended window.
- `data/refundPolicy.js` — the policy itself, both as structured rules
  (windows per category, non-refundable categories, etc.) and as
  human-readable text the agent can quote to customers.

**Agent backend (raw function calling, not a framework)**
- `lib/refundAgent.js` is the agent. It's a loop against the OpenAI Chat
  Completions API: the model is given 5 tools, decides which to call and
  in what order, we execute them against the mock data, and feed the
  results back — repeating until the model returns a plain-text reply with
  no further tool calls.
  - `get_customer_info`, `get_order_details`, `get_refund_policy` — read tools.
    The agent must call `get_customer_info` with an email the customer
    gives it in chat before it's allowed to call `check_eligibility` or
    `finalize_decision` — identity is confirmed through conversation, not
    a frontend login, and that confirmed email is remembered for the rest
    of the session so the agent can't be tricked into discussing someone
    else's order.
  - `check_eligibility` — runs the actual policy logic deterministically
    (the LLM cannot "decide" eligibility itself — it can only call this and
    read the verdict). This is the part that makes the refund decision
    consistent and auditable rather than vibes-based.
  - `finalize_decision` — commits the decision, mutates the mock order
    (marks it refunded), and writes the audit log entry the dashboard reads.
  - Every tool's schema requires a `reasoning` field — the model has to
    state *why* it's calling a tool before it can call it. That's what
    powers the "agent reasoning" shown in the dashboard.
- `lib/logStore.js` — an in-memory, append-only log of every step (good
  enough for a single dev-server demo; swap for Redis/a DB if you ever
  deploy this for real, multi-instance use).

**API routes**
- `app/api/refund/route.js` — the chat sends customer + message here, gets
  the agent's reply back.
- `app/api/logs/route.js` — the dashboard polls this every 1.5s.
- `app/api/customers/route.js` — powers the "viewing as" customer picker.

**Frontend**
- `app/page.js` — customer chat. There's no login or "viewing as" picker — you
  just chat, the same way a real customer support widget works. Give the
  agent your account email and what happened; it calls `get_customer_info`
  itself to confirm you're a real customer before discussing any order. A
  collapsible "sample test accounts" panel lists the 15 mock emails/order
  IDs so you have something to type during testing — clicking one fills
  the input, it doesn't log you in. Includes an optional mic button
  (browser Web Speech API — no extra services or API keys) for voice
  input, and a speaker toggle to have replies read aloud.
- `app/dashboard/page.js` — the **Audit Ledger**: a single-page live feed
  of every tool call, tool result, error/retry, and final decision, with a
  stats strip (approved / denied / tool calls / errors / sessions) and a
  per-case rubber-stamp visual on every decision.

## 2. Setup

```bash
npm install openai
```

Create `.env.local` in the project root (see `.env.local.example`):

```
OPENAI_API_KEY=sk-...
```

Then drop these files into your existing project at the same paths shown
in this zip (they match the structure you already have: `data/`, `lib/`,
`app/api/refund/route.js`, `app/dashboard/page.js`, etc.) and run:

```bash
npm run dev
```

Open two tabs: `http://localhost:3000` (customer chat) and
`http://localhost:3000/dashboard` (audit ledger). Note: this project uses
the `@/*` import alias in the API routes' relative-path equivalents are
already used internally, so no jsconfig changes should be needed — but if
you hit "module not found", confirm `jsconfig.json` has:

```json
{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }
```

## 3. Demo script for your 7–10 minute video

This maps directly to the assignment's required deliverables.

**A. Standard refund (approve) — ~1 min**
Click the "Standard refund" sample chip (or type it yourself): *"Hi, I'm
sneha.iyer@example.com. I'd like a refund for order ORD1003, I just don't
want it anymore."* Switch to the dashboard tab — show the live tool calls
(`get_customer_info` → `get_order_details` → `check_eligibility` →
`finalize_decision`), the reasoning text on each, and the green
**Approved** stamp with refund amount + refund ID.

**B. Policy violation (deny) — ~1 min**
Click "Non-refundable item": *"Hi, I'm karthik.s@example.com. Can I get a
refund on my eBook order ORD1004?"* Show the agent denying it because
digital goods are non-refundable, and the dashboard's red **Denied** stamp
with the exact policy reason logged.

**C. Edge case: failure/retry handling — ~1 min**
Start a fresh conversation and type an order ID that doesn't exist before
ever giving an email, e.g. *"Can you refund ORD9999?"* — show the agent
declining to guess and asking for your email first (it can't call
`check_eligibility` until `get_customer_info` has run), then the
`tool_error` entry in the ledger when you give a real email but a wrong
order ID, and the agent recovering once you give the correct one.

**D. Voice (bonus) — ~1 min**
Click the mic button, speak a refund request, and show the transcript
appearing and being sent automatically. Toggle the speaker icon to have
the reply read back.

**E. Code walkthrough — ~3 min**
Walk through `lib/refundAgent.js`: the tool schemas, the loop, and
`evaluateEligibility()` as the deterministic policy engine. Explain why
eligibility is computed in code, not decided by the model. Show
`lib/logStore.js` and how every step gets logged with a `reasoning` field.

**F. Architecture recap — ~1 min**
Customer chat → `/api/refund` → agent loop → tools → mock CRM/policy →
`logStore` → `/api/logs` polled by the dashboard. One sentence on how
you'd swap the in-memory store for Redis/Postgres in production.

## 4. Upgrading the voice bonus

What's included (`app/page.js`) uses the browser's built-in
`SpeechRecognition` / `SpeechSynthesis` APIs — zero extra services, works
in Chrome/Edge today, and is enough to demonstrate live voice interaction
in your video. For a production-grade version using what the assignment
mentions:

- **OpenAI Realtime API**: open a WebSocket/WebRTC session from the
  browser, stream mic audio in, and have the model call the *same* tools
  defined in `lib/refundAgent.js` directly (the Realtime API supports
  function calling) — you'd reuse `evaluateEligibility()` and the tool
  schemas as-is, just behind a different transport.
- **LiveKit / ElevenLabs**: similar shape — LiveKit handles the audio
  room/transport, ElevenLabs handles TTS, and your existing
  `/api/refund` logic (or the Realtime tool-calling version of it) stays
  the brain.

## 5. Known simplifications (worth mentioning in your video)

- Logs are in-memory, so they reset on server restart — fine for a demo,
  not for production.
- There's no real authentication; the "viewing as" picker simulates being
  logged in as a given customer, which is enough for this assignment's
  scope.
- `gpt-4o-mini` is used by default for cost; change `OPENAI_AGENT_MODEL` in
  `.env.local` to swap models without touching code.
