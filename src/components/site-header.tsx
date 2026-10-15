import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/cn";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <path
        d="M6 28V14.5C6 8.7 10.2 5 16 5s10 3.7 10 9.5V28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 28V18h8v10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="14" r="1.35" className="fill-vermilion" />
    </svg>
  );
}

const LINKS = [
  { to: "/shop", label: "Shelf" },
  { to: "/orders", label: "Orders" },
  { to: "/shipping", label: "Shipping" },
] as const;

export function SiteHeader() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const count = useCart((state) => state.lines.reduce((sum, line) => sum + line.qty, 0));
  const hydrated = useCart((state) => state.hydrated);
  const openDrawer = useCart((state) => state.openDrawer);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setOpen(false);
    void navigate({
      to: "/shop",
      search: { q: query.trim(), tradition: "all", sort: "featured", stock: "all" },
    });
  }

  return (
    <div>
      <p className="bg-vermilion px-5 py-2 text-center text-sm text-paper">
        Cloth editions, posted from Jaipur. South Asia ships free over $40.
      </p>
      <header className="sticky top-0 z-30 border-b border-line bg-ivory/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link to="/" className="flex items-center gap-2 text-ink">
            <Mark />
            <span className="leading-none">
              <span className="block font-display text-lg">Divinity</span>
              <span className="block text-xs tracking-wide text-muted">to your door</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 md:flex" aria-label="Shop">
            {LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? "page" : undefined}
                  className={cn("text-sm", active ? "text-ink" : "text-muted hover:text-ink")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 flex-1 md:block md:max-w-xs">
            <label className="relative block">
              <span className="sr-only">Search the shelf</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles"
                className="h-11 w-full rounded-full border border-line bg-paper pr-3 pl-9 text-sm"
              />
            </label>
          </form>
          <button
            type="button"
            className="ml-auto inline-flex size-11 items-center justify-center md:ml-0"
            onClick={openDrawer}
            aria-label={hydrated && count > 0 ? `Basket, ${count} copies` : "Basket"}
          >
            <ShoppingBag className="size-5" />
            {hydrated && count > 0 ? (
              <span className="ml-1 text-sm tabular-nums">{count}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open ? (
          <div className="border-t border-line px-5 py-4 md:hidden">
            <form onSubmit={submitSearch}>
              <label className="block">
                <span className="sr-only">Search the shelf</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles"
                  className="h-12 w-full rounded-xl border border-line bg-paper px-3 text-base"
                />
              </label>
            </form>
            <nav className="mt-3 grid" aria-label="Shop">
              {LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="flex min-h-11 items-center text-base">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>
    </div>
  );
}
