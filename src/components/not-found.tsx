import { Link } from "@tanstack/react-router";
import { buttonClass } from "@/components/button";
import { openShelf } from "@/lib/shop-search";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <p className="text-xs tracking-widest text-vermilion uppercase">Missing</p>
      <h1 className="mt-3 font-display text-4xl">This page is not on the shelf.</h1>
      <p className="mt-4 text-muted">The book may have moved, or the address was mistyped.</p>
      <Link to="/shop" search={openShelf} className={buttonClass("solid", "mt-8")}>
        Browse the shelf
      </Link>
    </div>
  );
}
