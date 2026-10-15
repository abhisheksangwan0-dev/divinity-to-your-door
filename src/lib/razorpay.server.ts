import { createHmac, timingSafeEqual } from "node:crypto";

const RATE_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";

type RazorpayError = { error?: { description?: string } };
type RazorpayOrder = {
  id?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, string>;
};
type RazorpayPayment = {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  order_id?: string;
  method?: string;
  card?: { last4?: string; network?: string } | null;
};

let rateCache: { rate: number; at: number } | null = null;

export function razorpayReady() {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

function keys() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not connected.");
  }
  return { keyId, keySecret };
}

export function usdCentsToPaise(usdCents: number, rate: number) {
  return Math.round(usdCents * rate);
}

export async function usdInrRate() {
  if (rateCache && Date.now() - rateCache.at < 60 * 60 * 1000) return rateCache.rate;
  const response = await fetch(RATE_URL);
  if (!response.ok) throw new Error("The rupee rate could not be loaded.");
  const body = (await response.json()) as { rates?: { INR?: number } };
  const rate = body.rates?.INR;
  if (typeof rate !== "number" || rate < 50 || rate > 200) {
    throw new Error("The rupee rate looked wrong, so nothing was charged.");
  }
  rateCache = { rate, at: Date.now() };
  return rate;
}

async function razorpay(path: string, init?: RequestInit) {
  const { keyId, keySecret } = keys();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const description =
      body && typeof body === "object" ? (body as RazorpayError).error?.description : "";
    throw new Error(description || "Razorpay refused the request.");
  }
  return body;
}

export async function createRazorpayOrder(input: {
  paise: number;
  usdCents: number;
  zoneId: string;
  lines: string;
  receipt: string;
}) {
  const { keyId } = keys();
  if (!Number.isInteger(input.paise) || input.paise < 100) {
    throw new Error("This total is too small for Razorpay.");
  }
  const order = (await razorpay("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: input.paise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: {
        usdCents: String(input.usdCents),
        zone: input.zoneId.slice(0, 40),
        lines: input.lines.slice(0, 240),
        shop: "divinity",
      },
    }),
  })) as RazorpayOrder;
  if (!order.id) throw new Error("Razorpay did not open a payment.");
  return { keyId, orderId: order.id, paise: input.paise, currency: "INR" as const };
}

function signaturesMatch(expected: string, received: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function confirmRazorpayPayment(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  expectedUsdCents: number;
  expectedZone: string;
  expectedLines: string;
}) {
  const { keySecret } = keys();
  const expected = createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  if (!signaturesMatch(expected, input.signature)) {
    throw new Error("Razorpay could not confirm this payment.");
  }

  const payment = (await razorpay(`/payments/${input.paymentId}`)) as RazorpayPayment;
  const order = (await razorpay(`/orders/${input.orderId}`)) as RazorpayOrder;
  const usdNote = Number(order.notes?.usdCents);
  if (
    payment.order_id !== input.orderId ||
    payment.currency !== "INR" ||
    order.currency !== "INR" ||
    payment.amount !== order.amount ||
    !Number.isInteger(payment.amount) ||
    usdNote !== input.expectedUsdCents ||
    order.notes?.zone !== input.expectedZone ||
    order.notes?.lines !== input.expectedLines.slice(0, 240)
  ) {
    throw new Error("The payment does not match this basket.");
  }

  if (payment.status === "authorized") {
    await razorpay(`/payments/${input.paymentId}/capture`, {
      method: "POST",
      body: JSON.stringify({ amount: payment.amount, currency: "INR" }),
    });
  } else if (payment.status !== "captured") {
    throw new Error("Razorpay has not captured this payment.");
  }

  const network = payment.card?.network?.trim();
  const last4 = payment.card?.last4?.trim() ?? "";
  const method = payment.method === "card" && network ? network : (payment.method ?? "Razorpay");
  return { method, last4, paise: payment.amount ?? 0 };
}

export async function refundRazorpayPayment(paymentId: string) {
  await razorpay(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
