import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "divinity_desk";

function password() {
  return process.env.STOCKROOM_PASSWORD?.trim() ?? "";
}

function seal() {
  const secret = password();
  if (secret.length < 8) return "";
  return createHmac("sha256", secret).update("divinity-desk-v1").digest("hex");
}

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function deskOpen() {
  const expected = seal();
  if (!expected) return false;
  const { getCookie } = await import("@tanstack/react-start/server");
  return same(getCookie(COOKIE) ?? "", expected);
}

export async function unlockDesk(attempt: string) {
  const secret = password();
  if (secret.length < 8) {
    return { ok: false as const, message: "The stockroom has no passphrase yet." };
  }
  if (!same(attempt, secret)) {
    return { ok: false as const, message: "That passphrase does not open the stockroom." };
  }
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(COOKIE, seal(), {
    path: "/",
    httpOnly: true,
    secure: process.env.VERCEL === "1",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
  });
  return { ok: true as const };
}
