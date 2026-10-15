import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { adjustStock, getStockroom, returnOrder, setPrice, unlockStockroom } from "@/lib/shop";
import { formatMoney, formatWhen } from "@/lib/format";
import { zoneById } from "@/lib/shipping";
import { cn } from "@/lib/cn";
import { CoverArt } from "@/components/cover";
import { PagePending } from "@/components/pending";

export const Route = createFileRoute("/stockroom")({
  loader: () => getStockroom(),
  pendingComponent: () => <PagePending label="Unlocking the cupboard" />,
  pendingMs: 200,
  head: () => ({ meta: [{ title: "Stockroom — Divinity to your door" }] }),
  component: StockroomPage,
});

function dollarsToCents(value: string) {
  const match = value.trim().match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

function StockroomPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [lockError, setLockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  if (data.locked) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs tracking-widest text-vermilion uppercase">Staff desk</p>
        <h1 className="mt-2 font-display text-4xl">Stockroom is locked.</h1>
        <p className="mt-3 text-muted">Prices, counts, and addresses stay behind this door.</p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setUnlocking(true);
            setLockError("");
            void unlockStockroom({ data: { password } })
              .then(async (result) => {
                if (!result.ok) {
                  setLockError(result.message);
                  return;
                }
                setPassword("");
                await router.invalidate();
              })
              .catch(() => setLockError("The desk could not be reached."))
              .finally(() => setUnlocking(false));
          }}
        >
          <label className="block text-sm">
            Passphrase
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 h-12 w-full border border-line bg-paper px-3"
              required
            />
          </label>
          {lockError ? <p className="text-sm text-vermilion">{lockError}</p> : null}
          <button
            type="submit"
            disabled={unlocking}
            className="min-h-11 border border-ink bg-ink px-4 text-paper disabled:opacity-40"
          >
            {unlocking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </main>
    );
  }

  return <StockroomDesk data={data} />;
}

function StockroomDesk({
  data,
}: {
  data: Extract<Awaited<ReturnType<typeof getStockroom>>, { locked: false }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tight, setTight] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const books = data.books.filter((book) => {
    if (tight && book.stock > book.lowStockAt) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return book.title.toLowerCase().includes(q) || book.tradition.toLowerCase().includes(q);
  });

  async function run(key: string, task: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key);
    try {
      const result = await task();
      if (!result.ok) {
        toast(result.message ?? "The cupboard refused that.");
        return;
      }
      await router.invalidate();
    } catch {
      toast("The cupboard could not be reached.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs tracking-widest text-vermilion uppercase">Staff desk</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Stockroom</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Adjust a count or a price and the shelf changes for everyone. Orders listed here have no names.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="Copies on hand" v={String(data.units)} />
        <Stat k="Running low" v={String(data.low)} />
        <Stat k="Sold out" v={String(data.soldOut)} />
        <Stat k="Paid sales" v={`${data.sales} · ${formatMoney(data.revenueCents)}`} />
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="block min-w-0 flex-1">
          <span className="sr-only">Find a title</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a title"
            className="h-12 w-full max-w-sm border border-line bg-paper px-3 text-base"
          />
        </label>
        <button
          type="button"
          aria-pressed={tight}
          onClick={() => setTight((value) => !value)}
          className={cn(
            "min-h-11 border px-4 text-sm",
            tight ? "border-ink bg-ink text-paper" : "border-line bg-paper",
          )}
        >
          Low and sold out
        </button>
      </div>

      <ul className="mt-6 space-y-4">
        {books.map((book) => {
          const price = drafts[book.id] ?? (book.priceCents / 100).toFixed(2);
          const low = book.stock > 0 && book.stock <= book.lowStockAt;
          return (
            <li key={book.id} className="border border-line bg-paper p-4">
              <div className="flex gap-4">
                <div className="h-24 w-16 shrink-0 overflow-hidden bg-ink">
                  <CoverArt book={book} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-2xl">{book.title}</h2>
                    <p className={cn("tabular-nums", book.stock === 0 ? "text-vermilion" : low ? "text-vermilion" : "")}>
                      {book.stock === 0 ? "Sold out" : `${book.stock} on hand`}
                    </p>
                  </div>
                  <p className="text-sm text-muted">
                    {book.tradition} · No. {book.editionNo} · {book.format}
                  </p>
                  <form
                    className="mt-3 flex flex-wrap items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const cents = dollarsToCents(price);
                      if (cents === null) {
                        toast("Use a price like 28 or 28.50.");
                        return;
                      }
                      void run(`price-${book.id}`, async () => {
                        const result = await setPrice({ data: { bookId: book.id, priceCents: cents } });
                        if (result.ok) {
                          setDrafts((prev) => {
                            const next = { ...prev };
                            delete next[book.id];
                            return next;
                          });
                          toast(`${book.title} is now ${formatMoney(cents)}.`);
                        }
                        return result;
                      });
                    }}
                  >
                    <label className="text-sm text-muted">
                      Price
                      <input
                        value={price}
                        onChange={(event) =>
                          setDrafts((prev) => ({ ...prev, [book.id]: event.target.value }))
                        }
                        inputMode="decimal"
                        className="ml-2 h-11 w-24 border border-line bg-ivory px-2 tabular-nums"
                      />
                    </label>
                    <button
                      type="submit"
                      className="min-h-11 px-3 text-sm underline underline-offset-4"
                      disabled={busy === `price-${book.id}`}
                    >
                      Save price
                    </button>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[-5, -1, 1, 5, 12].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        disabled={busy === `${book.id}:${delta}`}
                        className="min-h-11 min-w-11 border border-line px-3 text-sm tabular-nums hover:border-ink disabled:opacity-40"
                        onClick={() => {
                          void run(`${book.id}:${delta}`, async () => {
                            const result = await adjustStock({ data: { bookId: book.id, delta } });
                            if (result.ok) {
                              toast(
                                delta > 0
                                  ? `Added ${delta} of ${book.title}.`
                                  : `Removed ${Math.abs(delta)} of ${book.title}.`,
                              );
                            }
                            return result;
                          });
                        }}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-14">
        <h2 className="font-display text-3xl">Till tape</h2>
        {data.orders.length === 0 ? (
          <p className="mt-3 text-muted">No sales yet. The tape fills when someone checks out.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {data.orders.map((order) => {
              const zone = zoneById(order.region);
              return (
                <li key={order.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                  <div>
                    <p className="font-display text-xl">{order.id}</p>
                    <p className="text-sm text-muted">
                      {formatWhen(order.createdAt)} · {zone?.name ?? order.region} · {order.status}
                    </p>
                    <p className="mt-1 text-sm">
                      {order.items.map((item) => `${item.qty} × ${item.title}`).join(", ")}
                    </p>
                    {order.buyerName ? (
                      <p className="mt-2 text-sm">
                        {order.buyerName}
                        <br />
                        {order.street}
                        <br />
                        {order.city} {order.postal}
                        <br />
                        {order.country}
                        <br />
                        <span className="text-muted">{order.email}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">No address was stored for this order.</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{formatMoney(order.totalCents)}</p>
                    {order.status === "paid" ? (
                      <button
                        type="button"
                        className="mt-2 min-h-11 text-sm underline underline-offset-4"
                        disabled={busy === order.id}
                        onClick={() => {
                          void run(order.id, async () => {
                            const result = await returnOrder({ data: { id: order.id } });
                            if (result.ok) toast(`${order.id} is back on the shelf.`);
                            return result;
                          });
                        }}
                      >
                        Return to shelf
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-3xl">Cupboard log</h2>
        {data.moves.length === 0 ? (
          <p className="mt-3 text-muted">No movements yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {data.moves.map((move, index) => (
              <li key={`${move.title}-${move.createdAt}-${index}`} className="flex justify-between gap-4">
                <span>
                  <span className="tabular-nums">{move.delta > 0 ? `+${move.delta}` : move.delta}</span>{" "}
                  {move.title}
                  <span className="text-muted"> · {move.reason}</span>
                </span>
                <span className="text-muted">{formatWhen(move.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-line bg-paper px-4 py-3">
      <dt className="text-xs tracking-wide text-muted uppercase">{k}</dt>
      <dd className="mt-1 font-display text-2xl tabular-nums">{v}</dd>
    </div>
  );
}
