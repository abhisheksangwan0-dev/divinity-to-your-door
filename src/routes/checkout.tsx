import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { beginPayment, getCatalog, getCheckoutConfig, placeOrder } from "@/lib/shop";
import { basketProblem, priceLines, useCart } from "@/lib/cart";
import { formatInr, formatMoney } from "@/lib/format";
import { COUNTRIES, FREE_SOUTH_ASIA_CENTS, shippingCents, zoneById } from "@/lib/shipping";
import { saveReceipt } from "@/lib/receipts";
import { buttonClass } from "@/components/button";
import { Field, inputClass } from "@/components/field";
import { PagePending } from "@/components/pending";
import { openShelf } from "@/lib/shop-search";

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

function loadRazorpay() {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay only opens in the browser."));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise<NonNullable<Window["Razorpay"]>>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay did not load."));
    };
    script.onerror = () => reject(new Error("Razorpay did not load."));
    document.body.appendChild(script);
  });
}

export const Route = createFileRoute("/checkout")({
  loader: async () => {
    const [books, pay] = await Promise.all([getCatalog(), getCheckoutConfig()]);
    return { books, pay };
  },
  head: () => ({ meta: [{ title: "Checkout — Divinity to your door" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { books, pay } = Route.useLoaderData();
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
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "processing">("idle");

  const countryRow = COUNTRIES.find((item) => item.name === country) ?? null;
  const zone = countryRow ? zoneById(countryRow.zone) : null;
  const postage =
    zone && itemCount > 0 ? shippingCents(zone.id, itemCount, subtotal) : null;
  const total = postage === null ? null : subtotal + postage;
  const inr =
    total !== null && pay.ready && pay.rate ? formatInr(Math.round(total * pay.rate)) : null;

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

  async function payNow(event: FormEvent) {
    event.preventDefault();
    if (phase === "processing") return;
    setError("");
    if (!pay.ready) {
      setError("Razorpay is not connected, so this till cannot take money yet.");
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError("Enter the name we should write on the parcel.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter an email for the receipt.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      setError("Enter a phone number the courier can call.");
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
    const opened = await beginPayment({
      data: {
        zoneId: zone.id,
        lines: priced.map((item) => ({ bookId: item.book.id, qty: item.line.qty })),
      },
    });
    if (!opened.ok) {
      setError(opened.message);
      setPhase("idle");
      return;
    }
    try {
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: opened.keyId,
        order_id: opened.orderId,
        amount: opened.paise,
        currency: "INR",
        name: "Divinity to your door",
        description: "Books posted from Jaipur",
        prefill: { name: name.trim(), email: email.trim(), contact: phone.trim() },
        theme: { color: "#9C341F" },
        handler: (response: RazorpaySuccess) => {
          void (async () => {
            const result = await placeOrder({
              data: {
                zoneId: zone.id,
                lines: priced.map((item) => ({ bookId: item.book.id, qty: item.line.qty })),
                payment: {
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                },
                ship: {
                  name: name.trim(),
                  email: email.trim(),
                  phone: phone.trim(),
                  street: address.trim(),
                  city: city.trim(),
                  postal: postal.trim(),
                  country,
                },
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
              phone: phone.trim(),
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
              cardBrand: result.method,
              cardLast4: result.last4,
            });
            clear();
            void navigate({ to: "/order/$id", params: { id: result.order.id } });
          })();
        },
        modal: {
          ondismiss: () => {
            setPhase("idle");
          },
        },
      });
      checkout.on("payment.failed", (response) => {
        setError(response.error?.description || "Razorpay declined this payment. Nothing was reserved.");
        setPhase("idle");
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Razorpay did not open.");
      setPhase("idle");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="font-display text-4xl">Checkout</h1>
      <p className="mt-2 max-w-xl text-muted">
        The desk keeps your name, phone, and address so the parcel can be posted. Razorpay takes the payment. This shop never sees the card or UPI pin.
      </p>
      {!pay.ready ? (
        <p className="mt-4 max-w-xl border border-line bg-ivory px-4 py-3 text-sm">
          The till is not taking money yet. Razorpay still needs to be connected, so this parcel cannot be paid.
        </p>
      ) : null}
      <form onSubmit={payNow} className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="order-2 space-y-8 lg:order-1 lg:col-span-7">
          <fieldset className="space-y-4">
            <legend className="font-display text-2xl">Where it should arrive</legend>
            <Field label="Full name">
              <input className={inputClass()} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </Field>
            <Field label="Phone" hint="The courier calls this number. It is stored with the parcel, not on the card.">
              <input className={inputClass()} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" required />
            </Field>
            <Field label="Email" hint="Sent to Razorpay with the payment. The receipt on this device uses it too.">
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
            <legend className="font-display text-2xl">Payment</legend>
            <div className="border border-line bg-ivory px-4 py-3 text-sm">
              {pay.ready ? (
                <>
                  <p className="font-medium">Razorpay</p>
                  <p className="mt-1 text-muted">
                    UPI, cards, and netbanking. Shelf prices stay in dollars. The charge is in rupees
                    {inr ? ` — about ${inr} at today's rate` : ""}. No monthly fee. Razorpay's cut comes out of the payment, not a bill to the desk.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Razorpay is not connected</p>
                  <p className="mt-1 text-muted">
                    The till will take money after the Razorpay key id and secret are added. Nothing can be charged until then.
                  </p>
                </>
              )}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="text-sm text-vermilion">
              {error}
            </p>
          ) : null}
          <button type="submit" className={buttonClass("solid")} disabled={phase === "processing" || Boolean(problem) || !pay.ready}>
            {phase === "processing" ? "Opening Razorpay…" : inr ? `Pay ${inr}` : total !== null ? `Pay ${formatMoney(total)}` : "Pay"}
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
            {inr ? (
              <div className="flex justify-between text-muted">
                <dt>Charged</dt>
                <dd className="tabular-nums">{inr}</dd>
              </div>
            ) : null}
          </dl>
          {problem ? <p className="mt-4 text-sm text-vermilion">{problem}</p> : null}
        </aside>
      </form>
    </main>
  );
}
