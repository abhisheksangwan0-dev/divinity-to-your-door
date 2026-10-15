import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonClass } from "@/components/button";
import { openShelf } from "@/lib/shop-search";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — Divinity to your door" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs tracking-widest text-vermilion uppercase">The desk</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Booksellers, not a pulpit.</h1>
      <div className="mt-6 space-y-4 text-lg">
        <p>
          Divinity to your door prints house editions of texts people have carried for centuries, and posts them from Jaipur.
        </p>
        <p>
          We are not a temple, a church, a mosque, or a seminary. We are a small shelf. Hindu, Christian, Islamic, Sikh, Jewish, Buddhist, Taoist, and Sufi books sit beside each other because readers do.
        </p>
        <p>
          The Qur'an volume is an English study companion. The Arabic recitation remains the sacred text. Japji is set with a facing English so a new reader can follow, not so the translation can replace the prayer.
        </p>
        <p>
          Stock is one number. If a title says sold out, the cupboard is empty until someone restocks it. Checkout charges in rupees through Razorpay. The card and UPI pin stay with Razorpay. Your name and address stay on this device.
        </p>
      </div>
      <Link to="/shop" search={openShelf} className={buttonClass("solid", "mt-8")}>
        Browse the shelf
      </Link>
    </main>
  );
}
