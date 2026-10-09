import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Book } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { CoverArt } from "@/components/cover";

export function BookCard({ book }: { book: Book }) {
  const add = useCart((state) => state.add);
  const inBasket = useCart((state) => state.lines.find((line) => line.bookId === book.id)?.qty ?? 0);
  const low = book.stock > 0 && book.stock <= book.lowStockAt;

  return (
    <article className="flex h-full flex-col">
      <Link
        to="/book/$slug"
        params={{ slug: book.slug }}
        className="group block"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-ink shadow-book">
          <div className="h-full transition-transform duration-300 ease-out group-hover:scale-[1.03]">
            <CoverArt book={book} />
          </div>
          {book.stock === 0 ? (
            <span className="absolute top-3 left-3 bg-ink px-2 py-1 text-xs tracking-wide text-paper uppercase">
              Sold out
            </span>
          ) : null}
          {low ? (
            <span className="absolute top-3 left-3 bg-paper px-2 py-1 text-xs tracking-wide text-vermilion uppercase">
              {book.stock} left
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-xs tracking-widest text-vermilion uppercase">{book.tradition}</p>
        <h3 className="mt-1 font-display text-xl">{book.title}</h3>
        <p className="text-sm text-muted">{book.author}</p>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="tabular-nums">{formatMoney(book.priceCents)}</p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center px-1 text-sm underline decoration-line underline-offset-4 hover:decoration-vermilion disabled:no-underline disabled:opacity-40"
          disabled={book.stock === 0 || inBasket >= Math.min(4, book.stock)}
          onClick={() => {
            const cap = Math.min(4, book.stock);
            if (inBasket >= cap) {
              toast("That is all we can send of this title.");
              return;
            }
            add(book.id, 1, book.stock);
            toast(`${book.title} is in the basket.`);
          }}
        >
          {book.stock === 0 ? "Sold out" : inBasket > 0 ? "Add another" : "Add"}
        </button>
      </div>
    </article>
  );
}
