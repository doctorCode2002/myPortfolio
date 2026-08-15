# Mohammed Ashraf — Portfolio

A single-page portfolio site: hero, services, about, project work, testimonials, mentor profile,
student reviews, and contact — all rendered on one scrollable page with anchor-linked navigation.

## Stack

- [Next.js 16](https://nextjs.org) (App Router), statically exported (`output: "export"`)
- React 19
- Tailwind CSS v4, via `@tailwindcss/postcss`
- GSAP + `@gsap/react` for scroll-driven animation (`ScrollTrigger`)
- [Lenis](https://github.com/darkroomengineering/lenis) for smooth scrolling

The site builds to a fully static export — no server rendering, no dynamic data, no backend.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (Next.js, Turbopack) |
| `npm run build` | Production build — static export written to `out/` |
| `npm run start` | Serve the static export locally (`serve out`) |
| `npm run lint` | Run ESLint |

There is no test suite configured.

## Content

All page content — nav links, project entries, testimonials, mentor stats, student reviews, and
contact links — is exported from `src/constants/index.js`. Edit that file to change what the site
shows; components consume it directly.

## Deployment

The site is a static export intended for Vercel. Since `output: "export"` produces a fully static
`out/` directory, no additional deployment configuration is required.
