import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SITE_URL, PERSON } from "../src/lib/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair-display",
  display: "swap",
});

export const metadata = {
  title: "Mohammed Ashraf | Full-Stack Developer",
  description:
    "Portfolio of Mohammed Ashraf, a full-stack developer building responsive, animated, user-focused web experiences with React, Tailwind CSS, and GSAP.",
  authors: [{ name: "Mohammed Ashraf" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  applicationName: "Mohammed Ashraf Portfolio",
  appleWebApp: {
    title: "Mohammed Ashraf Portfolio",
  },
  formatDetection: {
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo.webp",
  },
  openGraph: {
    type: "website",
    siteName: "Mohammed Ashraf Portfolio",
    locale: "en_US",
    url: "/",
    title: "Mohammed Ashraf | Full-Stack Developer",
    description:
      "Explore projects by Mohammed Ashraf, focused on modern, performant full-stack development with React.",
    images: [
      {
        url: "/assets/myPortfolio.webp",
        width: 1897,
        height: 1032,
        type: "image/webp",
        alt: "Preview image from Mohammed Ashraf's full-stack portfolio projects.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mohammed Ashraf | Full-Stack Developer",
    description:
      "Portfolio of Mohammed Ashraf featuring modern React full-stack projects.",
    images: ["/assets/myPortfolio.webp"],
  },
};

export const viewport = {
  themeColor: "#000000",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Person",
    name: PERSON.name,
    jobTitle: PERSON.jobTitle,
    url: SITE_URL,
    sameAs: PERSON.sameAs,
    knowsAbout: PERSON.knowsAbout,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
