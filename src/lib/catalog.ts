export type Book = {
  id: string;
  slug: string;
  title: string;
  author: string;
  tradition: string;
  language: string;
  format: string;
  pages: number;
  priceCents: number;
  stock: number;
  lowStockAt: number;
  blurb: string;
  description: string;
  cover: string;
  featured: boolean;
  editionNo: string;
  weightG: number;
};

export type OrderLine = {
  bookId: string;
  slug: string;
  title: string;
  qty: number;
  priceCents: number;
};

export type PublicOrder = {
  id: string;
  items: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  region: string;
  status: string;
  createdAt: string;
};

export type StockMove = {
  title: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export const TRADITIONS = [
  "Hindu",
  "Christian",
  "Islamic",
  "Sikh",
  "Jewish",
  "Buddhist",
  "Taoist",
  "Sufi",
] as const;

export const TRADITION_NOTE: Record<string, string> = {
  Hindu: "Gita, Upanishads, Ramayana",
  Christian: "Scripture and the inward life",
  Islamic: "A study companion to the Qur'an",
  Sikh: "The morning prayer",
  Jewish: "Torah and the psalms",
  Buddhist: "Verses of the Buddha",
  Taoist: "The book of the way",
  Sufi: "Odes of longing",
};
