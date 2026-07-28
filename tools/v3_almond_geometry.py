#!/usr/bin/env python3
"""v3_almond_geometry.py · Almond v3 cuticle-seat 纯几何（无 PIL / 无 I/O）

研究稿 PNG（v3-almond-root-study.py）与验收 SVG 导出（v3-almond-export-svg.py）
共用本模块，保证参数与分段 Bézier 不漂移。

已于 2026-07-24 签收并固化进 nails-shape-svg skill + shape-params.json。
本模块保留为研究稿 / PNG 导出的参数镜像；正式生成以 skill 为准。
"""

from __future__ import annotations

import math

# ---------------- 可调参数（与研究稿图顶标注一致） ----------------
MAX_WIDTH_MM = 11.0
ROOT_WIDTH_RATIO = 0.87
CUTICLE_DEPTH_RATIO = 0.10
MAX_WIDTH_T = 0.17
TAPER_E1 = 0.42

LENGTHS = [  # (label, L mm, tipRadius mm)
    ("short", 14.0, 1.35),
    ("medium", 18.0, 1.15),
    ("long", 22.0, 0.95),
    ("extra-long", 26.0, 0.80),
]

MHW = MAX_WIDTH_MM / 2.0
RHW = MHW * ROOT_WIDTH_RATIO
CUT_D = MAX_WIDTH_MM * CUTICLE_DEPTH_RATIO


def _cubic(p0, p1, p2, p3, n=70):
    pts = []
    for i in range(n):
        t = i / (n - 1)
        mt = 1.0 - t
        x = mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def almond_segments(L: float, tip_r: float):
    """右半边 3 段 Bézier 控制点（y 向上，尖朝上，单位 mm）。"""
    mw_y = MAX_WIDTH_T * L

    s1 = [
        (0.0, -CUT_D),
        (0.45 * RHW, -CUT_D),
        (0.92 * RHW, -0.35 * CUT_D),
        (RHW, 0.0),
    ]

    arc_end_dir = (RHW - 0.92 * RHW, 0.0 + 0.35 * CUT_D)
    s2 = [
        s1[3],
        (s1[3][0] + 0.9 * arc_end_dir[0], s1[3][1] + 0.9 * arc_end_dir[1]),
        (MHW, mw_y - 0.40 * mw_y),
        (MHW, mw_y),
    ]

    y1 = mw_y + TAPER_E1 * (L - mw_y)
    c = math.sqrt(max(0.05, tip_r * (L - y1) / 1.5))
    s3 = [s2[3], (MHW, y1), (c, L), (0.0, L)]
    return s1, s2, s3


def almond_outline(L: float, tip_r: float):
    """完整闭合轮廓采样点（mm，尖朝上）。"""
    s1, s2, s3 = almond_segments(L, tip_r)
    right = _cubic(*s1)[:-1] + _cubic(*s2)[:-1] + _cubic(*s3)
    left = [(-x, y) for x, y in reversed(right[:-1])]
    return right + left


def run_checks(L: float, tip_r: float):
    s1, s2, s3 = almond_segments(L, tip_r)
    results = []

    d = (s1[3][0] - s1[2][0], s1[3][1] - s1[2][1])
    ang = math.degrees(math.atan2(abs(d[1]), abs(d[0])))
    results.append((f"根角切线角 {ang:.0f}°（<75° 非竖直墙）", ang < 75.0))
    results.append((f"cuticleDepth {CUT_D:.2f}mm > 0（非平底）", CUT_D > 0.3))

    pts = almond_outline(L, tip_r)
    max_x = max(abs(x) for x, _ in pts)
    ok = abs(max_x - MHW) < 0.02 and 0.12 <= MAX_WIDTH_T <= 0.22
    results.append(
        (f"maxWidth {2 * max_x:.2f}mm @ t={MAX_WIDTH_T:.2f}（根宽 {2 * RHW:.2f} < 最大宽）", ok)
    )

    def par(a0, a1, b0, b1):
        va = (a1[0] - a0[0], a1[1] - a0[1])
        vb = (b1[0] - b0[0], b1[1] - b0[1])
        cross = va[0] * vb[1] - va[1] * vb[0]
        na = math.hypot(*va) * math.hypot(*vb)
        return abs(cross) / max(na, 1e-9) < 0.02

    g1_root = par(s1[2], s1[3], s2[0], s2[1])
    g1_maxw = par(s2[2], s2[3], s3[0], s3[1])
    results.append((f"G1 连续 @根角={g1_root} @最宽={g1_maxw}", g1_root and g1_maxw))
    results.append((f"tipRadius {tip_r:.2f}mm ≥ 0.6（有限软尖）", tip_r >= 0.6))
    results.append(
        (
            f"rootWidthRatio {ROOT_WIDTH_RATIO:.2f} ∈ [0.84, 0.90]",
            0.84 <= ROOT_WIDTH_RATIO <= 0.90,
        )
    )
    return results
