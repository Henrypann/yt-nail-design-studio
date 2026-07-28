#!/usr/bin/env python3
"""v3-almond-root-study.py · Almond 2D 顶视轮廓原型（cuticle seat 语义，纯研究稿）

推翻「最宽处=甲根」公理。目标语义（专业穿戴甲 cuticle seat）：
  圆润略窄的甲根 → 近端舒展到最大宽 → 连续椭圆收窄 → 有限半径软尖

几何 = 显式锚点的分段三次 Bézier（不再用全局 w(t)）：
  S1  cuticle arc：甲根半月浅弧，中心下凹 cuticleDepth，圆角根角
  S2  flare      ：根角 → 最大宽处的柔和外展（与 S1 在根角 G1 连续）
  S3  taper      ：最大宽处 → 甲尖的连续收窄（与 S2 在最宽处 G1 连续；
                   甲尖水平切线，左右镜像 G1；顶点曲率半径 = tipRadius，解析求解）

显示坐标：mm，甲尖朝上，y=0 为根角高度（甲根弧中心下凹到 −cuticleDepth）。
输出仅研究稿：assets/shape-calibration/v3-almond-root-study.png
未签收前不触碰 skill / shape-params.json / 正式 SVG 资产。
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from v3_almond_geometry import (  # noqa: E402
    CUT_D,
    CUTICLE_DEPTH_RATIO,
    LENGTHS,
    MAX_WIDTH_MM,
    MAX_WIDTH_T,
    MHW,
    RHW,
    ROOT_WIDTH_RATIO,
    almond_outline,
    almond_segments,
    run_checks,
)

OUT_PNG = ROOT / "assets" / "shape-calibration" / "v3-almond-root-study.png"
REF_IMG = ROOT / "ref-shapes" / "v3-almond-ref.png"

# 参考图归一化叠图：crop = 参考图中单枚 almond 的包围盒（px，可调）
REF_CROP = (189, 32, 259, 190)   # x0, y0(尖), x1, y1(根)：紧贴中指 almond 甲片边缘
REF_ALPHA = 0.42


# ---------------- 渲染 ----------------

def render(out_path: Path) -> None:
    SS = 2
    PPM = 26                        # 主区 px/mm（同一比例尺）
    ZOOM = 4                        # 甲根放大倍数
    ML, MR, MT = 110, 30, 56        # 主区边距（px，SS 前）
    COL_W_MM = 16.5
    Y_MIN, Y_MAX = -3.0, 27.0       # 主区纵轴范围 mm
    max_len = max(l for _, l, _ in LENGTHS)

    main_h_mm = Y_MAX - Y_MIN
    ZPPM = PPM * ZOOM                 # 放大区 px/mm（SS 前）
    Z_WIN_W_MM, Z_WIN_H_MM = 11.0, 4.0  # 放大窗口覆盖 mm（x ±5.5，y −2..+2）
    Z_GUTTER = 24                     # 放大窗口间距 px（SS 前）
    zoom_grid_w_px = ML * SS + 2 * Z_WIN_W_MM * ZPPM * SS + Z_GUTTER * SS + MR * SS
    main_w_px = (ML + MR) * SS + COL_W_MM * len(LENGTHS) * PPM * SS
    W_PX = int(max(main_w_px, zoom_grid_w_px))
    zoom_rows_px = 2 * (Z_WIN_H_MM * ZPPM + 26) * SS
    H_PX = int(MT * SS + main_h_mm * PPM * SS + 10 * PPM * SS + zoom_rows_px + 150 * SS)

    img = Image.new("RGB", (W_PX, H_PX), "#FBF7F4")
    dr = ImageDraw.Draw(img)
    CJK_CANDIDATES = [
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/PingFang.ttc",
    ]

    def cjk_font(size: int):
        for p in CJK_CANDIDATES:
            try:
                return ImageFont.truetype(p, size)
            except Exception:  # noqa: BLE001
                continue
        return ImageFont.load_default()

    f_xs = cjk_font(10 * SS)
    f_sm = cjk_font(12 * SS)
    f_md = cjk_font(14 * SS)
    f_lg = cjk_font(19 * SS)

    def X(mm_x):  # 列内 0 点在各列中心；这里 X 是相对画布左缘的 mm
        return (ML + mm_x * PPM) * SS

    y_root_px = (MT + (Y_MAX - 0.0) * PPM) * SS   # y=0（根角高度线）的像素行

    def Y(mm_up):
        return y_root_px - mm_up * PPM * SS

    # ---- 纵轴 mm 刻度尺
    for mm in range(int(Y_MIN), int(Y_MAX) + 1):
        y = Y(mm)
        major = mm % 5 == 0
        x0 = ML * SS
        dr.line([x0 - (10 if major else 5) * SS, y, x0, y],
                fill="#7A4A3A" if major else "#C9B8AE", width=2 * SS if major else SS)
        if major:
            dr.text((x0 - 14 * SS, y), f"{mm}", fill="#6B5B52", font=f_sm, anchor="rm")
            dr.line([x0, y, W_PX - MR * SS, y], fill="#EDE3DC", width=SS)
    dr.text((ML * SS - 14 * SS, Y(Y_MAX) - 14 * SS), "mm", fill="#6B5B52", font=f_sm, anchor="rm")
    dr.line([ML * SS, Y(0), W_PX - MR * SS, Y(0)], fill="#7A4A3A", width=2 * SS)  # y=0 根角线

    # ---- 标题与参数标注
    dr.text((W_PX / 2, 18 * SS), "Almond v3 · cuticle seat 分段 Bézier 原型（尖朝上，同一毫米比例尺）",
            fill="#4A3B34", font=f_lg, anchor="mm")
    dr.text((W_PX / 2, 40 * SS),
            f"rootWidthRatio={ROOT_WIDTH_RATIO:.2f}   maxWidthT={MAX_WIDTH_T:.2f}   "
            f"cuticleDepth={CUT_D:.1f}mm({CUTICLE_DEPTH_RATIO:.0%}W)   "
            f"tipRadius={'/'.join(f'{r:.2f}' for _, _, r in LENGTHS)}mm",
            fill="#8A6A5A", font=f_sm, anchor="mm")

    # ---- 参考图准备（crop → 归一化）
    ref = None
    if REF_IMG.exists():
        ref = Image.open(REF_IMG).convert("RGBA").crop(REF_CROP)

    outlines = []
    col_data = []
    for ci, (lid, L, tip_r) in enumerate(LENGTHS):
        col_cx = X(COL_W_MM * (ci + 0.5))
        pts = almond_outline(L, tip_r)
        outlines.append(pts)
        col_data.append((lid, L, tip_r, col_cx, [(col_cx + px * PPM * SS, Y(py)) for px, py in pts]))

    # 第 1 遍：全部填充
    for _, _, _, _, poly in col_data:
        dr.polygon(poly, fill="#E9BBA8")

    # 第 2 遍：参考图一次性合成（单一 RGBA 层，统一 alpha）
    if ref is not None:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        for _, L, _, col_cx, _ in col_data:
            rw_px = int(MAX_WIDTH_MM * PPM * SS)
            rh_px = int(L * PPM * SS)
            ref_s = ref.resize((rw_px, rh_px), Image.LANCZOS)
            ref_s.putalpha(int(REF_ALPHA * 255))
            layer.paste(ref_s, (int(col_cx - rw_px / 2), int(Y(0) - rh_px)))
        img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
        dr = ImageDraw.Draw(img)

    # 第 3 遍：描边与标注（压在参考图之上）
    for lid, L, tip_r, col_cx, poly in col_data:
        dr.line(poly + [poly[0]], fill="#7A4A3A", width=2 * SS, joint="curve")
        # 中线
        dr.line([col_cx, Y(-CUT_D), col_cx, Y(L)], fill="#C9B8AE", width=SS)

        # 最大宽标注线
        mw_y = MAX_WIDTH_T * L
        dr.line([col_cx - MHW * PPM * SS, Y(mw_y), col_cx + MHW * PPM * SS, Y(mw_y)],
                fill="#B08A7A", width=SS)
        dr.text((col_cx + MHW * PPM * SS + 4 * SS, Y(mw_y)), f"maxW {MAX_WIDTH_MM:.0f}",
                fill="#B08A7A", font=f_xs, anchor="lm")
        # 根宽标注线（根角高度）
        dr.line([col_cx - RHW * PPM * SS, Y(0) + 10 * SS, col_cx + RHW * PPM * SS, Y(0) + 10 * SS],
                fill="#8A766C", width=SS)
        dr.text((col_cx, Y(0) + 20 * SS), f"rootW {2*RHW:.1f}mm", fill="#8A766C",
                font=f_xs, anchor="mm")

        dr.text((col_cx, Y(Y_MIN) + 16 * SS), lid, fill="#4A3B34", font=f_md, anchor="mm")
        dr.text((col_cx, Y(Y_MIN) + 34 * SS), f"L={L:.0f}mm · tipR={tip_r:.2f}mm",
                fill="#8A766C", font=f_xs, anchor="mm")

    # ---- 甲根 4× 放大区（2×2 网格，每个窗口完整覆盖根区 x±5.5mm / y −2..+2mm）
    z_top_px = (MT + main_h_mm * PPM + 10 * PPM) * SS
    dr.text((ML * SS, z_top_px - 8 * SS), "甲根局部 4× 放大（检查：无平底 / 无竖直墙 / 无直角 / 无子弹底座）",
            fill="#4A3B34", font=f_md, anchor="lb")
    win_w_px = Z_WIN_W_MM * ZPPM * SS
    win_h_px = Z_WIN_H_MM * ZPPM * SS
    for ci, (lid, L, tip_r) in enumerate(LENGTHS):
        row, col = divmod(ci, 2)
        bx0 = ML * SS + col * (win_w_px + Z_GUTTER * SS)
        by0 = z_top_px + row * (win_h_px + 26 * SS)
        bx1, by1 = bx0 + win_w_px, by0 + win_h_px
        dr.rectangle([bx0, by0, bx1, by1], outline="#D8C8BE", width=SS)
        z_cx = (bx0 + bx1) / 2
        z_origin_y = (by0 + by1) / 2            # 窗口中心 = y=0 根角线
        pts = outlines[ci]
        poly = [(z_cx + px * ZPPM * SS, z_origin_y - py * ZPPM * SS) for px, py in pts]
        clip = [(x, y) for x, y in poly if by0 - 4 * SS <= y <= by1 + 4 * SS]
        if len(clip) > 2:
            dr.line(clip, fill="#7A4A3A", width=3 * SS, joint="curve")
        dr.line([bx0, z_origin_y, bx1, z_origin_y], fill="#C9B8AE", width=SS)     # y=0
        dr.line([z_cx, by0, z_cx, by1], fill="#E4D8D0", width=SS)                 # 中线
        # mm 刻度（每 1mm 竖线）
        for mm_x in range(-5, 6):
            gx = z_cx + mm_x * ZPPM * SS
            dr.line([gx, by1 - (6 if mm_x % 5 == 0 else 3) * SS, gx, by1],
                    fill="#C9B8AE", width=SS)
        dr.text((bx0 + 6 * SS, by0 + 4 * SS), f"{lid} · L={L:.0f}mm",
                fill="#8A766C", font=f_sm, anchor="lt")

    # ---- 数值验收结果（底部）
    cy = z_top_px + 2 * (win_h_px + 26 * SS) + 14 * SS
    dr.text((ML * SS, cy), "硬检查：", fill="#4A3B34", font=f_md, anchor="lb")
    checks = run_checks(LENGTHS[1][1], LENGTHS[1][2])   # 参数全局一致，用 medium 代表
    for i, (msg, ok) in enumerate(checks):
        dr.text((ML * SS + 60 * SS, cy + (i + 0) * 0), "", fill="#000")  # noop
    yy = cy + 20 * SS
    for msg, ok in checks:
        dr.text((ML * SS + 16 * SS, yy), f"{'✅' if ok else '❌'} {msg}",
                fill="#3E6B4A" if ok else "#B03A2E", font=f_sm, anchor="lb")
        yy += 18 * SS

    img = img.resize((W_PX // SS, H_PX // SS), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    print(f"[v3-root-study] -> {out_path}")
    for _, L, r in LENGTHS:
        for msg, ok in run_checks(L, r):
            if not ok:
                print(f"  FAIL [{L}mm] {msg}")
    all_ok = all(ok for _, L, r in LENGTHS for _, ok in run_checks(L, r))
    print(f"[v3-root-study] checks: {'ALL PASS' if all_ok else 'HAS FAILURES'}")


if __name__ == "__main__":
    render(OUT_PNG)
