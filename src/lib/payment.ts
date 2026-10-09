const APPROVE = new Set(["4242424242424242", "5555555555554444"]);
const DECLINE = new Set(["4000000000000002"]);

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCardNumber(value: string) {
  return onlyDigits(value)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

export function formatExpiry(value: string) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function cardBrand(number: string) {
  if (number.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(number)) return "Mastercard";
  return "Card";
}

function luhn(number: string) {
  let sum = 0;
  let alt = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (alt) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export type CardCheck =
  | { ok: true; brand: string; last4: string }
  | { ok: false; message: string };

export function validateCard(input: {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
}): CardCheck {
  if (input.name.trim().length < 2) {
    return { ok: false, message: "Enter the name on the card." };
  }
  const number = onlyDigits(input.number);
  if (number.length < 15 || number.length > 16 || !luhn(number)) {
    return { ok: false, message: "That card number does not pass a basic check." };
  }
  const match = input.expiry.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return { ok: false, message: "Enter the expiry as MM/YY." };
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return { ok: false, message: "That expiry month is not real." };
  if (new Date(year, month, 1) <= new Date()) {
    return { ok: false, message: "That card is expired." };
  }
  const cvc = onlyDigits(input.cvc);
  if (cvc.length < 3 || cvc.length > 4) {
    return { ok: false, message: "Enter the security code." };
  }
  if (DECLINE.has(number)) {
    return {
      ok: false,
      message: "The till declined this card. Try 4242 4242 4242 4242.",
    };
  }
  if (!APPROVE.has(number)) {
    return {
      ok: false,
      message:
        "This desk only takes demonstration cards: 4242 4242 4242 4242 or 5555 5555 5555 4444.",
    };
  }
  return { ok: true, brand: cardBrand(number), last4: number.slice(-4) };
}
