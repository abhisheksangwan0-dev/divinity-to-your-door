import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobNotFoundError,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  del,
  get,
  head,
  put,
} from "@vercel/blob";
import { dbSource, getSql } from "@/lib/db";

const DATA = "cupboard.dat";
const LOCK = "cupboard.lock";

type BookSnap = { id: string; stock: number; priceCents: number };
type OrderSnap = {
  id: string;
  items: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  region: string;
  status: string;
  createdAt: string;
  paymentId: string | null;
  buyerName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postal: string;
  country: string;
};
type MoveSnap = { bookId: string; delta: number; reason: string; createdAt: string };
type Snapshot = { v: 1; books: BookSnap[]; orders: OrderSnap[]; moves: MoveSnap[] };
type Remote = { kind: "missing" } | { kind: "bad" } | { kind: "ok"; state: Snapshot; etag: string };

const g = globalThis as typeof globalThis & {
  __cupboardTail?: Promise<unknown>;
  __cupboardEtag?: string;
};

function enabled() {
  return dbSource === "pglite" && Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function key() {
  return createHash("sha256").update(token()).digest();
}

function seal(snapshot: Snapshot) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function open(payload: string): Snapshot | null {
  try {
    const raw = Buffer.from(payload, "base64");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const body = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(json) as Snapshot;
    if (parsed?.v !== 1 || !Array.isArray(parsed.books) || parsed.books.length === 0) return null;
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.moves)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function queue<T>(task: () => Promise<T>): Promise<T> {
  const tail = g.__cupboardTail ?? Promise.resolve();
  const run = tail.then(task, task);
  g.__cupboardTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fatal(err: unknown) {
  return (
    err instanceof BlobAccessError ||
    err instanceof BlobStoreNotFoundError ||
    err instanceof BlobStoreSuspendedError ||
    err instanceof BlobClientTokenExpiredError
  );
}

async function streamText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

/** Latest snapshot, or "same" when this server already applied that etag. */
async function pull(): Promise<Remote | "same"> {
  try {
    const result = await get(DATA, {
      access: "private",
      useCache: false,
      ...(g.__cupboardEtag ? { ifNoneMatch: g.__cupboardEtag } : {}),
    });
    if (!result) return { kind: "missing" };
    if (result.statusCode === 304) return "same";
    const state = open(await streamText(result.stream));
    if (!state) return { kind: "bad" };
    return { kind: "ok", state, etag: result.blob.etag };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return { kind: "missing" };
    throw err;
  }
}

async function snapshot(): Promise<Snapshot> {
  const sql = await getSql();
  const books = await sql<{ id: string; stock: number | string; price_cents: number | string }>`
    select id, stock, price_cents from books order by id
  `;
  const orders = await sql<Record<string, unknown>>`
    select id, items, subtotal_cents, shipping_cents, total_cents, region, status,
           created_at::text as created_at, payment_id, buyer_name, email, phone,
           street, city, postal, country
    from orders
    order by created_at
  `;
  const moves = await sql<{ book_id: string; delta: number | string; reason: string; created_at: string }>`
    select book_id, delta, reason, created_at::text as created_at
    from stock_moves
    order by id
  `;
  return {
    v: 1,
    books: books.map((row) => ({
      id: row.id,
      stock: clamp(num(row.stock), 0, 500),
      priceCents: clamp(num(row.price_cents), 100, 50000),
    })),
    orders: orders.map((row) => ({
      id: text(row.id),
      items: text(row.items),
      subtotalCents: num(row.subtotal_cents),
      shippingCents: num(row.shipping_cents),
      totalCents: num(row.total_cents),
      region: text(row.region),
      status: text(row.status) === "returned" ? "returned" : "paid",
      createdAt: text(row.created_at),
      paymentId: row.payment_id == null || row.payment_id === "" ? null : text(row.payment_id),
      buyerName: text(row.buyer_name),
      email: text(row.email),
      phone: text(row.phone),
      street: text(row.street),
      city: text(row.city),
      postal: text(row.postal),
      country: text(row.country),
    })),
    moves: moves.map((row) => ({
      bookId: row.book_id,
      delta: num(row.delta),
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

async function apply(state: Snapshot) {
  const sql = await getSql();
  await sql`begin`;
  try {
    for (const book of state.books) {
      if (!/^[a-z0-9-]{1,40}$/.test(book.id)) continue;
      await sql`
        update books
        set stock = ${clamp(book.stock, 0, 500)}, price_cents = ${clamp(book.priceCents, 100, 50000)}
        where id = ${book.id}
      `;
    }
    await sql`delete from stock_moves`;
    await sql`delete from orders`;
    for (const order of state.orders) {
      if (!/^DV-[A-Z0-9]{6}$/.test(order.id)) continue;
      const status = order.status === "returned" ? "returned" : "paid";
      await sql`
        insert into orders (
          id, items, subtotal_cents, shipping_cents, total_cents, region, status,
          created_at, payment_id, buyer_name, email, phone, street, city, postal, country
        ) values (
          ${order.id},
          ${order.items},
          ${Math.round(order.subtotalCents)},
          ${Math.round(order.shippingCents)},
          ${Math.round(order.totalCents)},
          ${order.region},
          ${status},
          ${order.createdAt || new Date().toISOString()},
          ${order.paymentId},
          ${order.buyerName},
          ${order.email},
          ${order.phone},
          ${order.street},
          ${order.city},
          ${order.postal},
          ${order.country}
        )
      `;
    }
    for (const move of state.moves) {
      if (!/^[a-z0-9-]{1,40}$/.test(move.bookId)) continue;
      await sql`
        insert into stock_moves (book_id, delta, reason, created_at)
        values (${move.bookId}, ${Math.round(move.delta)}, ${move.reason}, ${move.createdAt || new Date().toISOString()})
      `;
    }
    await sql`commit`;
  } catch (err) {
    await sql`rollback`;
    throw err;
  }
}

async function push() {
  const body = seal(await snapshot());
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const saved = await put(DATA, body, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "text/plain",
        cacheControlMaxAge: 60,
      });
      return saved.etag;
    } catch (err) {
      last = err;
      await sleep(200 * (attempt + 1));
    }
  }
  throw last instanceof Error ? last : new Error("The cupboard could not be saved.");
}

async function acquire() {
  const id = randomUUID();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      await put(LOCK, id, {
        access: "private",
        allowOverwrite: false,
        addRandomSuffix: false,
        contentType: "text/plain",
        cacheControlMaxAge: 60,
      });
      return id;
    } catch (err) {
      if (fatal(err)) throw err;
      let uploadedAt = 0;
      try {
        const meta = await head(LOCK);
        uploadedAt = new Date(meta.uploadedAt).getTime();
      } catch (headErr) {
        if (headErr instanceof BlobNotFoundError) throw err;
        throw headErr;
      }
      if (!uploadedAt || Date.now() - uploadedAt > 20_000) {
        await del(LOCK).catch(() => undefined);
        continue;
      }
      await sleep(120 + attempt * 40);
    }
  }
  throw new Error("The cupboard is busy. Try again.");
}

async function release(id: string) {
  try {
    const result = await get(LOCK, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return;
    if ((await streamText(result.stream)) === id) await del(LOCK);
  } catch (err) {
    if (err instanceof BlobNotFoundError) return;
  }
}

async function adopt(remote: Remote | "same") {
  if (remote === "same") return;
  if (remote.kind === "bad") throw new Error("The cupboard could not be opened.");
  if (remote.kind === "ok") {
    await apply(remote.state);
    g.__cupboardEtag = remote.etag;
  }
}

/** Load the shared cupboard. No-op when a real database, or Blob, is not configured. */
export async function readCupboard() {
  if (!enabled()) return;
  try {
    await queue(async () => {
      const remote = await pull();
      if (remote === "same") return;
      if (remote.kind === "bad") {
        console.error("[cupboard] snapshot could not be opened");
        return;
      }
      if (remote.kind === "ok") {
        await apply(remote.state);
        g.__cupboardEtag = remote.etag;
        return;
      }
      const id = await acquire();
      try {
        const again = await pull();
        if (again === "same") return;
        if (again.kind === "ok") {
          await apply(again.state);
          g.__cupboardEtag = again.etag;
        } else if (again.kind === "missing") {
          g.__cupboardEtag = await push();
        }
      } finally {
        await release(id);
      }
    });
  } catch (err) {
    console.error("[cupboard] read failed", err instanceof Error ? err.message : err);
  }
}

/** Run a stock change against the latest shared cupboard, then save it. */
export async function holdCupboard<T>(task: () => Promise<T>): Promise<T> {
  if (!enabled()) return task();
  return queue(async () => {
    const id = await acquire();
    try {
      await adopt(await pull());
      const result = await task();
      g.__cupboardEtag = await push();
      return result;
    } catch (err) {
      g.__cupboardEtag = undefined;
      const remote = await pull().catch(() => null);
      if (remote && remote !== "same" && remote.kind === "ok") {
        await apply(remote.state).catch(() => undefined);
        g.__cupboardEtag = remote.etag;
      }
      throw err;
    } finally {
      await release(id);
    }
  });
}
