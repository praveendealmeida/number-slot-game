import { settleOrder } from "@/lib/checkout";
import { verifyChain2PaySignature } from "@/lib/payment";
import { NextResponse } from "next/server";

// Chain2Pay calls this as a GET with query params (chain2pay_order_id, txid_out, ...).
// We never trust the payload: settleOrder re-fetches the authoritative status from
// the gateway API before fulfilling. Signature (if a secret is set) is a bonus check.
async function handle(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("chain2pay_order_id");

  if (!orderId) {
    return NextResponse.json({ error: "Missing chain2pay_order_id." }, { status: 400 });
  }

  const signatureOk = verifyChain2PaySignature(
    request.url,
    request.headers.get("x-chain2pay-signature"),
  );
  if (!signatureOk) {
    console.warn("Chain2Pay webhook signature mismatch for order", orderId);
  }

  try {
    const { result } = await settleOrder(orderId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Chain2Pay webhook settle error:", error);
    // Non-2xx lets Chain2Pay retry on transient failures.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
