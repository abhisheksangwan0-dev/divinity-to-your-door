import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Book } from "@/lib/catalog";

export type CartLine = { bookId: string; qty: number };

type CartState = {
  lines: CartLine[];
  drawerOpen: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (bookId: string, qty?: number, max?: number) => number;
  setQty: (bookId: string, qty: number, max?: number) => void;
  remove: (bookId: string) => void;
  clear: () => void;
};

const CAP = 4;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      drawerOpen: false,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
      add: (bookId, qty = 1, max = CAP) => {
        let added = 0;
        set((state) => {
          const cap = Math.min(CAP, Math.max(0, max));
          const existing = state.lines.find((line) => line.bookId === bookId);
          const nextQty = Math.min(cap, (existing?.qty ?? 0) + qty);
          added = nextQty - (existing?.qty ?? 0);
          if (added < 1) return state;
          const lines = existing
            ? state.lines.map((line) =>
                line.bookId === bookId ? { ...line, qty: nextQty } : line,
              )
            : [...state.lines, { bookId, qty: nextQty }];
          return { lines, drawerOpen: true };
        });
        return added;
      },
      setQty: (bookId, qty, max = CAP) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.bookId === bookId
              ? { ...line, qty: Math.max(1, Math.min(Math.min(CAP, Math.max(1, max)), qty)) }
              : line,
          ),
        })),
      remove: (bookId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.bookId !== bookId) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "divinity-cart",
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => {
        const saved = persisted as { lines?: CartLine[] };
        return {
          ...current,
          lines: current.lines.length > 0 ? current.lines : (saved.lines ?? []),
        };
      },
    },
  ),
);

export function priceLines(books: Book[], lines: CartLine[]) {
  return lines.flatMap((line) => {
    const book = books.find((item) => item.id === line.bookId);
    if (!book) return [];
    return [{ line, book, lineCents: book.priceCents * line.qty }];
  });
}

export function basketProblem(
  priced: { line: CartLine; book: Book }[],
): string | null {
  const over = priced.find((item) => item.line.qty > item.book.stock);
  if (!over) return null;
  if (over.book.stock <= 0) return `${over.book.title} has sold out. Remove it to continue.`;
  return `${over.book.title} has only ${over.book.stock} left. Lower the quantity.`;
}
