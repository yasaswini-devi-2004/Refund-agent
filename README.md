# RefundDesk — AI Customer Support Agent (Refunds)

An AI agent that handles e-commerce refund requests end-to-end: it looks up
the customer and order in a mock CRM, checks the request against a strict,
deterministic refund policy using tool calls, and approves or denies the
refund with a stated reason — all visible live in an admin "audit ledger"
dashboard.

## 1. How it's built 

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
    `finalize_decision` — identity is confirmed through conversation,and that confirmed email is remembered for the rest
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
```command prompt
npm init -y
npm i 
npm i next react react-dom openai
```
Create `.env.local` in the project root (see `.env.local.example`):

```
OPENAI_API_KEY=gsk-...
```

Then drop these files into your existing project at the same paths shown
in this zip (they match the structure you already have: `data/`, `lib/`,
`app/api/refund/route.js`, `app/dashboard/page.js`, etc.) and run:

```bash or command prompt
npm run dev
```
Before running npm run dev check in package.json if "dev":"next dev" is present in scripts

Open two tabs: `http://localhost:3000` (customer chat) and
`http://localhost:3000/dashboard` (audit ledger). Note: this project uses
the `@/*` import alias in the API routes' relative-path equivalents are
already used internally, so no jsconfig changes should be needed — but if
you hit "module not found", confirm `jsconfig.json` has:

```json
{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }
```

## 3. Used agent
I have used the agent "openai/gpt-oss-20b" from groq website since the openai version gpt 4.0 mini requires money.
The api key is also generated from the groq website

## 4. How this works
Mention your order number and email and give your concern to the agent
The agent analyses your concern based on the refund policy and mentions if you are eligible for the refund if so then in how many business days you refund will be generated
