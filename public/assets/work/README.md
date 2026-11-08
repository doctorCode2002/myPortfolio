# Work images

Every project card image is the project's **real screenshot** framed in a dark
browser window on one shared obsidian backdrop, so all cards read as a family.
1920×1080 WebP.

- Backdrop: `design/work-backdrop.webp` (AI-generated, obsidian glass lit by an
  ember glow).
- Composer: `scripts/compose-work-images.py` (needs Python + Pillow and the
  Geist Mono font). Example:

      python3 scripts/compose-work-images.py design/work-backdrop.webp public/assets/work \
        "waco=path/to/screenshot.png|waco.sa" \
        "teryaq=cutout:path/to/transparent.png"

  `id=<screenshot>|<domain>` frames a screenshot (domain shown in the address
  bar, use the real one); `id=cutout:<png>` floats a background-removed object.
