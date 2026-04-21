#!/usr/bin/env python3
"""Generates the Morpho Enhancements extension icons.

Design decision:
- Use Morpho's own butterfly mark as the base so the extension reads as a
  companion layer to the actual app, not a third-party rewrite.
- Overlay a small green "+" accent badge at the top-right corner on sizes
  big enough to render detail (>=32 px). The badge signals "enhancement" —
  this is Morpho + something extra.
- 16px drops the badge entirely so the icon reads as a clean silhouette at
  browser toolbar sizes.

Input base: scripts/morpho-base.svg (official Morpho favicon from
https://cdn.morpho.org/v2/assets/images/favicon.svg)
"""
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent.parent
BASE_SVG = Path(__file__).parent / 'morpho-base.svg'
OUT_DIR = ROOT / 'public' / 'icons'
OUT_DIR.mkdir(parents=True, exist_ok=True)

BADGE_GREEN = (34, 197, 94, 255)        # tailwind emerald-500
BADGE_GREEN_DARK = (22, 163, 74, 255)   # emerald-600 (rim)
WHITE = (255, 255, 255, 255)


def render_base(size: int) -> Image.Image:
    """Rasterize the Morpho butterfly mark at the requested pixel size."""
    png_bytes = cairosvg.svg2png(
        url=str(BASE_SVG),
        output_width=size,
        output_height=size,
    )
    from io import BytesIO
    return Image.open(BytesIO(png_bytes)).convert('RGBA')


def draw_badge(img: Image.Image) -> None:
    """Paint a small green '+' badge at the top-right corner, in place."""
    S = img.size[0]
    # Badge geometry — tuned to read clearly without dominating.
    r = int(S * 0.22)
    cx = S - r - int(S * 0.04)
    cy = r + int(S * 0.04)

    d = ImageDraw.Draw(img)
    # White halo so the badge separates from the blue bg regardless of theme.
    halo = max(2, int(S * 0.02))
    d.ellipse(
        [cx - r - halo, cy - r - halo, cx + r + halo, cy + r + halo],
        fill=WHITE,
    )
    # Rim for depth.
    rim = max(1, int(S * 0.015))
    d.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=BADGE_GREEN_DARK,
    )
    d.ellipse(
        [cx - r + rim, cy - r + rim, cx + r - rim, cy + r - rim],
        fill=BADGE_GREEN,
    )
    # Plus mark.
    arm = int(r * 0.55)
    stroke = max(1, int(r * 0.22))
    d.rectangle([cx - arm, cy - stroke // 2, cx + arm, cy + stroke // 2 + 1], fill=WHITE)
    d.rectangle([cx - stroke // 2, cy - arm, cx + stroke // 2 + 1, cy + arm], fill=WHITE)


def make(size: int) -> Image.Image:
    # Supersample 2x for crisper badge edges on small sizes, then downsample.
    supersample = 2 if size <= 48 else 1
    S = size * supersample
    canvas = render_base(S)
    if size >= 32:
        draw_badge(canvas)
    if supersample > 1:
        canvas = canvas.resize((size, size), Image.LANCZOS)
    return canvas


def write_svg() -> None:
    """Emit logo.svg with the badge baked in vector form for the store listing."""
    base = BASE_SVG.read_text()
    # Remove trailing </svg> and inject the badge before it. The Morpho SVG
    # uses viewBox 0 0 192 192. Badge center and radius chosen to match the
    # rasterized badge proportions.
    cx, cy, r = 150, 42, 42
    arm = int(r * 0.55)
    stroke = int(r * 0.22)
    badge = (
        f'<circle cx="{cx}" cy="{cy}" r="{r + 4}" fill="#fff"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#16a34a"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r - 3}" fill="#22c55e"/>'
        f'<rect x="{cx - arm}" y="{cy - stroke // 2}" '
        f'width="{arm * 2}" height="{stroke}" fill="#fff"/>'
        f'<rect x="{cx - stroke // 2}" y="{cy - arm}" '
        f'width="{stroke}" height="{arm * 2}" fill="#fff"/>'
    )
    svg_with_badge = base.replace('</svg>', badge + '</svg>')
    (ROOT / 'public' / 'logo.svg').write_text(svg_with_badge)


if __name__ == '__main__':
    for sz in (16, 32, 48, 128):
        img = make(sz)
        path = OUT_DIR / f'icon-{sz}.png'
        img.save(path)
        print(f'wrote {path.name} ({img.size[0]}x{img.size[1]})')
    write_svg()
    print('wrote public/logo.svg')
