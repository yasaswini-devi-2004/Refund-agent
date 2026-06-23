// lib/refundAgent.js
//
// The agent. Implements a raw function-calling loop against the OpenAI
// Chat Completions API: the model is given a set of tools, decides which
// ones to call and in what order, we execute them against the mock CRM +
// policy data, feed the results back, and repeat until the model produces
// a plain-text reply with no further tool calls.
//
// Every tool's schema requires a `reasoning` string. That's the field that
// powers the admin dashboard's reasoning log — the model is forced to
// narrate *why* it's calling a tool before it can call it.

import { openai, AGENT_MODEL } from "./openai";
import { addLog } from "./logStore";
import { customers, findCustomerByEmail, findOrderById } from "../data/customers";
import { refundPolicy } from "../data/refundPolicy";

// ---------------------------------------------------------------------------
// Tool schemas (OpenAI function-calling format)
// ---------------------------------------------------------------------------

const tools = [
  {
    type: "function",
    function: {
      name: "get_customer_info",
      description:
        "Look up a customer's CRM profile by email address. Always call this first to confirm you're talking to a real, identifiable customer.",
      parameters: {
        type: "object",
        properties: {
          reasoning: {
            type: "string",
            description: "Why you're calling this tool right now, for the audit log.",
          },
          email: { type: "string", description: "Customer's account email address." },
        },
        required: ["reasoning", "email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order_details",
      description:
        "Look up a specific order by its order ID (e.g. ORD1001). Returns product, category, price, dates, status, and refund history.",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Why you're calling this tool right now." },
          orderId: { type: "string", description: "The order ID to look up." },
        },
        required: ["reasoning", "orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_refund_policy",
      description:
        "Fetch the current refund policy text and rules. Use this when you need to explain or cite a specific policy reason to the customer.",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Why you're calling this tool right now." },
        },
        required: ["reasoning"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_eligibility",
      description:
        "Deterministically evaluate an order against the refund policy. ALWAYS call this before approving or denying a refund — never decide from memory. Returns eligible (boolean), a list of reasons, and the maximum refundable amount if eligible.",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Why you're calling this tool right now." },
          orderId: { type: "string", description: "The order ID to evaluate." },
          customerClaim: {
            type: "string",
            description:
              "The customer's stated reason for the refund, in their own words (e.g. 'arrived broken', 'changed my mind'). Used to detect defect claims that extend the refund window.",
          },
        },
        required: ["reasoning", "orderId", "customerClaim"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize_decision",
      description:
        "Commit a final approve/deny decision for an order. Call this exactly once, only after check_eligibility, and only as the last tool call before replying to the customer in plain text.",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Why you're finalizing this particular decision." },
          orderId: { type: "string" },
          decision: { type: "string", enum: ["approve", "deny"] },
          refundAmount: {
            type: "number",
            description: "Amount to refund in INR. Required and >0 if decision is 'approve', otherwise 0.",
          },
          policyReasons: {
            type: "array",
            items: { type: "string" },
            description: "The specific policy reasons backing this decision, to show the customer and the audit log.",
          },
        },
        required: ["reasoning", "orderId", "decision", "refundAmount", "policyReasons"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Deterministic policy engine — this is the part that actually enforces
// the "strict refund policy", not the LLM. The model can only see and act
// on what this function returns.
// ---------------------------------------------------------------------------

function daysBetween(fromISO, toISO) {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

const DEFECT_KEYWORDS = [
  "broken", "defect", "defective", "damaged", "doa", "dead on arrival",
  "not working", "doesn't work", "stopped working", "faulty", "cracked",
  "malfunction", "torn", "missing parts",
];

function looksLikeDefectClaim(claimText = "") {
  const lower = claimText.toLowerCase();
  return DEFECT_KEYWORDS.some((kw) => lower.includes(kw));
}

function evaluateEligibility(orderId, customerClaim, requestingCustomerEmail) {
  const found = findOrderById(orderId);
  if (!found) {
    return {
      eligible: false,
      reasons: [`No order found with ID "${orderId}". Double-check the order ID with the customer.`],
      maxRefundAmount: 0,
    };
  }

  const { order, customer } = found;

  if (
    requestingCustomerEmail &&
    customer.email.toLowerCase() !== requestingCustomerEmail.toLowerCase()
  ) {
    return {
      eligible: false,
      reasons: ["This order does not belong to the customer currently being served."],
      maxRefundAmount: 0,
    };
  }

  if (order.refunded) {
    return {
      eligible: false,
      reasons: [
        `Order ${order.orderId} was already refunded on ${order.refundedAt}. Policy allows only one refund per order.`,
      ],
      maxRefundAmount: 0,
    };
  }

  if (refundPolicy.requiresDeliveredStatus && order.status !== "Delivered") {
    return {
      eligible: false,
      reasons: [
        `Order ${order.orderId} is currently "${order.status}", not "Delivered". Refunds can only be requested after delivery; the customer may request a cancellation instead.`,
      ],
      maxRefundAmount: 0,
    };
  }

  if (refundPolicy.nonRefundableCategories.includes(order.category)) {
    return {
      eligible: false,
      reasons: [
        `Category "${order.category}" is non-refundable under policy, regardless of condition or defect claims.`,
      ],
      maxRefundAmount: 0,
    };
  }

  const isDefectClaim = looksLikeDefectClaim(customerClaim);

  if (
    refundPolicy.requiresUnopenedCategories.includes(order.category) &&
    order.opened
  ) {
    return {
      eligible: false,
      reasons: [
        `Category "${order.category}" requires the item to be unopened for a refund due to hygiene rules. This order's item was opened, and this rule is not waived even for defect claims.`,
      ],
      maxRefundAmount: 0,
    };
  }

  const daysSinceDelivery = daysBetween(order.deliveryDate, new Date().toISOString());
  const standardWindow = refundPolicy.categoryWindows[order.category] ?? refundPolicy.standardWindowDays;
  const withinStandardWindow = daysSinceDelivery <= standardWindow;
  const withinDefectWindow = daysSinceDelivery <= refundPolicy.defectiveExtendedWindowDays;

  if (withinStandardWindow) {
    const refundAmount = refundPolicy.shippingRefundableOnStandard
      ? order.price
      : order.price - refundPolicy.shippingFee;
    return {
      eligible: true,
      reasons: [
        `Delivered ${daysSinceDelivery} day(s) ago, within the ${standardWindow}-day standard window for "${order.category}".`,
      ],
      maxRefundAmount: Math.max(refundAmount, 0),
      isDefectClaim,
    };
  }

  if (isDefectClaim && withinDefectWindow) {
    return {
      eligible: true,
      reasons: [
        `Standard ${standardWindow}-day window has passed (${daysSinceDelivery} days since delivery), but the customer reported a defect and is within the ${refundPolicy.defectiveExtendedWindowDays}-day extended defect window. Full refund including shipping applies.`,
      ],
      maxRefundAmount: order.price,
      isDefectClaim: true,
    };
  }

  return {
    eligible: false,
    reasons: [
      `Delivered ${daysSinceDelivery} day(s) ago, past the ${standardWindow}-day window for "${order.category}"` +
        (isDefectClaim
          ? `, and also past the ${refundPolicy.defectiveExtendedWindowDays}-day extended defect window.`
          : ` and no defect was reported, so the extended defect window does not apply.`),
    ],
    maxRefundAmount: 0,
    isDefectClaim,
  };
}

// ---------------------------------------------------------------------------
// Tool executor — bound to one conversation's session. Identity is no
// longer passed in from the frontend; the agent has to establish it itself
// during the conversation by calling get_customer_info with an email the
// customer provides in chat. Once confirmed, it's remembered for the rest
// of that session (sessionIdentity), so later tool calls can verify the
// customer isn't asking about someone else's order.
// ---------------------------------------------------------------------------

const sessionIdentity = new Map(); // sessionId -> { email, customerId }

function createToolExecutor({ sessionId }) {
  return async function executeTool(name, args) {
    switch (name) {
      case "get_customer_info": {
        const customer = findCustomerByEmail(args.email);
        if (!customer) {
          throw new Error(
            `No customer found with email "${args.email}". Ask the customer to double check the email on their account.`
          );
        }
        sessionIdentity.set(sessionId, { email: customer.email, customerId: customer.id });
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          tier: customer.tier,
          memberSince: customer.memberSince,
          orderIds: customer.orders.map((o) => o.orderId),
        };
      }

      case "get_order_details": {
        const found = findOrderById(args.orderId);
        if (!found) {
          throw new Error(
            `No order found with ID "${args.orderId}". Ask the customer to double check their order ID.`
          );
        }
        return { ...found.order, customerEmail: found.customer.email };
      }

      case "get_refund_policy": {
        return {
          policyText: refundPolicy.policyText,
          categoryWindows: refundPolicy.categoryWindows,
          nonRefundableCategories: refundPolicy.nonRefundableCategories,
          defectiveExtendedWindowDays: refundPolicy.defectiveExtendedWindowDays,
        };
      }

      case "check_eligibility": {
        const identity = sessionIdentity.get(sessionId);
        if (!identity) {
          throw new Error(
            "Customer identity has not been confirmed yet. Call get_customer_info with the customer's email before checking eligibility."
          );
        }
        return evaluateEligibility(args.orderId, args.customerClaim, identity.email);
      }

      case "finalize_decision": {
        const identity = sessionIdentity.get(sessionId);
        if (!identity) {
          throw new Error(
            "Cannot finalize a decision before the customer's identity is confirmed via get_customer_info."
          );
        }
        const found = findOrderById(args.orderId);
        if (!found) {
          throw new Error(`Cannot finalize: no order found with ID "${args.orderId}".`);
        }
        const { order, customer } = found;
        if (customer.email.toLowerCase() !== identity.email.toLowerCase()) {
          throw new Error(
            "Cannot finalize: this order does not belong to the confirmed customer for this session."
          );
        }

        if (args.decision === "approve") {
          order.refunded = true;
          order.refundedAt = new Date().toISOString();
        }

        const refundId =
          args.decision === "approve"
            ? `RF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
            : null;

        const decisionLog = addLog({
          sessionId,
          type: "decision",
          orderId: args.orderId,
          decision: args.decision,
          refundAmount: args.refundAmount,
          policyReasons: args.policyReasons,
          reasoning: args.reasoning,
          refundId,
        });

        return {
          confirmed: true,
          decision: args.decision,
          refundId,
          refundAmount: args.decision === "approve" ? args.refundAmount : 0,
          loggedAt: decisionLog.timestamp,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 8;

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are RefundBot, an AI customer support agent for an e-commerce store. Today's date is ${today}.

You do not yet know who you're speaking with. Before discussing any specific order:
1. Ask the customer for the email address on their account (if they haven't already given it) and the order ID, if they know it.
2. Call get_customer_info with that email to confirm they're a real customer. Do this before calling get_order_details or check_eligibility.
3. If get_customer_info fails, don't guess — ask them to double check the email, in plain text, with no further tool calls that turn.

Other rules you must always follow:
4. Never approve or deny a refund from memory or assumption. Always call get_order_details and then check_eligibility before deciding anything.
5. Always call finalize_decision exactly once, as your last tool call, before writing your final reply to the customer.
6. If any tool returns an error (order not found, order belongs to someone else, identity not yet confirmed), do not guess — ask the customer to clarify or correct the information, in plain text, with no further tool calls that turn.
7. Be warm and clear. When denying a refund, always state the specific policy reason in plain language — never just "sorry, can't do that."
8. When approving a refund, tell the customer the exact refund amount and the refund ID returned by finalize_decision.
9. Only discuss or act on orders that belong to the customer you've confirmed in this conversation.`;
}

/**
 * Run one turn of the agent loop.
 *
 * @param {object} params
 * @param {string} params.sessionId - groups log entries + remembers the
 *   customer identity this conversation has established, across turns.
 * @param {Array<{role:string,content:string}>} params.conversationHistory - prior turns (no system prompt).
 * @param {string} params.userMessage - the new message from the customer.
 * @returns {Promise<{reply: string, conversationHistory: Array}>}
 */
export async function runAgent({ sessionId, conversationHistory = [], userMessage }) {
  const executeTool = createToolExecutor({ sessionId });

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  addLog({ sessionId, type: "user_message", content: userMessage });

  let finalText = null;
  let iterations = 0;

  while (finalText === null && iterations < MAX_ITERATIONS) {
    iterations++;

    let response;
    try {
      response = await openai.chat.completions.create({
        model: AGENT_MODEL,
        messages,
        tools,
        tool_choice: "auto",
      });
    } catch (err) {
      addLog({ sessionId, type: "agent_error", error: err.message });
      finalText =
        "Sorry, I'm having trouble reaching our systems right now. Please try again in a moment.";
      break;
    }

    const choice = response.choices[0].message;
    messages.push(choice);

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      for (const toolCall of choice.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        addLog({
          sessionId,
          type: "tool_call",
          tool: toolCall.function.name,
          reasoning: args.reasoning,
          args,
        });

        let resultPayload;
        try {
          const result = await executeTool(toolCall.function.name, args);
          addLog({ sessionId, type: "tool_result", tool: toolCall.function.name, result });
          resultPayload = result;
        } catch (err) {
          addLog({ sessionId, type: "tool_error", tool: toolCall.function.name, error: err.message });
          resultPayload = { error: err.message };
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultPayload),
        });
      }
    } else {
      finalText = choice.content || "Sorry, I wasn't able to generate a response.";
      addLog({ sessionId, type: "final_response", content: finalText });
    }
  }

  if (finalText === null) {
    addLog({ sessionId, type: "agent_error", error: "Max iterations reached without a final response." });
    finalText =
      "This is taking longer than expected to resolve. Could you confirm your order ID and what happened, so I can take another look?";
  }

  // Strip tool-call/tool-result messages from what we hand back to the
  // client as "history" — keep it to user/assistant text turns so the
  // chat UI and the next request stay simple.
  const cleanHistory = [
    ...conversationHistory,
    { role: "user", content: userMessage },
    { role: "assistant", content: finalText },
  ];

  return { reply: finalText, conversationHistory: cleanHistory };
}
