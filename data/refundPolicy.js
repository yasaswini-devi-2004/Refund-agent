// data/refundPolicy.js
//
// The "strict refund policy document". Structured fields are what the
// agent's check_eligibility tool actually computes against; policyText is
// the human-readable version the agent can quote/summarize to customers.

export const refundPolicy = {
  // Refund window, in days since delivery, per category.
  // A category not listed falls back to standardWindowDays.
  standardWindowDays: 30,
  categoryWindows: {
    electronics: 14,
    clothing: 30,
    accessories: 30,
    home: 30,
    beauty: 30,
    digital: 0,
    giftcard: 0,
    grocery: 0,
  },

  // These categories can never be refunded, regardless of window or
  // condition, because they're not resellable or not physically returned.
  nonRefundableCategories: ["digital", "giftcard", "grocery"],

  // These categories cannot be refunded once opened, for hygiene reasons,
  // even if the standard window hasn't expired.
  requiresUnopenedCategories: ["beauty"],

  // If the customer reports a manufacturing defect or DOA item, the normal
  // category window is extended (does not apply to non-refundable or
  // hygiene-restricted categories — a defective lipstick is still opened).
  defectiveExtendedWindowDays: 90,

  // Operational rules
  oneRefundPerOrder: true,
  requiresDeliveredStatus: true,

  // Refund amount rules
  shippingFee: 99,
  shippingRefundableOnDefect: true, // full refund incl. shipping if defective
  shippingRefundableOnStandard: false, // shipping fee deducted otherwise

  policyText: `
REFUND POLICY (Customer Support Reference)

1. Refund Window
   Standard items may be refunded within 30 days of delivery.
   Electronics may be refunded within 14 days of delivery.
   This window is extended to 90 days if the item is reported defective,
   damaged on arrival, or materially not as described.

2. Non-Refundable Categories
   Digital goods (eBooks, software, downloads), gift cards, and grocery /
   perishable items are final sale and are never eligible for a refund,
   including in cases of reported defects.

3. Condition Requirements
   Beauty and personal-care items must be unopened and unused to qualify
   for a refund. This rule is not waived for defect claims, since opened
   personal-care items cannot be restocked or resold.

4. Order Status
   An order must be marked "Delivered" before a refund can be requested.
   Orders that are still Processing or Shipped are not yet eligible;
   the customer should request a cancellation instead.

5. One Refund Per Order
   Each order may only be refunded once. Duplicate refund requests on an
   order that has already been refunded must be denied.

6. Refund Amount
   Standard refunds return the item price minus a flat ₹99 shipping fee.
   Refunds approved due to a defective or damaged item are refunded in
   full, including the original shipping fee.

7. Tone
   Refusals must always state the specific policy reason in plain
   language. Customers are not at fault for asking; the agent should be
   polite and clear, never dismissive.
`.trim(),
};
