import type { Book } from "@/lib/catalog";

export type ShopSearch = {
  q: string;
  tradition: string;
  sort: "featured" | "price-asc" | "price-desc" | "title";
  stock: "all" | "in";
};

export function parseShopSearch(search: Record<string, unknown>): ShopSearch {
  const sort = search.sort;
  const stock = search.stock;
  return {
    q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
    tradition: typeof search.tradition === "string" ? search.tradition.slice(0, 48) : "all",
    sort:
      sort === "price-asc" || sort === "price-desc" || sort === "title" || sort === "featured"
        ? sort
        : "featured",
    stock: stock === "in" ? "in" : "all",
  };
}

export const openShelf: ShopSearch = {
  q: "",
  tradition: "all",
  sort: "featured",
  stock: "all",
};

export function filterBooks(books: Book[], search: ShopSearch) {
  const q = search.q.trim().toLowerCase();
  const list = books.filter((book) => {
    if (search.tradition !== "all" && book.tradition !== search.tradition) return false;
    if (search.stock === "in" && book.stock <= 0) return false;
    if (!q) return true;
    return [book.title, book.author, book.tradition, book.blurb]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  return list.sort((a, b) => {
    if (search.sort === "price-asc") return a.priceCents - b.priceCents;
    if (search.sort === "price-desc") return b.priceCents - a.priceCents;
    if (search.sort === "title") return a.title.localeCompare(b.title);
    return Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title);
  });
}
