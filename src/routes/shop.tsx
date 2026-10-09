import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getCatalog } from "@/lib/shop";
import { TRADITIONS } from "@/lib/catalog";
import { filterBooks, parseShopSearch, type ShopSearch } from "@/lib/shop-search";
import { BookCard } from "@/components/book-card";
import { PagePending } from "@/components/pending";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/shop")({
  validateSearch: (search) => parseShopSearch(search),
  loader: () => getCatalog(),
  pendingComponent: () => <PagePending label="Opening the shelf" />,
  pendingMs: 200,
  head: () => ({ meta: [{ title: "The shelf — Divinity to your door" }] }),
  component: ShopPage,
});

function ShopPage() {
  const books = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const visible = filterBooks(books, search);

  function patch(next: Partial<ShopSearch>) {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs tracking-widest text-vermilion uppercase">The shelf</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Twelve editions, eight traditions.</h1>
      <p className="mt-3 max-w-xl text-muted">
        Search by title, author, or tradition. Sold-out copies stay visible so the cupboard stays honest.
      </p>

      <div className="mt-8 flex flex-col gap-4 border-y border-line py-4">
        <label className="block max-w-md">
          <span className="sr-only">Search editions</span>
          <input
            value={search.q}
            onChange={(event) => patch({ q: event.target.value })}
            placeholder="Gita, Rumi, psalms…"
            className="h-12 w-full border border-line bg-paper px-3 text-base"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={search.tradition === "all"} onClick={() => patch({ tradition: "all" })}>
            All
          </FilterChip>
          {TRADITIONS.map((tradition) => (
            <FilterChip
              key={tradition}
              active={search.tradition === tradition}
              onClick={() => patch({ tradition })}
            >
              {tradition}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">
            Sort
            <select
              value={search.sort}
              onChange={(event) => patch({ sort: event.target.value as ShopSearch["sort"] })}
              className="ml-2 h-11 border border-line bg-paper px-2 text-sm text-ink"
            >
              <option value="featured">Front table</option>
              <option value="title">Title</option>
              <option value="price-asc">Price, low</option>
              <option value="price-desc">Price, high</option>
            </select>
          </label>
          <button
            type="button"
            className={cn(
              "min-h-11 border px-4 text-sm",
              search.stock === "in" ? "border-ink bg-ink text-paper" : "border-line bg-paper",
            )}
            onClick={() => patch({ stock: search.stock === "in" ? "all" : "in" })}
            aria-pressed={search.stock === "in"}
          >
            In stock only
          </button>
          <p className="text-sm text-muted tabular-nums">{visible.length} editions</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-16">
          <h2 className="font-display text-3xl">Nothing under that name.</h2>
          <button
            type="button"
            className="mt-4 text-sm underline underline-offset-4"
            onClick={() => patch({ q: "", tradition: "all", sort: "featured", stock: "all" })}
          >
            Clear the filters
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 px-3 text-sm",
        active ? "bg-ink text-paper" : "border border-line bg-paper text-ink",
      )}
    >
      {children}
    </button>
  );
}
