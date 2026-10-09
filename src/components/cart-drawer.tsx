import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { getCatalog } from "@/lib/shop";
import { basketProblem, priceLines, useCart } from "@/lib/cart";
import { openShelf } from "@/lib/shop-search";
import { formatMoney } from "@/lib/format";
import { buttonClass } from "@/components/button";
import type { Book } from "@/lib/catalog";
import { CoverArt } from "@/components/cover";
import { QtyStepper } from "@/components/qty-stepper";

export function CartDrawer() {
  const open = useCart((state) => state.drawerOpen);
  const closeDrawer = useCart((state) => state.closeDrawer);
  const openDrawer = useCart((state) => state.openDrawer);
  const lines = useCart((state) => state.lines);
  const setQty = useCart((state) => state.setQty);
  const remove = useCart((state) => state.remove);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getCatalog().then((catalog) => {
      if (!cancelled) setBooks(catalog);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const priced = priceLines(books, lines);
  const subtotal = priced.reduce((sum, item) => sum + item.lineCents, 0);
  const problem = basketProblem(priced);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? openDrawer() : closeDrawer())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="cart-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-paper shadow-book">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-2xl">Basket</Dialog.Title>
            <Dialog.Close className="inline-flex size-11 items-center justify-center" aria-label="Close basket">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Books you intend to order. Shipping is worked out at checkout.
          </Dialog.Description>
          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center px-5">
              <p className="font-display text-3xl">The basket is empty.</p>
              <Link to="/shop" search={openShelf} className={buttonClass("solid", "mt-6 self-start")} onClick={closeDrawer}>
                Browse the shelf
              </Link>
            </div>
          ) : (
            <>
              <ul className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {priced.map(({ line, book }) => (
                  <li key={book.id} className="flex gap-3">
                    <Link
                      to="/book/$slug"
                      params={{ slug: book.slug }}
                      className="block h-24 w-16 shrink-0 overflow-hidden bg-ink"
                      onClick={closeDrawer}
                    >
                      <CoverArt book={book} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-lg leading-tight">{book.title}</p>
                          <p className="text-sm text-muted tabular-nums">{formatMoney(book.priceCents)}</p>
                        </div>
                        <button
                          type="button"
                          className="text-sm text-muted underline underline-offset-4"
                          onClick={() => remove(book.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2">
                        {book.stock > 0 ? (
                          <QtyStepper
                            value={Math.min(line.qty, book.stock)}
                            max={Math.min(4, book.stock)}
                            onChange={(next) => setQty(book.id, next, book.stock)}
                            label={book.title}
                          />
                        ) : (
                          <p className="text-sm text-vermilion">Sold out</p>
                        )}
                      </div>
                      {book.stock < line.qty ? (
                        <p className="mt-2 text-sm text-vermilion">
                          {book.stock <= 0 ? "Sold out." : `Only ${book.stock} left.`}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-5 py-4">
                {problem ? <p className="mb-3 text-sm text-vermilion">{problem}</p> : null}
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Subtotal</span>
                  <span className="font-display text-2xl tabular-nums">{formatMoney(subtotal)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">Shipping is calculated from your country.</p>
                <Link
                  to="/checkout"
                  onClick={(event) => {
                    if (problem) event.preventDefault();
                    else closeDrawer();
                  }}
                  className={buttonClass("solid", "mt-4 w-full")}
                >
                  Checkout
                </Link>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
