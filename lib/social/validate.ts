/** Guestbook input checks (mirrors the database constraints: name 1-40, message 1-240). */

import { GUESTBOOK } from "./config";

export type GuestbookLocale = "en" | "ar";

export type GuestbookInput = {
  name: string;
  message: string;
  locale: GuestbookLocale;
  island: string | null;
};

export type ValidationError =
  "name_empty" | "name_long" | "message_empty" | "message_long";

export type ValidationResult =
  | { ok: true; value: GuestbookInput }
  | { ok: false; errors: ValidationError[] };

/** Control characters (except newline and tab) are dropped; ends are trimmed. */
export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
}

/** Length in user-perceived characters (an emoji counts once, like the counters show). */
export function charCount(text: string): number {
  return Array.from(text).length;
}

export function validateGuestbook(input: {
  name: string;
  message: string;
  locale: string;
  island?: string | null | undefined;
}): ValidationResult {
  const name = cleanText(input.name).replace(/\s+/g, " ");
  const message = cleanText(input.message);
  const errors: ValidationError[] = [];
  if (name.length === 0) errors.push("name_empty");
  else if (charCount(name) > GUESTBOOK.nameMax) errors.push("name_long");
  if (message.length === 0) errors.push("message_empty");
  else if (charCount(message) > GUESTBOOK.messageMax)
    errors.push("message_long");
  if (errors.length > 0) return { ok: false, errors };
  const island =
    input.island && /^[a-z0-9_-]{1,40}$/i.test(input.island)
      ? input.island
      : null;
  return {
    ok: true,
    value: {
      name,
      message,
      locale: input.locale === "ar" ? "ar" : "en",
      island,
    },
  };
}
