import { createFileRoute, Link } from "@tanstack/react-router";
import { getCatalog } from "@/lib/shop";
import { basketProblem, priceLines, useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { FREE_SOUTH_ASIA_CENTS } from "@/lib/shipping";
import { buttonClass } from "@/components/button";
import { CoverArt } from "@/components/cover";
import { PagePending } from "@/components/pending";
import { openShelf } from "@/lib/shop-search";
import { QtyStepper } from "@/components/qty-stepper";

export const Route = createFileRoute("/cart")({
  loader: () => getCatalog(),
  head: () => ({ meta: [{ title: "Basket — Divinity to your door" }] }),
  component: CartPage,
});

function CartPage() {
  const books = Route.useLoaderData();
  const hydrated = useCart((state) => state.hydrated);
  const lines = useCart((state) => state.lines);
  const setQty = useCart((state) => state.setQty);
  const remove = useCart((state) => state.remove);
  const priced = priceLines(books, lines);
  const subtotal = priced.reduce((sum, item) => sum + item.lineCents, 0);
  const problem = basketProblem(priced);

  if (!hydrated) return <PagePending label="Opening your basket" />;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-4xl">Basket</h1>
      {priced.length === 0 ? (
        <div className="mt-8">
          <p className="text-muted">Nothing waiting to be wrapped.</p>
          <Link to="/shop" search={openShelf} className={buttonClass("solid", "mt-6")}>
            Browse the shelf
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {priced.map(({ line, book, lineCents }) => (
              <li key={book.id} className="flex gap-4 py-5">
                <Link
                  to="/book/$slug"
                  params={{ slug: book.slug }}
                  className="block h-28 w-20 shrink-0 overflow-hidden bg-ink"
                >
                  <CoverArt book={book} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl">{book.title}</h2>
                      <p className="text-sm text-muted">{book.author}</p>
                    </div>
                    <p className="tabular-nums">{formatMoney(lineCents)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {book.stock > 0 ? (
                      <QtyStepper
                        value={Math.min(line.qty, book.stock)}
                        max={Math.min(4, book.stock)}
                        onChange={(next) => setQty(book.id, next, book.stock)}
                        label={book.title}
                      />
                    ) : (
                      <span className="text-sm text-vermilion">Sold out</span>
                    )}
                    <button
                      type="button"
                      className="min-h-11 text-sm text-muted underline underline-offset-4"
                      onClick={() => remove(book.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-sm text-muted">Subtotal</p>
              {subtotal < FREE_SOUTH_ASIA_CENTS ? (
                <p className="mt-1 text-sm text-muted">
                  Add {formatMoney(FREE_SOUTH_ASIA_CENTS - subtotal)} for free shipping in South Asia.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">South Asia shipping is on us.</p>
              )}
            </div>
            <p className="font-display text-3xl tabular-nums">{formatMoney(subtotal)}</p>
          </div>
          {problem ? <p className="mt-4 text-sm text-vermilion">{problem}</p> : null}
          <Link
            to="/checkout"
            onClick={(event) => {
              if (problem) event.preventDefault();
            }}
            className={buttonClass("solid", "mt-6")}
          >
            Checkout
          </Link>
        </>
      )}
    </main>
  );
}
