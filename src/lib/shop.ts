import { createServerFn } from "@tanstack/react-start";
import type { Book, OrderLine, PublicOrder, StockMove } from "@/lib/catalog";
import { shippingCents } from "@/lib/shipping";

type BookRow = {
  id: string;
  slug: string;
  title: string;
  author: string;
  tradition: string;
  language: string;
  format: string;
  pages: number | string;
  price_cents: number | string;
  stock: number | string;
  low_stock_at: number | string;
  blurb: string;
  description: string;
  cover: string;
  featured: boolean | string | number;
  edition_no: string;
  weight_g: number | string;
};

type OrderRow = {
  id: string;
  items: unknown;
  subtotal_cents: number | string;
  shipping_cents: number | string;
  total_cents: number | string;
  region: string;
  status: string;
  created_at: string;
};

const BOOK_COLUMNS = `id, slug, title, author, tradition, language, format, pages,
  price_cents, stock, low_stock_at, blurb, description, cover, featured, edition_no, weight_g`;

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function flag(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    tradition: row.tradition,
    language: row.language,
    format: row.format,
    pages: num(row.pages),
    priceCents: num(row.price_cents),
    stock: num(row.stock),
    lowStockAt: num(row.low_stock_at),
    blurb: row.blurb,
    description: row.description,
    cover: row.cover,
    featured: flag(row.featured),
    editionNo: row.edition_no,
    weightG: num(row.weight_g),
  };
}

function asItems(value: unknown): OrderLine[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.bookId !== "string" || typeof row.title !== "string") return [];
    const qty = num(row.qty);
    const priceCents = num(row.priceCents);
    if (!Number.isInteger(qty) || !Number.isInteger(priceCents)) return [];
    return [
      {
        bookId: row.bookId,
        slug: typeof row.slug === "string" ? row.slug : "",
        title: row.title,
        qty,
        priceCents,
      },
    ];
  });
}

function mapOrder(row: OrderRow): PublicOrder {
  return {
    id: row.id,
    items: asItems(row.items),
    subtotalCents: num(row.subtotal_cents),
    shippingCents: num(row.shipping_cents),
    totalCents: num(row.total_cents),
    region: row.region,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function sqlClient() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function loadBooks() {
  const sql = await sqlClient();
  const rows = await sql.query<BookRow>(
    `select ${BOOK_COLUMNS} from books order by featured desc, title asc`,
  );
  return rows.map(mapBook);
}

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => loadBooks());

export const getBookDetail = createServerFn({ method: "GET" })
  .validator((slug: unknown) => (typeof slug === "string" ? slug : ""))
  .handler(async ({ data: slug }) => {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
    const books = await loadBooks();
    const book = books.find((item) => item.slug === slug) ?? null;
    if (!book) return null;
    const related = books
      .filter((item) => item.tradition === book.tradition && item.id !== book.id)
      .slice(0, 4);
    return { book, related };
  });

export type PlaceOrderInput = {
  lines: { bookId: string; qty: number }[];
  zoneId: string;
};

function makeOrderId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 6; i += 1) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `DV-${tail}`;
}

export const placeOrder = createServerFn({ method: "POST" })
  .validator((input: PlaceOrderInput) => input)
  .handler(async ({ data }) => {
    const zoneId = data?.zoneId;
    const rawLines = Array.isArray(data?.lines) ? data.lines : [];
    if (typeof zoneId !== "string") {
      return { ok: false as const, message: "Choose a country so we know where to post it." };
    }
    const merged = new Map<string, number>();
    for (const line of rawLines) {
      if (!line || typeof line.bookId !== "string" || !/^[a-z0-9-]{1,40}$/.test(line.bookId)) {
        return { ok: false as const, message: "One of the books in the basket is not on our shelf." };
      }
      const qty = Number(line.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        return { ok: false as const, message: "Quantity has to be a whole number." };
      }
      merged.set(line.bookId, (merged.get(line.bookId) ?? 0) + qty);
    }
    const lines = [...merged.entries()].map(([bookId, qty]) => ({ bookId, qty }));
    if (lines.length < 1 || lines.length > 12) {
      return { ok: false as const, message: "Your basket is empty." };
    }
    if (lines.some((line) => line.qty > 4)) {
      return { ok: false as const, message: "We can send at most four copies of a title in one parcel." };
    }

    const sql = await sqlClient();
    const taken: { id: string; slug: string; title: string; qty: number; priceCents: number }[] = [];

    const restore = async () => {
      for (const item of taken) {
        await sql`update books set stock = stock + ${item.qty} where id = ${item.id}`;
      }
    };

    try {
      for (const line of lines) {
        const updated = await sql<{ id: string; slug: string; title: string; price_cents: number | string }>`
          update books
          set stock = stock - ${line.qty}
          where id = ${line.bookId} and stock >= ${line.qty}
          returning id, slug, title, price_cents
        `;
        const row = updated[0];
        if (!row) {
          const found = await sql<{ title: string; stock: number | string }>`
            select title, stock from books where id = ${line.bookId}
          `;
          await restore();
          const title = found[0]?.title ?? "A title";
          const stock = found[0] ? num(found[0].stock) : 0;
          const message =
            stock <= 0
              ? `${title} just sold out.`
              : `${title} has only ${stock} left.`;
          return { ok: false as const, message };
        }
        taken.push({
          id: row.id,
          slug: row.slug,
          title: row.title,
          qty: line.qty,
          priceCents: num(row.price_cents),
        });
      }
    } catch {
      await restore();
      return { ok: false as const, message: "The cupboard could not update. Try again." };
    }

    const items: OrderLine[] = taken.map((item) => ({
      bookId: item.id,
      slug: item.slug,
      title: item.title,
      qty: item.qty,
      priceCents: item.priceCents,
    }));
    const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    const postage = shippingCents(zoneId, itemCount, subtotalCents);
    if (postage === null) {
      await restore();
      return { ok: false as const, message: "We do not post to that destination yet." };
    }

    let id = makeOrderId();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await sql<{ id: string }>`select id from orders where id = ${id}`;
      if (!existing.length) break;
      id = makeOrderId();
    }

    try {
      await sql`
        insert into orders (id, items, subtotal_cents, shipping_cents, total_cents, region, status)
        values (
          ${id},
          ${JSON.stringify(items)},
          ${subtotalCents},
          ${postage},
          ${subtotalCents + postage},
          ${zoneId},
          'paid'
        )
      `;
    } catch {
      await restore();
      return { ok: false as const, message: "The till could not record this order. Nothing was kept." };
    }

    for (const item of taken) {
      await sql`
        insert into stock_moves (book_id, delta, reason)
        values (${item.id}, ${-item.qty}, 'sale')
      `;
    }

    const order: PublicOrder = {
      id,
      items,
      subtotalCents,
      shippingCents: postage,
      totalCents: subtotalCents + postage,
      region: zoneId,
      status: "paid",
      createdAt: new Date().toISOString(),
    };
    return { ok: true as const, order };
  });

export const getOrder = createServerFn({ method: "GET" })
  .validator((id: unknown) => (typeof id === "string" ? id : ""))
  .handler(async ({ data: id }) => {
    if (!/^DV-[A-Z0-9]{6}$/.test(id)) return null;
    const sql = await sqlClient();
    const rows = await sql<OrderRow>`
      select id, items, subtotal_cents, shipping_cents, total_cents, region, status,
             created_at::text as created_at
      from orders where id = ${id}
    `;
    return rows[0] ? mapOrder(rows[0]) : null;
  });

export const getStockroom = createServerFn({ method: "GET" }).handler(async () => {
  const books = await loadBooks();
  const sql = await sqlClient();
  const orderRows = await sql<OrderRow>`
    select id, items, subtotal_cents, shipping_cents, total_cents, region, status,
           created_at::text as created_at
    from orders
    order by created_at desc
    limit 30
  `;
  const totals = await sql<{ revenue: number | string; sales: number | string }>`
    select coalesce(sum(total_cents), 0) as revenue, count(*) as sales
    from orders where status = 'paid'
  `;
  const moveRows = await sql<{
    delta: number | string;
    reason: string;
    created_at: string;
    title: string;
  }>`
    select sm.delta, sm.reason, sm.created_at::text as created_at, b.title
    from stock_moves sm
    join books b on b.id = sm.book_id
    order by sm.id desc
    limit 12
  `;
  const moves: StockMove[] = moveRows.map((row) => ({
    title: row.title,
    delta: num(row.delta),
    reason: row.reason,
    createdAt: row.created_at,
  }));
  return {
    books,
    orders: orderRows.map(mapOrder),
    moves,
    units: books.reduce((sum, book) => sum + book.stock, 0),
    low: books.filter((book) => book.stock > 0 && book.stock <= book.lowStockAt).length,
    soldOut: books.filter((book) => book.stock === 0).length,
    revenueCents: num(totals[0]?.revenue),
    sales: num(totals[0]?.sales),
  };
});

export const adjustStock = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; delta: number }) => input)
  .handler(async ({ data }) => {
    if (!data || typeof data.bookId !== "string" || !/^[a-z0-9-]{1,40}$/.test(data.bookId)) {
      return { ok: false as const, message: "Unknown book." };
    }
    if (!Number.isInteger(data.delta) || data.delta === 0 || data.delta < -40 || data.delta > 80) {
      return { ok: false as const, message: "Adjust by a whole number from -40 to 80, not zero." };
    }
    const sql = await sqlClient();
    const rows = await sql.query<BookRow>(
      `update books set stock = stock + $1
       where id = $2 and stock + $1 between 0 and 500
       returning ${BOOK_COLUMNS}`,
      [data.delta, data.bookId],
    );
    if (!rows[0]) {
      const exists = await sql<{ id: string }>`select id from books where id = ${data.bookId}`;
      return {
        ok: false as const,
        message: exists.length
          ? "That would take the cupboard below zero or above 500."
          : "Unknown book.",
      };
    }
    await sql`
      insert into stock_moves (book_id, delta, reason)
      values (${data.bookId}, ${data.delta}, ${data.delta > 0 ? "restock" : "adjust"})
    `;
    return { ok: true as const, book: mapBook(rows[0]) };
  });

export const setPrice = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; priceCents: number }) => input)
  .handler(async ({ data }) => {
    if (!data || typeof data.bookId !== "string" || !/^[a-z0-9-]{1,40}$/.test(data.bookId)) {
      return { ok: false as const, message: "Unknown book." };
    }
    if (!Number.isInteger(data.priceCents) || data.priceCents < 800 || data.priceCents > 8000) {
      return { ok: false as const, message: "Price must sit between $8 and $80." };
    }
    const sql = await sqlClient();
    const rows = await sql.query<BookRow>(
      `update books set price_cents = $1 where id = $2 returning ${BOOK_COLUMNS}`,
      [data.priceCents, data.bookId],
    );
    if (!rows[0]) return { ok: false as const, message: "Unknown book." };
    return { ok: true as const, book: mapBook(rows[0]) };
  });

export const returnOrder = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    if (!data || typeof data.id !== "string" || !/^DV-[A-Z0-9]{6}$/.test(data.id)) {
      return { ok: false as const, message: "Unknown order." };
    }
    const sql = await sqlClient();
    const updated = await sql<{ items: unknown }>`
      update orders set status = 'returned'
      where id = ${data.id} and status = 'paid'
      returning items
    `;
    if (!updated[0]) {
      return {
        ok: false as const,
        message: "That order is already back on the shelf, or it does not exist.",
      };
    }
    for (const item of asItems(updated[0].items)) {
      await sql`
        update books set stock = least(500, stock + ${item.qty}) where id = ${item.bookId}
      `;
      await sql`
        insert into stock_moves (book_id, delta, reason)
        values (${item.bookId}, ${item.qty}, 'return')
      `;
    }
    return { ok: true as const, id: data.id };
  });
