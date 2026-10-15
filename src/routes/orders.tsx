import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatMoney, formatWhen } from "@/lib/format";
import { readReceipts, type Receipt } from "@/lib/receipts";
import { buttonClass } from "@/components/button";
import { PagePending } from "@/components/pending";
import { openShelf } from "@/lib/shop-search";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders — Divinity to your door" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  useEffect(() => {
    setReceipts(readReceipts());
  }, []);
  if (!receipts) return <PagePending label="Looking up receipts on this device" />;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-xs tracking-widest text-vermilion uppercase">This browser</p>
      <h1 className="mt-2 font-display text-4xl">Orders</h1>
      <p className="mt-3 text-muted">
        Receipts on this phone or computer. The desk also keeps the address and phone number, so a parcel can still be posted if you clear this browser.
      </p>
      {receipts.length === 0 ? (
        <div className="mt-8">
          <p>No orders on this device yet.</p>
          <Link to="/shop" search={openShelf} className={buttonClass("solid", "mt-6")}>
            Browse the shelf
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <Link to="/order/$id" params={{ id: receipt.id }} className="flex items-baseline justify-between gap-4 py-4">
                <span>
                  <span className="block font-display text-2xl">{receipt.id}</span>
                  <span className="text-sm text-muted">
                    {formatWhen(receipt.placedAt)} · {receipt.country} ·{" "}
                    {receipt.lines.reduce((sum, line) => sum + line.qty, 0)} copies
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(receipt.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
