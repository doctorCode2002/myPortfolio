"""Compose Obsidian-style project presentation images.

Each real project screenshot is placed in a dark browser frame on a shared
generated obsidian backdrop, so every card reads as one family.

usage: python3 scripts/compose-work-images.py design/work-backdrop.webp public/assets/work <backdrop.png> <out_dir> <id>=<screenshot>|<domain> ...
       an id may instead be  <id>=cutout:<transparent.png>  for a floating object
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FG = (237, 232, 224)
CHROME = (22, 22, 23)
EMBER = (255, 90, 31)
MONO = str(Path.home() / ".local/share/fonts/Geist/GeistMono[wght].ttf")


def cover(img: Image.Image, w: int, h: int) -> Image.Image:
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def rounded_mask(size: tuple[int, int], r: int) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m


def backdrop(path: str) -> Image.Image:
    bg = cover(Image.open(path).convert("RGB"), W, H)
    # Slightly deeper blacks so the frame is the brightest thing on the card.
    dark = Image.new("RGB", (W, H), (11, 11, 12))
    return Image.blend(bg, dark, 0.25)


def shadow(canvas: Image.Image, box: tuple[int, int, int, int], r: int) -> None:
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.rounded_rectangle((x0 + 10, y0 + 40, x1 - 10, y1 + 50), r, fill=(0, 0, 0, 210))
    sh = sh.filter(ImageFilter.GaussianBlur(48))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((x0 + 80, y1 - 60, x1 - 80, y1 + 30), r, fill=(*EMBER, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    canvas.alpha_composite(glow)
    canvas.alpha_composite(sh)


def browser(canvas: Image.Image, shot_path: str, domain: str) -> None:
    fw, bar, r = 1440, 44, 16
    shot = Image.open(shot_path).convert("RGB")
    sh_h = round(fw * 9 / 16)  # 16:9 viewport, matching the screenshots
    shot = cover(shot, fw, sh_h)
    fh = bar + sh_h
    x0, y0 = (W - fw) // 2, (H - fh) // 2 - 6
    shadow(canvas, (x0, y0, x0 + fw, y0 + fh), r)

    frame = Image.new("RGBA", (fw, fh), (*CHROME, 255))
    frame.paste(shot, (0, bar))
    d = ImageDraw.Draw(frame)
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        cx = 24 + i * 22
        d.ellipse((cx - 6, bar // 2 - 6, cx + 6, bar // 2 + 6), fill=(*c, 150))
    pill_w = 420
    px0 = (fw - pill_w) // 2
    d.rounded_rectangle((px0, 10, px0 + pill_w, bar - 10), 9, fill=(34, 34, 36))
    font = ImageFont.truetype(MONO, 15)
    font.set_variation_by_axes([450])
    tw = d.textlength(domain, font=font)
    d.text(((fw - tw) / 2, bar / 2), domain, font=font, fill=(*FG, 170), anchor="lm")
    d.line((0, bar - 1, fw, bar - 1), fill=(255, 255, 255, 18))

    framed = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    framed.paste(frame, (0, 0), rounded_mask((fw, fh), r))
    border = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle((0, 0, fw - 1, fh - 1), r, outline=(*FG, 34), width=2)
    framed.alpha_composite(border)
    canvas.alpha_composite(framed, (x0, y0))


def cutout(canvas: Image.Image, path: str) -> None:
    obj = Image.open(path).convert("RGBA")
    bbox = obj.getbbox()
    if bbox:
        obj = obj.crop(bbox)
    s = min(1500 / obj.width, 900 / obj.height)
    obj = obj.resize((round(obj.width * s), round(obj.height * s)), Image.LANCZOS)
    x0, y0 = (W - obj.width) // 2, (H - obj.height) // 2 - 10
    alpha = obj.getchannel("A")
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    blob = Image.new("RGBA", obj.size, (0, 0, 0, 200))
    sh.paste(blob, (x0 + 24, y0 + 46), alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(obj, (x0, y0))


def main() -> None:
    bg_path, out = sys.argv[1], Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    base = backdrop(bg_path)
    for spec in sys.argv[3:]:
        pid, rest = spec.split("=", 1)
        canvas = base.convert("RGBA")
        if rest.startswith("cutout:"):
            cutout(canvas, rest.removeprefix("cutout:"))
        else:
            shot, domain = rest.split("|", 1)
            browser(canvas, shot, domain)
        dst = out / f"{pid}.webp"
        canvas.convert("RGB").save(dst, "WEBP", quality=86, method=6)
        print(dst, dst.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
