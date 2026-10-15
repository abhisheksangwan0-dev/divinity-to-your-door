import { createFileRoute } from "@tanstack/react-router";
import { formatMoney } from "@/lib/format";
import { FREE_SOUTH_ASIA_CENTS, ZONES } from "@/lib/shipping";

export const Route = createFileRoute("/shipping")({
  head: () => ({ meta: [{ title: "Shipping and returns — Divinity to your door" }] }),
  component: ShippingPage,
});

function ShippingPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs tracking-widest text-vermilion uppercase">Post</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Shipping and returns</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Parcels leave Jaipur in unbleached cotton. Duties, if any, belong to the receiver. South Asia is free when the books themselves come to {formatMoney(FREE_SOUTH_ASIA_CENTS)}.
      </p>
      <div className="mt-8 overflow-x-auto border border-line">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">First book</th>
              <th className="px-4 py-3 font-medium">Each extra</th>
            </tr>
          </thead>
          <tbody>
            {ZONES.map((zone) => (
              <tr key={zone.id} className="border-t border-line">
                <td className="px-4 py-3">{zone.name}</td>
                <td className="px-4 py-3">{zone.eta}</td>
                <td className="px-4 py-3 tabular-nums">
                  {zone.id === "south-asia"
                    ? `${formatMoney(zone.baseCents + zone.perItemCents)} · free over $40`
                    : formatMoney(zone.baseCents + zone.perItemCents)}
                </td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(zone.perItemCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-12 font-display text-3xl">Returns</h2>
      <p className="mt-3 max-w-2xl text-muted">
        Unopened copies can come back within 30 days. You pay the return post unless we sent the wrong book. A return puts the copies back and asks Razorpay to send the money back.
      </p>
      <h2 className="mt-10 font-display text-3xl">Payment</h2>
      <p className="mt-3 max-w-2xl text-muted">
        You pay in rupees through Razorpay: UPI, a card, or netbanking. Shelf prices are in dollars and convert at the day's rate. We keep the address and phone for the courier. We never see the card.
      </p>
    </main>
  );
}
