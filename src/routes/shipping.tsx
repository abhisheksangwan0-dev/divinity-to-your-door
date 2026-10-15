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
        Unopened copies can come back within 30 days. You pay the return post unless we sent the wrong book. In the stockroom, a returned order puts the copies back in the cupboard and drops the sale from the till.
      </p>
      <h2 className="mt-10 font-display text-3xl">The till</h2>
      <p className="mt-3 max-w-2xl text-muted">
        Checkout charges through Razorpay, in rupees, using UPI, a card, or netbanking. Shelf prices stay in dollars and are converted at the day's rate. The shop stores an order number, the titles, a shipping region, and a total. It does not store the card.
      </p>
    </main>
  );
}
