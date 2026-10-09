import { Link } from "@tanstack/react-router";
import { openShelf } from "@/lib/shop-search";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl">Divinity</p>
          <p className="mt-2 max-w-xs text-sm text-sand">
            A small desk for religious books. Cloth editions, posted from Jaipur to wherever you read.
          </p>
        </div>
        <div>
          <p className="text-xs tracking-widest text-sand uppercase">Visit</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/shop" search={openShelf} className="hover:text-sand">The shelf</Link></li>
            <li><Link to="/orders" className="hover:text-sand">Orders on this device</Link></li>
            <li><Link to="/about" className="hover:text-sand">About the desk</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs tracking-widest text-sand uppercase">Desk</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/stockroom" className="hover:text-sand">Stockroom</Link></li>
            <li><Link to="/shipping" className="hover:text-sand">Shipping and returns</Link></li>
            <li><Link to="/cart" className="hover:text-sand">Basket</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-4 text-xs text-sand">
          © {new Date().getFullYear()} Divinity to your door. Demonstration shop — no real charges.
        </p>
      </div>
    </footer>
  );
}
