import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __setSupabaseForTests,
  fetchGuestbook,
  submitGuestbook,
} from "./client";
import { GUESTBOOK } from "./config";
import { mapSocialError } from "./errors";
import { relativeTime } from "./time";
import { charCount, cleanText, validateGuestbook } from "./validate";

describe("validateGuestbook", () => {
  const base = { name: "Sam", message: "Hello", locale: "en" };

  it("trims and collapses the name, trims the message", () => {
    const r = validateGuestbook({
      ...base,
      name: "  Sam   Lee \n",
      message: "\n  Hi there!  ",
    });
    expect(r.ok && r.value).toMatchObject({
      name: "Sam Lee",
      message: "Hi there!",
    });
  });

  it("rejects empty and over-long fields (after trimming)", () => {
    const r = validateGuestbook({ ...base, name: "   ", message: "" });
    expect(r.ok ? [] : r.errors).toEqual(["name_empty", "message_empty"]);
    const long = validateGuestbook({
      ...base,
      name: "a".repeat(GUESTBOOK.nameMax + 1),
      message: "b".repeat(GUESTBOOK.messageMax + 1),
    });
    expect(long.ok ? [] : long.errors).toEqual(["name_long", "message_long"]);
  });

  it("accepts exactly the limits and counts emoji once", () => {
    const ok = validateGuestbook({
      ...base,
      name: "a".repeat(GUESTBOOK.nameMax),
      message: "😀".repeat(GUESTBOOK.messageMax),
    });
    expect(ok.ok).toBe(true);
    expect(charCount("😀😀")).toBe(2);
  });

  it("drops control characters and normalises locale and island", () => {
    expect(cleanText("a\u0000b\u0007c")).toBe("abc");
    const r = validateGuestbook({
      ...base,
      locale: "fr",
      island: "bad island!",
    });
    expect(r.ok && r.value).toMatchObject({ locale: "en", island: null });
    const ar = validateGuestbook({ ...base, locale: "ar", island: "home" });
    expect(ar.ok && ar.value).toMatchObject({ locale: "ar", island: "home" });
  });
});

describe("mapSocialError", () => {
  it("maps the trigger's rate limit", () => {
    expect(mapSocialError({ message: "rate_limited", code: "P0001" })).toBe(
      "rate_limited"
    );
    expect(mapSocialError({ status: 429 })).toBe("rate_limited");
  });

  it("maps network failures to offline", () => {
    expect(mapSocialError(new TypeError("Failed to fetch"))).toBe("offline");
    expect(mapSocialError({ message: "timeout", name: "AbortError" })).toBe(
      "offline"
    );
    expect(mapSocialError({ status: 503, message: "x" })).toBe("offline");
  });

  it("maps constraint violations to invalid, everything else to unknown", () => {
    expect(mapSocialError({ code: "23514", message: "check" })).toBe("invalid");
    expect(mapSocialError({ code: "42501", message: "rls" })).toBe("unknown");
    expect(mapSocialError(null)).toBe("unknown");
  });
});

describe("relativeTime", () => {
  it("formats past dates in the page locale", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(relativeTime("2026-10-18T09:00:00Z", now, "en")).toBe("3 hours ago");
    expect(relativeTime("2026-10-17T12:00:00Z", now, "en")).toBe("yesterday");
    expect(relativeTime("2026-10-18T11:59:50Z", now, "en")).toBe("now");
    expect(relativeTime("garbage", now, "en")).toBe("");
    expect(relativeTime("2026-10-18T09:00:00Z", now, "ar")).not.toBe("");
  });
});

/** A chainable fake of the bits of supabase-js the client uses. */
function fakeClient(result: unknown, calls: Record<string, unknown[]>) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "insert"]) {
    builder[m] = (...args: unknown[]) => {
      calls[m] = args;
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve(result);
  return {
    from: (table: string) => {
      calls.from = [table];
      return builder;
    },
  };
}

describe("guestbook client (mocked Supabase)", () => {
  afterEach(() => __setSupabaseForTests(undefined));

  it("selects approved rows with explicit columns, newest first, 20 max", async () => {
    const calls: Record<string, unknown[]> = {};
    const rows = [
      {
        id: "1",
        name: "A",
        message: "Hi",
        locale: "en",
        island: null,
        created_at: "2026-10-18T00:00:00Z",
      },
    ];
    __setSupabaseForTests(
      fakeClient({ data: rows, error: null }, calls) as never
    );
    const res = await fetchGuestbook();
    expect(res).toEqual({ ok: true, messages: rows });
    expect(calls.from).toEqual(["guestbook_messages"]);
    expect(calls.select?.[0]).toBe("id,name,message,locale,island,created_at");
    expect(String(calls.select?.[0])).not.toContain("*");
    // The anon role may not reference `approved`; RLS filters instead.
    expect(calls.eq).toBeUndefined();
    expect(calls.order).toEqual(["created_at", { ascending: false }]);
    expect(calls.limit).toEqual([20]);
  });

  it("inserts only the allowed fields and never reads back", async () => {
    const calls: Record<string, unknown[]> = {};
    __setSupabaseForTests(fakeClient({ error: null }, calls) as never);
    const res = await submitGuestbook({
      name: " Test ",
      message: "Hello",
      locale: "en",
      island: "home",
    });
    expect(res).toEqual({ ok: true });
    expect(calls.insert?.[0]).toEqual({
      name: "Test",
      message: "Hello",
      locale: "en",
      island: "home",
    });
    expect(calls.select).toBeUndefined();
  });

  it("reports rate limiting and offline errors", async () => {
    __setSupabaseForTests(
      fakeClient(
        { error: { message: "rate_limited", code: "P0001" } },
        {}
      ) as never
    );
    expect(
      await submitGuestbook({ name: "a", message: "b", locale: "en" })
    ).toEqual({ ok: false, error: "rate_limited" });
    __setSupabaseForTests(null);
    expect(await fetchGuestbook()).toEqual({ ok: false, error: "offline" });
  });

  it("refuses invalid input before touching the network", async () => {
    const from = vi.fn();
    __setSupabaseForTests({ from } as never);
    expect(
      await submitGuestbook({ name: "", message: "b", locale: "en" })
    ).toEqual({ ok: false, error: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });
});
