# Vendored components

Copied from public shadcn-style registries so they can be edited freely:

- `reactbits/` — React Bits (https://reactbits.dev), `*-TS-TW` variants. MIT.
  Noise (film grain), ScrollVelocity (marquee), SpotlightCard, Magnet.
- `componentry/` — Componentry by Harsh Jadhav (https://componentry.dev). MIT.
  GrainGradient (hero WebGL). `framer-motion` imports were rewritten to
  `motion/react`, `@/lib/utils` to `@/lib/cn`.

Files carry `// @ts-nocheck`: upstream code is not written for this repo's
`exactOptionalPropertyTypes` / `noUncheckedIndexedAccess` settings.
