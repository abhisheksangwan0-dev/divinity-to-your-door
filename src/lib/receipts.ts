import type { OrderLine } from "@/lib/catalog";

export type Receipt = {
  id: string;
  placedAt: string;
  buyerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
  country: string;
  zoneName: string;
  eta: string;
  lines: (OrderLine & { cover: string })[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  cardBrand: string;
  cardLast4: string;
};

const KEY = "divinity-receipts";

export function readReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Receipt[]) : [];
  } catch {
    return [];
  }
}

export function readReceipt(id: string) {
  return readReceipts().find((receipt) => receipt.id === id) ?? null;
}

export function saveReceipt(receipt: Receipt) {
  const next = [receipt, ...readReceipts().filter((item) => item.id !== receipt.id)].slice(0, 24);
  localStorage.setItem(KEY, JSON.stringify(next));
}
