import crypto from "node:crypto";

// Chain2Pay (https://docs.chain2pay.is) — hosted card-to-crypto gateway, API v2.
// Flow: create a payment server-side -> redirect the buyer to checkout_url ->
// confirm via webhook and/or by re-fetching GET /payments/:id (source of truth).

const BASE_URL = (process.env.CHAIN2PAY_BASE_URL || "https://chain2pay.is/api/v2").replace(/\/$/, "");

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

function apiKey(): string {
  const key = process.env.CHAIN2PAY_API_KEY;
  if (!key) {
    throw new PaymentError("Payment gateway is not configured (CHAIN2PAY_API_KEY missing).", 500);
  }
  return key;
}

export function chargeCurrency(): string {
  return (process.env.CHAIN2PAY_CURRENCY || "USD").toUpperCase();
}

// Gateway settles in USD/EUR/GBP/CAD only — convert the LKR ticket price using a
// configurable rate (fiat units per 1 LKR). Default ~ USD.
export function lkrToCharge(amountLkr: number): { amount: number; currency: string } {
  const rate = Number(process.env.CHAIN2PAY_FIAT_PER_LKR) || 0.0033;
  const amount = Math.round(amountLkr * rate * 100) / 100;
  return { amount, currency: chargeCurrency() };
}

// Per-payment floor enforced by the providers (multihosted default ~$6).
export function providerMinimum(): number {
  return Number(process.env.CHAIN2PAY_MIN_AMOUNT) || 6;
}

export const GATEWAY_MAX = 10000;

type CreateArgs = {
  amount: number;
  currency: string;
  callbackUrl: string;
  customerEmail?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createChain2PayPayment(
  args: CreateArgs,
): Promise<{ orderId: string; checkoutUrl: string; status: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        amount: args.amount,
        currency: args.currency,
        callback_url: args.callbackUrl,
        customer_email: args.customerEmail || undefined,
        metadata: args.metadata,
      }),
    });
  } catch {
    throw new PaymentError("Could not reach the payment gateway.", 502);
  }

  const data = (await res.json().catch(() => null)) as
    | { id?: string; checkout_url?: string; status?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !data?.id || !data?.checkout_url) {
    throw new PaymentError(data?.error?.message || `Gateway create failed (${res.status}).`, 502);
  }

  return { orderId: data.id, checkoutUrl: data.checkout_url, status: data.status ?? "pending" };
}

export type Chain2PayStatus =
  | "pending"
  | "processing"
  | "paid"
  | "expired"
  | "dispatch_failed";

export async function getChain2PayPayment(
  orderId: string,
): Promise<{ status: Chain2PayStatus; amount: number; currency: string; paidAmount?: number; txHash?: string } | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/payments/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
  } catch {
    throw new PaymentError("Could not reach the payment gateway.", 502);
  }

  if (res.status === 404) {
    return null;
  }

  const data = (await res.json().catch(() => null)) as
    | { status?: Chain2PayStatus; amount?: number; currency?: string; paid_amount?: number; tx_hash?: string }
    | null;

  if (!res.ok || !data?.status) {
    throw new PaymentError(`Gateway lookup failed (${res.status}).`, 502);
  }

  return {
    status: data.status,
    amount: data.amount ?? 0,
    currency: data.currency ?? chargeCurrency(),
    paidAmount: data.paid_amount,
    txHash: data.tx_hash,
  };
}

// HMAC-SHA256 (hex) of the full request URL using the dashboard webhook secret.
// If no secret is configured we skip this check — settlement still re-verifies
// the payment against the gateway API, which is the real source of truth.
export function verifyChain2PaySignature(fullUrl: string, header: string | null): boolean {
  const secret = process.env.CHAIN2PAY_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }
  if (!header) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(fullUrl).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
