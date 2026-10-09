import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { getCatalog, placeOrder } from "@/lib/shop";
import { basketProblem, priceLines, useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { COUNTRIES, FREE_SOUTH_ASIA_CENTS, shippingCents, zoneById } from "@/lib/shipping";
import { formatCardNumber, formatExpiry, onlyDigits, validateCard } from "@/lib/payment";
import { saveReceipt } from "@/lib/receipts";
import { buttonClass } from "@/components/button";
import { Field, inputClass } from "@/components/field";
import { PagePending } from "@/components/pending";
import { openShelf } from "@/lib/shop-search";

export const Route = createFileRoute("/checkout")({
  loader: () => getCatalog(),
  head: () => ({ meta: [{ title: "Checkout — Divinity to your door" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const books = Route.useLoaderData();
  const navigate = useNavigate();
  const hydrated = useCart((state) => state.hydrated);
  const lines = useCart((state) => state.lines);
  const clear = useCart((state) => state.clear);
  const priced = priceLines(books, lines);
  const subtotal = priced.reduce((sum, item) => sum + item.lineCents, 0);
  const itemCount = priced.reduce((sum, item) => sum + item.line.qty, 0);
  const problem = basketProblem(priced);

  const [country, setCountry] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "processing">("idle");

  const countryRow = COUNTRIES.find((item) => item.name === country) ?? null;
  const zone = countryRow ? zoneById(countryRow.zone) : null;
  const postage =
    zone && itemCount > 0 ? shippingCents(zone.id, itemCount, subtotal) : null;
  const total = postage === null ? null : subtotal + postage;

  if (!hydrated) return <PagePending label="Preparing the till" />;

  if (priced.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-4xl">Nothing to pay for.</h1>
        <Link to="/shop" search={openShelf} className={buttonClass("solid", "mt-6")}>
          Browse the shelf
        </Link>
      </main>
    );
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (phase === "processing") return;
    setError("");
    if (!name.trim() || name.trim().length < 2) {
      setError("Enter the name we should write on the parcel.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter an email for the receipt on this device.");
      return;
    }
    if (address.trim().length < 4 || city.trim().length < 2 || postal.trim().length < 2) {
      setError("Enter a street, city, and postal code.");
      return;
    }
    if (!zone || postage === null || total === null) {
      setError("Choose a country we post to.");
      return;
    }
    if (problem) {
      setError(problem);
      return;
    }
    setPhase("processing");
    await new Promise((resolve) => setTimeout(resolve, 800));
    const card = validateCard({ name: cardName, number: cardNumber, expiry, cvc });
    if (!card.ok) {
      setError(card.message);
      setPhase("idle");
      return;
    }
    const result = await placeOrder({
      data: {
        zoneId: zone.id,
        lines: priced.map((item) => ({ bookId: item.book.id, qty: item.line.qty })),
      },
    });
    if (!result.ok) {
      setError(result.message);
      setPhase("idle");
      return;
    }
    saveReceipt({
      id: result.order.id,
      placedAt: result.order.createdAt,
      buyerName: name.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      postal: postal.trim(),
      country,
      zoneName: zone.name,
      eta: zone.eta,
      lines: result.order.items.map((item) => ({
        ...item,
        cover: books.find((book) => book.id === item.bookId)?.cover ?? "",
      })),
      subtotalCents: result.order.subtotalCents,
      shippingCents: result.order.shippingCents,
      totalCents: result.order.totalCents,
      cardBrand: card.brand,
      cardLast4: card.last4,
    });
    clear();
    void navigate({ to: "/order/$id", params: { id: result.order.id } });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="font-display text-4xl">Checkout</h1>
      <p className="mt-2 max-w-xl text-muted">
        Your name and address stay in this browser. The shop records the books, the region, and the total.
      </p>
      <form onSubmit={pay} className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="order-2 space-y-8 lg:order-1 lg:col-span-7">
          <fieldset className="space-y-4">
            <legend className="font-display text-2xl">Where it should arrive</legend>
            <Field label="Full name">
              <input className={inputClass()} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </Field>
            <Field label="Email" hint="Used only for the receipt stored on this device.">
              <input className={inputClass()} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
            </Field>
            <Field label="Street">
              <input className={inputClass()} value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="address-line1" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City">
                <input className={inputClass()} value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required />
              </Field>
              <Field label="Postal code">
                <input className={inputClass()} value={postal} onChange={(event) => setPostal(event.target.value)} autoComplete="postal-code" required />
              </Field>
            </div>
            <Field label="Country">
              <select
                className={inputClass()}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
              >
                <option value="">Choose a country</option>
                {COUNTRIES.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            {zone && postage !== null ? (
              <p className="text-sm text-muted">
                {zone.name} · {zone.eta} · {postage === 0 ? "Shipping on us" : formatMoney(postage)}
                {zone.id === "south-asia" && subtotal < FREE_SOUTH_ASIA_CENTS
                  ? ` · free over ${formatMoney(FREE_SOUTH_ASIA_CENTS)}`
                  : ""}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="font-display text-2xl">Card</legend>
            <div className="border border-line bg-ivory px-4 py-3 text-sm">
              <p className="font-medium">Demonstration cards</p>
              <p className="mt-1 text-muted">
                Approve with 4242 4242 4242 4242 or 5555 5555 5555 4444. Decline with 4000 0000 0000 0002.
                Any future expiry, any security code. Nothing is charged.
              </p>
            </div>
            <Field label="Name on card">
              <input className={inputClass()} value={cardName} onChange={(event) => setCardName(event.target.value)} autoComplete="cc-name" required />
            </Field>
            <Field label="Card number">
              <input
                className={inputClass("tabular-nums")}
                value={cardNumber}
                onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry">
                <input
                  className={inputClass("tabular-nums")}
                  value={expiry}
                  onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  required
                />
              </Field>
              <Field label="Security code">
                <input
                  className={inputClass("tabular-nums")}
                  value={cvc}
                  onChange={(event) => setCvc(onlyDigits(event.target.value).slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  required
                />
              </Field>
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="text-sm text-vermilion">
              {error}
            </p>
          ) : null}
          <button type="submit" className={buttonClass("solid")} disabled={phase === "processing" || Boolean(problem)}>
            {phase === "processing" ? "Speaking to the till…" : total !== null ? `Pay ${formatMoney(total)}` : "Pay"}
          </button>
        </div>

        <aside className="order-1 h-fit border border-line bg-paper p-5 lg:sticky lg:top-24 lg:order-2 lg:col-span-5">
          <h2 className="font-display text-2xl">Order</h2>
          <ul className="mt-4 space-y-3">
            {priced.map(({ book, line, lineCents }) => (
              <li key={book.id} className="flex justify-between gap-3 text-sm">
                <span>
                  {line.qty} × {book.title}
                </span>
                <span className="tabular-nums">{formatMoney(lineCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="tabular-nums">{postage === null ? "—" : postage === 0 ? "Free" : formatMoney(postage)}</dd>
            </div>
            <div className="flex justify-between font-display text-2xl">
              <dt>Total</dt>
              <dd className="tabular-nums">{total === null ? "—" : formatMoney(total)}</dd>
            </div>
          </dl>
          {problem ? <p className="mt-4 text-sm text-vermilion">{problem}</p> : null}
        </aside>
      </form>
    </main>
  );
}
