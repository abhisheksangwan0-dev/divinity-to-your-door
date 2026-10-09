import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getOrder } from "@/lib/shop";
import { formatMoney, formatWhen } from "@/lib/format";
import { zoneById } from "@/lib/shipping";
import { readReceipt, type Receipt } from "@/lib/receipts";
import { buttonClass } from "@/components/button";
import { PagePending } from "@/components/pending";
import { NotFound } from "@/components/not-found";
import { openShelf } from "@/lib/shop-search";

export const Route = createFileRoute("/order/$id")({
  loader: ({ params }) => getOrder({ data: params.id }),
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Divinity to your door` }] }),
  component: OrderPage,
  notFoundComponent: NotFound,
});

function OrderPage() {
  const server = Route.useLoaderData();
  const { id } = Route.useParams();
  const [receipt, setReceipt] = useState<Receipt | null | undefined>(undefined);

  useEffect(() => {
    setReceipt(readReceipt(id));
  }, [id]);

  if (!server && receipt === undefined) return <PagePending label="Finding the order" />;
  if (!server && !receipt) return <NotFound />;

  const items = receipt?.lines ?? server?.items ?? [];
  const subtotal = server?.subtotalCents ?? receipt?.subtotalCents ?? 0;
  const shipping = server?.shippingCents ?? receipt?.shippingCents ?? 0;
  const total = server?.totalCents ?? receipt?.totalCents ?? 0;
  const zone = zoneById(server?.region ?? "");
  const returned = server?.status === "returned";

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs tracking-widest text-vermilion uppercase">
        {returned ? "Returned to the shelf" : "Paid"}
      </p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">
        {returned ? "This parcel came back." : "It is on its way."}
      </h1>
      <p className="mt-3 text-muted">
        Order <span className="text-ink tabular-nums">{id}</span>
        {server?.createdAt ? ` · ${formatWhen(server.createdAt)}` : ""}
      </p>
      <p className="mt-3 text-sm text-muted">
        Demonstration payment. Nothing was charged
        {receipt ? ` on the ${receipt.cardBrand} ending ${receipt.cardLast4}` : ""}.
      </p>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.bookId} className="flex items-baseline justify-between gap-4 py-3">
            <span>
              {item.qty} ×{" "}
              {item.slug ? (
                <Link
                  to="/book/$slug"
                  params={{ slug: item.slug }}
                  className="underline decoration-line underline-offset-4"
                >
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </span>
            <span className="tabular-nums">{formatMoney(item.priceCents * item.qty)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 text-sm">
        <Row k="Subtotal" v={formatMoney(subtotal)} />
        <Row k="Shipping" v={shipping === 0 ? "Free" : formatMoney(shipping)} />
        <Row k="Total" v={formatMoney(total)} strong />
        <Row k="Region" v={receipt?.zoneName ?? zone?.name ?? server?.region ?? "—"} />
        <Row k="Arrival" v={receipt?.eta ?? zone?.eta ?? "—"} />
      </dl>

      {receipt ? (
        <div className="mt-8 border border-line bg-paper p-5">
          <h2 className="font-display text-2xl">On the parcel</h2>
          <p className="mt-3">
            {receipt.buyerName}
            <br />
            {receipt.address}
            <br />
            {receipt.city} {receipt.postal}
            <br />
            {receipt.country}
          </p>
          <p className="mt-3 text-sm text-muted">{receipt.email}</p>
          <p className="mt-3 text-sm text-muted">
            These details live only in this browser. The stockroom never sees them.
          </p>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          The address was kept on the device that placed the order. This view shows the books and the total only.
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/shop" search={openShelf} className={buttonClass("solid")}>
          Back to the shelf
        </Link>
        <Link to="/orders" className={buttonClass("ghost")}>
          All orders on this device
        </Link>
      </div>
    </main>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className={strong ? "font-display text-2xl tabular-nums" : "tabular-nums"}>{v}</dd>
    </div>
  );
}
