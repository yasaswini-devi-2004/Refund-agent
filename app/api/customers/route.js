// app/api/customers/route.js
import { NextResponse } from "next/server";
import { customers } from "../../../data/customers";

// Only exposes id/name/email/tier + one sample order ID — not full order
// data — so the frontend can show a "sample test accounts" reference
// without bypassing the agent's own lookups.
export async function GET() {
  const directory = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    tier: c.tier,
    sampleOrderId: c.orders[0]?.orderId || null,
  }));
  return NextResponse.json({ customers: directory });
}
