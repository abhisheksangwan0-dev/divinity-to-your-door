import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getBookDetail } from "@/lib/shop";
import { formatMoney, formatWeight } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { buttonClass } from "@/components/button";
import { BookCard } from "@/components/book-card";
import { CoverArt } from "@/components/cover";
import { PagePending } from "@/components/pending";
import { QtyStepper } from "@/components/qty-stepper";
import { NotFound } from "@/components/not-found";
import { openShelf } from "@/lib/shop-search";

export const Route = createFileRoute("/book/$slug")({
  loader: async ({ params }) => {
    const detail = await getBookDetail({ data: params.slug });
    if (!detail) throw notFound();
    return detail;
  },
  pendingComponent: () => <PagePending label="Finding the book" />,
  pendingMs: 200,
  notFoundComponent: NotFound,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.book.title} — Divinity to your door` : "Book" }],
  }),
  component: BookPage,
});

function BookPage() {
  const { book, related } = Route.useLoaderData();
  const add = useCart((state) => state.add);
  const inBasket = useCart((state) => state.lines.find((line) => line.bookId === book.id)?.qty ?? 0);
  const cap = Math.min(4, book.stock);
  const [qty, setQty] = useState(1);
  const safeQty = Math.min(qty, Math.max(cap, 1));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-sm text-muted">
        <Link to="/shop" search={openShelf} className="underline decoration-line underline-offset-4 hover:decoration-vermilion">
          Shelf
        </Link>
        <span aria-hidden="true"> / </span>
        {book.tradition}
      </p>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="aspect-[2/3] overflow-hidden bg-ink shadow-book">
            <CoverArt book={book} priority />
          </div>
        </div>
        <div>
          <p className="text-xs tracking-widest text-vermilion uppercase">{book.tradition}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{book.title}</h1>
          <p className="mt-2 text-lg text-muted">{book.author}</p>
          <p className="mt-6 font-display text-3xl tabular-nums">{formatMoney(book.priceCents)}</p>
          <p className="mt-2 text-sm text-muted">
            {book.stock === 0
              ? "Sold out."
              : book.stock <= book.lowStockAt
                ? `Only ${book.stock} left in the cupboard.`
                : `${book.stock} copies in the cupboard.`}
            {inBasket > 0 ? ` ${inBasket} already in your basket.` : ""}
          </p>
          <p className="mt-6 max-w-xl text-lg">{book.blurb}</p>
          {book.stock > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QtyStepper
                value={safeQty}
                max={cap}
                onChange={setQty}
                label={book.title}
              />
              <button
                type="button"
                className={buttonClass("solid")}
                onClick={() => {
                  add(book.id, safeQty, book.stock);
                  toast(`${book.title} is in the basket.`);
                }}
              >
                Add to basket
              </button>
            </div>
          ) : (
            <p className="mt-6 text-sm">
              <Link to="/stockroom" className="underline underline-offset-4">
                Restock it in the stockroom
              </Link>
            </p>
          )}
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 text-sm">
            <Spec k="Edition" v={`No. ${book.editionNo}`} />
            <Spec k="Format" v={book.format} />
            <Spec k="Pages" v={String(book.pages)} />
            <Spec k="Language" v={book.language} />
            <Spec k="Weight" v={formatWeight(book.weightG)} />
            <Spec k="Posted from" v="Jaipur" />
          </dl>
          <p className="mt-8 max-w-xl text-muted">{book.description}</p>
        </div>
      </div>
      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-3xl">Also in {book.tradition}</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4">
            {related.map((item) => (
              <BookCard key={item.id} book={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
