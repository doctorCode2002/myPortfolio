import { ImageResponse } from "next/og";

import { PERSON } from "@/lib/content/contact";
import { LOCALES, type Locale } from "@/lib/i18n";
import { siteConfig } from "@/lib/metadata";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${PERSON.name} — ${PERSON.jobTitle}`;

/** Without this the card renders on demand instead of at build time. */
export function generateStaticParams(): { lang: Locale }[] {
  return LOCALES.map((lang) => ({ lang }));
}

/**
 * One card for both locales, deliberately. Satori does not shape Arabic script
 * correctly — joined letterforms come out disconnected — so the share card
 * stays Latin-only rather than shipping broken Arabic to every social preview.
 * Only the default `next/og` font is used, so there are no font fetches here.
 */
export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14110F",
          padding: "72px 80px",
        }}
      >
        <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
          <path d="M22 18 L50 34 L78 18 L78 34 L50 50 L22 34 Z" fill="#F5F2E9" />
          <path d="M22 38 L38 47 L38 78 L30 84 L22 78 Z" fill="#F5F2E9" />
          <path d="M78 38 L78 78 L70 84 L62 78 L62 47 Z" fill="#F5F2E9" />
          <path d="M43 45 L50 49 L57 45 L57 62 L50 67 L43 62 Z" fill="#F5F2E9" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              width: 96,
              height: 6,
              background: "#C0562A",
              borderRadius: 3,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 82,
              color: "#EDE7DC",
              letterSpacing: -2,
            }}
          >
            {PERSON.name}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#9A9086" }}>
            Full-Stack Developer &amp; Frontend Instructor
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#C0562A" }}>
            {siteConfig.url.replace("https://", "")}
          </div>
        </div>
      </div>
    ),
    size
  );
}
