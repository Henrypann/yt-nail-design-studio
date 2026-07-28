#!/usr/bin/env python3
"""v3-almond-export-svg.py · 将 cuticle-seat 原型导出为验收用 SVG（不覆盖正式资产）

几何单一事实源：tools/v3_almond_geometry.py
输出目录：assets/shape-calibration/v3-silhouettes/
  - almond_{short,medium,long,extra_long}.svg
  - manifest.json
  - contact-sheet.svg（四档并排，便于目检）

坐标约定与正式资产对齐（便于签收后直接对照）：
  - 单位 0.1mm；原点 = 甲根中心（根角高度 y=0）；甲尖 −y
  - 未签收前：不写 material-library/、不改 shape-params.json、不动 nails-shape-svg skill
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from v3_almond_geometry import (  # noqa: E402
    CUT_D,
    CUTICLE_DEPTH_RATIO,
    LENGTHS,
    MAX_WIDTH_MM,
    MAX_WIDTH_T,
    MHW,
    ROOT_WIDTH_RATIO,
    TAPER_E1,
    almond_outline,
    almond_segments,
    run_checks,
)

OUT_DIR = ROOT / "assets" / "shape-calibration" / "v3-silhouettes"


def mm_to_svg(p: tuple[float, float]) -> tuple[float, float]:
    """显示坐标（mm，尖朝上）→ SVG（0.1mm，尖朝 −y）。"""
    x, y_up = p
    return (round(x * 10.0, 2), round(-y_up * 10.0, 2))


def fmt(p: tuple[float, float]) -> str:
    x, y = p

    def n(v: float) -> str:
        if abs(v) < 5e-3:
            return "0"
        s = f"{v:.2f}".rstrip("0").rstrip(".")
        return s if s not in ("", "-") else "0"

    return f"{n(x)} {n(y)}"


def mirror_x(p: tuple[float, float]) -> tuple[float, float]:
    return (-p[0], p[1])


def reverse_cubic(seg: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [seg[3], seg[2], seg[1], seg[0]]


def cubic_d(seg_mm: list[tuple[float, float]]) -> str:
    _p0, p1, p2, p3 = [mm_to_svg(p) for p in seg_mm]
    return f"C {fmt(p1)} {fmt(p2)} {fmt(p3)}"


def outline_path_d(L: float, tip_r: float) -> str:
    """闭合轮廓：左根角 → 左墙上尖 → 右墙回根角 → 甲根浅弧闭合。"""
    s1, s2, s3 = almond_segments(L, tip_r)

    s1_l = [mirror_x(p) for p in s1]
    s2_l = [mirror_x(p) for p in s2]
    s3_l = [mirror_x(p) for p in s3]

    left_up = [s2_l, s3_l]
    right_down = [reverse_cubic(s3), reverse_cubic(s2)]
    cuticle = [reverse_cubic(s1), s1_l]

    left_root = mm_to_svg(s2_l[0])
    parts = [f"M {fmt(left_root)}"]
    for seg in left_up + right_down + cuticle:
        parts.append(cubic_d(seg))
    parts.append("Z")
    return " ".join(parts)


def viewbox_for(L: float, tip_r: float) -> str:
    pts = [mm_to_svg(p) for p in almond_outline(L, tip_r)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    pad = 6.0
    min_x, max_x = min(xs) - pad, max(xs) + pad
    min_y, max_y = min(ys) - pad, max(ys) + pad
    return f"{min_x:.1f} {min_y:.1f} {max_x - min_x:.1f} {max_y - min_y:.1f}"


def build_svg(length_id: str, L: float, tip_r: float) -> str:
    d = outline_path_d(L, tip_r)
    vb = viewbox_for(L, tip_r)
    return f"""\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" \
data-shape="almond" data-length="{length_id}" data-units="0.1mm" \
data-origin="nail-root-center" data-curve-model="v3-cuticle-seat" \
data-status="prototype-pending-review" data-tip-radius-mm="{tip_r}">
  <defs>
    <clipPath id="nail-clip">
      <path d="{d}"/>
    </clipPath>
  </defs>
  <path d="{d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <!-- prototype only: do not consume from material-library until signed off -->
</svg>
"""


def build_contact_sheet(entries: list[tuple[str, float, float, str]]) -> str:
    col_w, margin = 140, 24
    top, bottom = 40, 48
    max_l = max(L for _, L, _, _ in entries)
    h = top + max_l * 10 + 40 + bottom
    w = margin * 2 + col_w * len(entries)
    tip_label = "/".join(f"{r:.2f}" for _, _, r, _ in entries)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'data-status="prototype-pending-review">',
        f'<rect width="{w}" height="{h}" fill="#FBF7F4"/>',
        f'<text x="{w / 2}" y="18" text-anchor="middle" fill="#4A3B34" '
        f'font-family="system-ui,sans-serif" font-size="14">'
        f"Almond v3 cuticle-seat · prototype SVG（尖朝上预览）</text>",
        f'<text x="{w / 2}" y="34" text-anchor="middle" fill="#8A6A5A" '
        f'font-family="system-ui,sans-serif" font-size="10">'
        f"rootWidthRatio={ROOT_WIDTH_RATIO:.2f}  maxWidthT={MAX_WIDTH_T:.2f}  "
        f"cuticleDepth={CUT_D:.1f}mm  tipR={tip_label}mm</text>",
    ]
    for i, (lid, L, tip_r, _) in enumerate(entries):
        cx = margin + col_w * (i + 0.5)

        def to_canvas(p, _cx=cx, _L=L):
            x, y_up = p
            return (round(cx + x * 10, 1), round(top + (max_l - y_up) * 10, 1))

        s1, s2, s3 = almond_segments(L, tip_r)
        right_segs = [s1, s2, s3]
        left_segs = [
            reverse_cubic([mirror_x(p) for p in s3]),
            reverse_cubic([mirror_x(p) for p in s2]),
            reverse_cubic([mirror_x(p) for p in s1]),
        ]

        p0 = to_canvas(s1[0])
        d_parts = [f"M {p0[0]:.1f} {p0[1]:.1f}"]
        for seg in right_segs + left_segs:
            _a, c1, c2, p3 = [to_canvas(p) for p in seg]
            d_parts.append(
                f"C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p3[0]:.1f} {p3[1]:.1f}"
            )
        d_parts.append("Z")
        d = " ".join(d_parts)
        parts.append(f'<path d="{d}" fill="#E9BBA8" stroke="#7A4A3A" stroke-width="1.5"/>')

        y0 = top + max_l * 10
        ymw = top + (max_l - MAX_WIDTH_T * L) * 10
        parts.append(
            f'<line x1="{cx - 55}" y1="{y0}" x2="{cx + 55}" y2="{y0}" '
            f'stroke="#C9B8AE" stroke-width="0.8"/>'
        )
        parts.append(
            f'<line x1="{cx - 55}" y1="{ymw}" x2="{cx + 55}" y2="{ymw}" '
            f'stroke="#B08A7A" stroke-width="0.8" stroke-dasharray="3 2"/>'
        )
        label_y = top + max_l * 10 + 18
        parts.append(
            f'<text x="{cx}" y="{label_y}" text-anchor="middle" fill="#4A3B34" '
            f'font-family="system-ui,sans-serif" font-size="11">{lid}</text>'
        )
        parts.append(
            f'<text x="{cx}" y="{label_y + 14}" text-anchor="middle" fill="#8A766C" '
            f'font-family="system-ui,sans-serif" font-size="9">'
            f"L={L:.0f}mm · tipR={tip_r:.2f}</text>"
        )
    parts.append("</svg>")
    return "\n".join(parts)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    entries: list[tuple[str, float, float, str]] = []
    all_pass = True
    for length_id, L, tip_r in LENGTHS:
        file_stem = f"almond_{length_id.replace('-', '_')}"
        path = OUT_DIR / f"{file_stem}.svg"
        path.write_text(build_svg(length_id, L, tip_r), encoding="utf-8")
        entries.append((length_id, L, tip_r, file_stem + ".svg"))
        print(f"[v3-svg] -> {path.relative_to(ROOT)}")

        for msg, ok in run_checks(L, tip_r):
            if not ok:
                all_pass = False
                print(f"  FAIL [{length_id}] {msg}")

    contact = OUT_DIR / "contact-sheet.svg"
    contact.write_text(build_contact_sheet(entries), encoding="utf-8")
    print(f"[v3-svg] -> {contact.relative_to(ROOT)}")

    manifest = {
        "version": "v3-cuticle-seat-prototype",
        "updated_at": date.today().isoformat(),
        "status": "pending_review",
        "source_geometry": "tools/v3_almond_geometry.py",
        "export_script": "tools/v3-almond-export-svg.py",
        "study_script": "tools/v3-almond-root-study.py",
        "not_promoted": [
            "material-library/shapes/silhouettes/*",
            "material-library/shapes/shape-params.json",
            "nails-shape-svg skill",
        ],
        "parameters": {
            "maxWidthMm": MAX_WIDTH_MM,
            "rootWidthRatio": ROOT_WIDTH_RATIO,
            "cuticleDepthRatio": CUTICLE_DEPTH_RATIO,
            "cuticleDepthMm": CUT_D,
            "maxWidthT": MAX_WIDTH_T,
            "taperE1": TAPER_E1,
        },
        "lengths": [
            {"id": lid, "lengthMm": L, "tipRadiusMm": tip_r, "file": fname}
            for lid, L, tip_r, fname in entries
        ],
        "hard_checks": "ALL_PASS" if all_pass else "HAS_FAILURES",
        "study_png": "assets/shape-calibration/v3-almond-root-study.png",
        "acceptance_notes": [
            "目检 contact-sheet.svg 与四档独立 SVG",
            "对照 study PNG 的 4× 根区与照片叠图",
            "签收前禁止覆盖正式 silhouettes",
        ],
    }
    man_path = OUT_DIR / "manifest.json"
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[v3-svg] -> {man_path.relative_to(ROOT)}")
    print(f"[v3-svg] hard checks: {'ALL PASS' if all_pass else 'HAS FAILURES'}")
    if not all_pass:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
