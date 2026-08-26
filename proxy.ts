import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

/**
 * Parse an Accept-Language header and return the best supported locale.
 * Hand-rolled rather than pulling in Negotiator + intl-localematcher: with two
 * locales and no regional variants, q-sorted prefix matching is the whole job.
 */
function pickLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((entry) => entry.tag !== "" && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (base !== undefined && isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  const first = pathname.split("/")[1];
  if (first !== undefined && isLocale(first)) return undefined;

  const locale = pickLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, static assets, and anything with a file
  // extension (/assets/CV.pdf, /logo.webp, /sitemap.xml, /robots.txt).
  //
  // `apple-icon` and friends are metadata routes that Next serves without a
  // file extension, so they need naming explicitly — otherwise they look like
  // pages and get redirected into a locale that has no such route.
  matcher: [
    "/((?!_next|assets|api|apple-icon|icon|opengraph-image|twitter-image|manifest|.*\\..*).*)",
  ],
};
