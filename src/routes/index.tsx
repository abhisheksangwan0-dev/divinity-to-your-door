import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CreditCard, Truck } from "lucide-react";
import { TRADITIONS, TRADITION_NOTE } from "@/lib/catalog";
import { getCatalog } from "@/lib/shop";
import { buttonClass } from "@/components/button";
import { BookCard } from "@/components/book-card";
import { PagePending } from "@/components/pending";
import { openShelf } from "@/lib/shop-search";
import { ZONES } from "@/lib/shipping";

export const Route = createFileRoute("/")({
  loader: () => getCatalog(),
  pendingComponent: () => <PagePending />,
  pendingMs: 200,
  component: Home,
});

function Home() {
  const books = Route.useLoaderData();
  const featured = books.filter((book) => book.featured);
  const traditions = TRADITIONS.map((name) => ({
    name,
    count: books.filter((book) => book.tradition === name).length,
  })).filter((item) => item.count > 0);

  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-end gap-10 px-5 pt-12 pb-6 lg:grid-cols-12 lg:pt-16">
        <div className="rise lg:col-span-6">
          <p className="text-xs tracking-widest text-vermilion uppercase">Divinity editions</p>
          <h1 className="mt-3 font-display text-5xl sm:text-6xl">
            Sacred reading, carried to your door.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            House editions of the world's religious books, sewn in cloth and posted from Jaipur.
            The number on each title is the number in the cupboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" search={openShelf} className={buttonClass("solid")}>
              Browse the shelf
            </Link>
            <Link to="/shipping" className={buttonClass("ghost")}>
              Shipping and the till
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6">
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Editions</dt>
              <dd className="font-display text-3xl tabular-nums">{books.length}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Traditions</dt>
              <dd className="font-display text-3xl tabular-nums">{traditions.length}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Regions</dt>
              <dd className="font-display text-3xl tabular-nums">{ZONES.length}</dd>
            </div>
          </dl>
        </div>
        <figure className="lg:col-span-6">
          <img
            src="/hero.jpg"
            alt="Clothbound books and a brass lamp on a linen table in late light."
            className="aspect-[16/10] w-full object-cover shadow-book"
          />
          <figcaption className="mt-3 text-sm text-muted">The bindery table, late light. Jaipur.</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl">Traditions</h2>
        </div>
        <ul className="mt-5 flex flex-wrap gap-2">
          {traditions.map((item) => (
            <li key={item.name}>
              <Link
                to="/shop"
                search={{ q: "", tradition: item.name, sort: "featured", stock: "all" }}
                className="inline-flex min-h-11 items-center gap-3 border border-line bg-paper px-4"
              >
                <span>{item.name}</span>
                <span className="hidden text-sm text-muted sm:inline">{TRADITION_NOTE[item.name]}</span>
                <span className="text-sm tabular-nums text-muted">{item.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl">On the front table</h2>
          <Link to="/shop" search={openShelf} className="text-sm underline decoration-line underline-offset-4 hover:decoration-vermilion">
            All editions
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3">
          {featured.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <p className="max-w-3xl font-display text-3xl sm:text-4xl">
          We would rather mark a book sold out than promise a copy we do not have.
        </p>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Truck,
              title: "Posted from Jaipur",
              body: "Six world regions, cotton wrap, a tracking note. South Asia ships free over $40.",
            },
            {
              icon: BookOpen,
              title: "One cupboard",
              body: "The shelf and the stockroom share a count. Restock a title and it returns at once.",
            },
            {
              icon: CreditCard,
              title: "Razorpay till",
              body: "UPI, cards, and netbanking. Prices are in dollars; the charge is in rupees. No monthly fee.",
            },
          ].map((item) => (
            <li key={item.title} className="border border-line bg-paper p-5">
              <item.icon className="size-5 text-vermilion" aria-hidden="true" />
              <h3 className="mt-4 font-display text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
