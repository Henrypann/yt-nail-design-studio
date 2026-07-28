#!/usr/bin/env python3
"""生成 Almond / Oval / Round 四长度对照签收板（SVG，无第二几何实现）。"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
gen = importlib.import_module("generate-nail-shapes")

PARAMS = json.loads((ROOT / "material-library" / "shapes" / "shape-params.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "material-library" / "shapes" / "review" / "oval-almond-round-comparison.svg"
SHAPES = ["almond", "oval", "round"]
LENGTHS = ["short", "medium", "long", "extra-long"]

CELL_W = 210
CELL_H = 310
LEFT = 130
TOP = 110


def main() -> None:
    width = LEFT + CELL_W * len(LENGTHS) + 30
    height = TOP + CELL_H * len(SHAPES) + 40
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#FBF7F4"/>',
        '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#65554D}'
        '.title{font-size:22px;font-weight:650}.label{font-size:15px;font-weight:600}'
        '.note{font-size:12px;fill:#8A766C}</style>',
        '<text x="30" y="38" class="title">Oval geometry sign-off · Almond / Oval / Round</text>',
        '<text x="30" y="60" class="note">SSOT: shape-params.json · units 0.1mm · generated 2026-07-28</text>',
    ]

    for col, length_id in enumerate(LENGTHS):
        length = PARAMS["lengths"][length_id]
        x = LEFT + col * CELL_W + CELL_W / 2
        parts.append(
            f'<text x="{x}" y="{TOP - 18}" text-anchor="middle" class="label">'
            f'{length_id} · {length["lengthMm"]}mm</text>'
        )

    for row, shape_id in enumerate(SHAPES):
        shape = PARAMS["shapes"][shape_id]
        y = TOP + row * CELL_H
        parts.append(
            f'<text x="{LEFT - 18}" y="{y + CELL_H / 2}" text-anchor="end" class="label">'
            f'{shape["name_en"]}</text>'
        )
        for col, length_id in enumerate(LENGTHS):
            length = PARAMS["lengths"][length_id]
            d = gen.outline_path_d(shape_id, length["lengthMm"], length["widthMm"], shape)
            source_viewbox = [float(value) for value in gen.silhouette_viewbox(
                length["lengthMm"], length["widthMm"], shape
            ).split()]
            vb_x, vb_y, vb_w, vb_h = source_viewbox
            available_w = CELL_W - 36
            available_h = CELL_H - 52
            scale = min(available_w / vb_w, available_h / vb_h)
            x = LEFT + col * CELL_W
            tx = x + (CELL_W - vb_w * scale) / 2 - vb_x * scale
            ty = y + 16 + (available_h - vb_h * scale) / 2 - vb_y * scale
            parts.extend([
                f'<rect x="{x + 4}" y="{y + 4}" width="{CELL_W - 8}" height="{CELL_H - 8}" '
                'rx="12" fill="#FFFFFF" stroke="#E8DED8"/>',
                f'<path d="{d}" transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})" '
                'fill="#F0C9BA" stroke="#7A4A3A" stroke-width="2.2" vector-effect="non-scaling-stroke"/>',
                f'<text x="{x + CELL_W / 2}" y="{y + CELL_H - 16}" text-anchor="middle" class="note">'
                f'{shape_id} · {length_id}</text>',
            ])

    parts.append("</svg>\n")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"[generate-oval-review] wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
