import { createServerFn } from "@tanstack/react-start";
import type { Book, OrderLine, PublicOrder, StockMove } from "@/lib/catalog";
import { COUNTRIES, shippingCents } from "@/lib/shipping";

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

async function refreshCupboard() {
  const { readCupboard } = await import("@/lib/cupboard");
  await readCupboard();
}

function withCupboard<T>(task: () => Promise<T>) {
  return import("@/lib/cupboard").then(({ holdCupboard }) => holdCupboard(task));
}

async function loadBooks() {
  const sql = await sqlClient();
  const rows = await sql.query<BookRow>(
    `select ${BOOK_COLUMNS} from books order by featured desc, title asc`,
  );
  return rows.map(mapBook);
}

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await refreshCupboard();
  return loadBooks();
});

export const getBookDetail = createServerFn({ method: "GET" })
  .validator((slug: unknown) => (typeof slug === "string" ? slug : ""))
  .handler(async ({ data: slug }) => {
    await refreshCupboard();
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
  payment?: { orderId: string; paymentId: string; signature: string };
  ship?: {
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    postal: string;
    country: string;
  };
};

export type DeskOrder = PublicOrder & {
  buyerName: string;
  email: string;
  street: string;
  city: string;
  postal: string;
  country: string;
  phone: string;
};

type Basket =
  | { ok: false; message: string }
  | {
      ok: true;
      lines: { bookId: string; qty: number }[];
      zoneId: string;
      items: OrderLine[];
      subtotalCents: number;
      postage: number;
      totalCents: number;
    };

function makeOrderId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 6; i += 1) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `DV-${tail}`;
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanShip(ship: PlaceOrderInput["ship"], zoneId: string) {
  const name = clip(ship?.name, 80);
  const email = clip(ship?.email, 120);
  const street = clip(ship?.street, 160);
  const city = clip(ship?.city, 80);
  const postal = clip(ship?.postal, 16);
  const country = clip(ship?.country, 80);
  const phone = clip(ship?.phone, 20);
  const phoneDigits = phone.replace(/\D/g, "");
  const countryRow = COUNTRIES.find((item) => item.name === country);
  if (name.length < 2) return { ok: false as const, message: "Enter the name we should write on the parcel." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, message: "Enter an email for the parcel." };
  }
  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    return { ok: false as const, message: "Enter a phone number the courier can call." };
  }
  if (street.length < 4 || city.length < 2 || postal.length < 2) {
    return { ok: false as const, message: "Enter a street, city, and postal code." };
  }
  if (!countryRow || countryRow.zone !== zoneId) {
    return { ok: false as const, message: "Choose a country we post to." };
  }
  return { ok: true as const, ship: { name, email, phone, street, city, postal, country } };
}

async function requireDesk() {
  const desk = await import("@/lib/desk.server");
  if (!(await desk.deskOpen())) {
    return { ok: false as const, message: "The stockroom is locked." };
  }
  return null;
}

async function prepareBasket(data: PlaceOrderInput | undefined): Promise<Basket> {
  const zoneId = data?.zoneId;
  const rawLines = Array.isArray(data?.lines) ? data.lines : [];
  if (typeof zoneId !== "string") {
    return { ok: false, message: "Choose a country so we know where to post it." };
  }
  const merged = new Map<string, number>();
  for (const line of rawLines) {
    if (!line || typeof line.bookId !== "string" || !/^[a-z0-9-]{1,40}$/.test(line.bookId)) {
      return { ok: false, message: "One of the books in the basket is not on our shelf." };
    }
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      return { ok: false, message: "Quantity has to be a whole number." };
    }
    merged.set(line.bookId, (merged.get(line.bookId) ?? 0) + qty);
  }
  const lines = [...merged.entries()].map(([bookId, qty]) => ({ bookId, qty }));
  if (lines.length < 1 || lines.length > 12) {
    return { ok: false, message: "Your basket is empty." };
  }
  if (lines.some((line) => line.qty > 4)) {
    return { ok: false, message: "We can send at most four copies of a title in one parcel." };
  }

  const books = await loadBooks();
  const items: OrderLine[] = [];
  for (const line of lines) {
    const book = books.find((item) => item.id === line.bookId);
    if (!book) return { ok: false, message: "One of the books in the basket is not on our shelf." };
    if (book.stock < line.qty) {
      return {
        ok: false,
        message: book.stock <= 0 ? `${book.title} just sold out.` : `${book.title} has only ${book.stock} left.`,
      };
    }
    items.push({
      bookId: book.id,
      slug: book.slug,
      title: book.title,
      qty: line.qty,
      priceCents: book.priceCents,
    });
  }
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const postage = shippingCents(zoneId, itemCount, subtotalCents);
  if (postage === null) {
    return { ok: false, message: "We do not post to that destination yet." };
  }
  return { ok: true, lines, zoneId, items, subtotalCents, postage, totalCents: subtotalCents + postage };
}

export const getCheckoutConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { razorpayReady, usdInrRate } = await import("@/lib/razorpay.server");
  if (!razorpayReady()) return { ready: false as const, rate: null };
  try {
    return { ready: true as const, rate: await usdInrRate() };
  } catch {
    return { ready: true as const, rate: null };
  }
});

export const beginPayment = createServerFn({ method: "POST" })
  .validator((input: PlaceOrderInput) => input)
  .handler(async ({ data }) => {
    await refreshCupboard();
    const basket = await prepareBasket(data);
    if (!basket.ok) return basket;
    try {
      const pay = await import("@/lib/razorpay.server");
      if (!pay.razorpayReady()) {
        return { ok: false as const, message: "Razorpay is not connected, so this till cannot take money yet." };
      }
      const rate = await pay.usdInrRate();
      const paise = pay.usdCentsToPaise(basket.totalCents, rate);
      const opened = await pay.createRazorpayOrder({
        paise,
        usdCents: basket.totalCents,
        zoneId: basket.zoneId,
        lines: basket.lines.map((line) => `${line.bookId}:${line.qty}`).join(","),
        receipt: makeOrderId(),
      });
      return {
        ok: true as const,
        keyId: opened.keyId,
        orderId: opened.orderId,
        paise,
        rate,
        usdCents: basket.totalCents,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Razorpay could not open.";
      return { ok: false as const, message };
    }
  });

export const placeOrder = createServerFn({ method: "POST" })
  .validator((input: PlaceOrderInput) => input)
  .handler(async ({ data }) => {
    await refreshCupboard();
    const basket = await prepareBasket(data);
    if (!basket.ok) return basket;
    const payment = data?.payment;
    if (
      !payment ||
      typeof payment.orderId !== "string" ||
      typeof payment.paymentId !== "string" ||
      typeof payment.signature !== "string"
    ) {
      return { ok: false as const, message: "Pay with Razorpay before the parcel is reserved." };
    }

    const pay = await import("@/lib/razorpay.server");
    let confirmed: { method: string; last4: string };
    try {
      confirmed = await pay.confirmRazorpayPayment({
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        signature: payment.signature,
        expectedUsdCents: basket.totalCents,
        expectedZone: basket.zoneId,
        expectedLines: basket.lines.map((line) => `${line.bookId}:${line.qty}`).join(","),
      });
    } catch (err) {
      if (err instanceof pay.PaidButRejected) {
        try {
          await pay.refundRazorpayPayment(payment.paymentId);
          return { ok: false as const, message: `${err.message} The payment was refunded.` };
        } catch {
          return {
            ok: false as const,
            message: `${err.message} Quote ${payment.paymentId} so it can be returned.`,
          };
        }
      }
      const message = err instanceof Error ? err.message : "Razorpay could not confirm this payment.";
      return { ok: false as const, message };
    }

    return withCupboard(async () => {
      const fresh = await prepareBasket(data);
      const refund = async (message: string) => {
        try {
          await pay.refundRazorpayPayment(payment.paymentId);
          return { ok: false as const, message: `${message} The payment was refunded.` };
        } catch {
          return {
            ok: false as const,
            message: `${message} The payment could not be refunded automatically. Quote ${payment.paymentId} and we will return it.`,
          };
        }
      };
      if (!fresh.ok) return refund(fresh.message);
      if (fresh.totalCents !== basket.totalCents || fresh.zoneId !== basket.zoneId) {
        return refund("The shelf changed while the payment was opening.");
      }

      const sql = await sqlClient();
      const taken: { id: string; qty: number }[] = [];
      const restore = async () => {
        for (const item of taken) {
          await sql`update books set stock = stock + ${item.qty} where id = ${item.id}`;
        }
      };
      const undo = async (message: string) => {
        await restore();
        return refund(message);
      };

      const ship = cleanShip(data?.ship, fresh.zoneId);
      if (!ship.ok) return refund(ship.message);

      try {
        for (const line of fresh.lines) {
          const updated = await sql<{ id: string; title: string }>`
            update books
            set stock = stock - ${line.qty}
            where id = ${line.bookId} and stock >= ${line.qty}
            returning id, title
          `;
          const row = updated[0];
          if (!row) {
            const found = await sql<{ title: string; stock: number | string }>`
              select title, stock from books where id = ${line.bookId}
            `;
            const title = found[0]?.title ?? "A title";
            const stock = found[0] ? num(found[0].stock) : 0;
            const message = stock <= 0 ? `${title} just sold out.` : `${title} has only ${stock} left.`;
            return undo(message);
          }
          taken.push({ id: row.id, qty: line.qty });
        }
      } catch {
        return undo("The cupboard could not update.");
      }

      let id = makeOrderId();
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const existing = await sql<{ id: string }>`select id from orders where id = ${id}`;
        if (!existing.length) break;
        id = makeOrderId();
      }

      try {
        await sql`
          insert into orders (
            id, items, subtotal_cents, shipping_cents, total_cents, region, status, payment_id,
            buyer_name, email, phone, street, city, postal, country
          )
          values (
            ${id},
            ${JSON.stringify(fresh.items)},
            ${fresh.subtotalCents},
            ${fresh.postage},
            ${fresh.totalCents},
            ${fresh.zoneId},
            'paid',
            ${payment.paymentId},
            ${ship.ship.name},
            ${ship.ship.email},
            ${ship.ship.phone},
            ${ship.ship.street},
            ${ship.ship.city},
            ${ship.ship.postal},
            ${ship.ship.country}
          )
        `;
      } catch (err) {
        const textError = err instanceof Error ? err.message : "";
        const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
        if (code === "23505" || textError.includes("orders_payment_id_idx") || textError.toLowerCase().includes("duplicate")) {
          await restore();
          return { ok: false as const, message: "This payment was already used for an order." };
        }
        return undo("The till could not record this order.");
      }

      try {
        for (const item of taken) {
          await sql`
            insert into stock_moves (book_id, delta, reason)
            values (${item.id}, ${-item.qty}, 'sale')
          `;
        }
      } catch {
        await sql`delete from orders where id = ${id}`;
        return undo("The till could not record this order.");
      }

      const order: PublicOrder = {
        id,
        items: fresh.items,
        subtotalCents: fresh.subtotalCents,
        shippingCents: fresh.postage,
        totalCents: fresh.totalCents,
        region: fresh.zoneId,
        status: "paid",
        createdAt: new Date().toISOString(),
      };
      return { ok: true as const, order, method: confirmed.method, last4: confirmed.last4 };
    });
  });

export const getOrder = createServerFn({ method: "GET" })
  .validator((id: unknown) => (typeof id === "string" ? id : ""))
  .handler(async ({ data: id }) => {
    if (!/^DV-[A-Z0-9]{6}$/.test(id)) return null;
    await refreshCupboard();
    const sql = await sqlClient();
    const rows = await sql<OrderRow>`
      select id, items, subtotal_cents, shipping_cents, total_cents, region, status,
             created_at::text as created_at
      from orders where id = ${id}
    `;
    return rows[0] ? mapOrder(rows[0]) : null;
  });

export const unlockStockroom = createServerFn({ method: "POST" })
  .validator((input: { password?: string }) => input)
  .handler(async ({ data }) => {
    const desk = await import("@/lib/desk.server");
    return desk.unlockDesk(typeof data?.password === "string" ? data.password : "");
  });

export const getStockroom = createServerFn({ method: "GET" }).handler(async () => {
  const locked = await requireDesk();
  if (locked) return { locked: true as const };
  await refreshCupboard();
  const books = await loadBooks();
  const sql = await sqlClient();
  const orderRows = await sql<
    OrderRow & {
      buyer_name: string;
      email: string;
      phone: string;
      street: string;
      city: string;
      postal: string;
      country: string;
    }
  >`
    select id, items, subtotal_cents, shipping_cents, total_cents, region, status,
           created_at::text as created_at, buyer_name, email, phone, street, city, postal, country
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
    locked: false as const,
    books,
    orders: orderRows.map((row) => ({
      ...mapOrder(row),
      buyerName: row.buyer_name,
      email: row.email,
      phone: row.phone,
      street: row.street,
      city: row.city,
      postal: row.postal,
      country: row.country,
    })),
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
  .handler(async ({ data }) => withCupboard(async () => {
    const locked = await requireDesk();
    if (locked) return locked;
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
  }));

export const setPrice = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; priceCents: number }) => input)
  .handler(async ({ data }) => withCupboard(async () => {
    const locked = await requireDesk();
    if (locked) return locked;
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
  }));

export const returnOrder = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => withCupboard(async () => {
    const locked = await requireDesk();
    if (locked) return locked;
    if (!data || typeof data.id !== "string" || !/^DV-[A-Z0-9]{6}$/.test(data.id)) {
      return { ok: false as const, message: "Unknown order." };
    }
    const sql = await sqlClient();
    const existing = await sql<{ items: unknown; payment_id: string | null }>`
      select items, payment_id from orders where id = ${data.id} and status = 'paid'
    `;
    if (!existing[0]) {
      return {
        ok: false as const,
        message: "That order is already back on the shelf, or it does not exist.",
      };
    }
    if (existing[0].payment_id) {
      try {
        const pay = await import("@/lib/razorpay.server");
        await pay.refundRazorpayPayment(existing[0].payment_id);
      } catch {
        return {
          ok: false as const,
          message: "Razorpay did not refund this payment, so the books stayed sold.",
        };
      }
    }
    const updated = await sql<{ items: unknown }>`
      update orders set status = 'returned'
      where id = ${data.id} and status = 'paid'
      returning items
    `;
    if (!updated[0]) {
      return { ok: false as const, message: "That order is already back on the shelf." };
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
  }));
