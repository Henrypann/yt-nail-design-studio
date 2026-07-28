#!/usr/bin/env python3
"""v3-almond.py · v3 语义模型原型（仅 almond，验收用）

v3 2D 顶视轮廓原则（对照 GPT v3 方案与真实甲片参考图）：
  - 最宽处 = 甲根（maxWidthRatio ≤ 1.0，禁止中段外鼓）
  - 甲根→肩部：极缓收窄（保持丰盈但不出界）
  - 肩部→甲尖：椭圆弧连续收窄（cos 缓动，肩部零导数平滑接入）
  - 甲尖：有限半径软尖（tipRadiusMm），不是针尖

坐标约定不变：0.1mm 单位、原点=甲根中心、甲尖负 y。
输出：almond × 4 长度轮廓采样点 → PIL 渲染对比 PNG（横轴=长度，纵轴=mm 真实比例）。
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_PNG = ROOT / "assets" / "shape-calibration" / "v3-almond-mm.png"

# ---------------- v3 almond 参数（可调，签收后写入 shape-params v3） ----------------
ALMOND_V3 = {
    "bodyExp": 2.8,   # 身段保持指数 a：越大甲根~中段越平直饱满（肩部越靠后、越不明显）
    "tipExp": 0.85,   # 末端软化指数 b<1：末端竖直切线软尖；越小越圆钝，越接近 1 越接近线性尖
}
LENGTHS = [
    ("short", 14.0),
    ("medium", 18.0),
    ("long", 22.0),
    ("extra-long", 26.0),
]
WIDTH_MM = 11.0
ROOT_ARC_RATIO = 0.22

KAPPA = 0.5523


def _smootherstep(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)


def almond_width_profile(length_mm: float, width_mm: float, p: dict):
    """v3 almond 半宽剖面 w(t)，归一化（w(0)=1=甲根半宽，永不超过 1）。

    单一光滑函数，无分段、无肩部折点（C∞）：
      w(t) = (1 - t^a)^b
    - a = bodyExp > 1：t→0 时 w'→0，甲根~中段近直线、饱满不鼓；
      a 越大平直段越长（t^a 在 t<0.6 几乎为 0，0.7 后才显著）。
    - b = tipExp < 1：t→1 时 w ~ (a(1-t))^b，导数 -∞ → 竖直切线软尖，无 cusp。
    性质：w(0)=1（最宽=甲根）、单调递减、全程光滑。
    """
    a = p["bodyExp"]
    b = p["tipExp"]

    def w(t: float) -> float:
        return max(0.0, 1.0 - t ** a) ** b

    return w


def almond_outline_points(length_mm: float, width_mm: float, p: dict, n_wall: int = 120):
    """采样 almond 轮廓边界折线（0.1mm 单位）。左右镜像 + 甲根浅弧。

    壁面采样用余弦间距：甲尖附近自动加密（此处宽度变化最陡）。
    """
    W = width_mm * 10.0 / 2.0
    L = length_mm * 10.0
    w = almond_width_profile(length_mm, width_mm, p)

    # 左侧壁（甲根 → 甲尖，t 余弦加密）
    left = []
    for i in range(n_wall):
        t = 0.5 * (1.0 - math.cos(math.pi * i / (n_wall - 1)))  # 0→1，两端密
        left.append((-W * w(t), -L * t))
    left[-1] = (0.0, -L)  # 精确收到尖点
    pts: list[tuple[float, float]] = list(left)

    # 右侧壁（镜像反转）
    pts.extend((-px, py) for px, py in reversed(left[:-1]))

    # 甲根浅弧（向 +y 微凸）
    p0, c, p1 = (W, 0.0), (0.0, W * ROOT_ARC_RATIO), (-W, 0.0)
    for i in range(1, 13):
        t = i / 12.0
        mt = 1.0 - t
        x = mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0]
        y = mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1]
        pts.append((x, y))
    return pts


# ---------------------------------------------------------------- 渲染

def render(out_path: Path) -> None:
    SS = 2
    PX_PER_MM = 22                     # 最终图像每毫米像素（同一比例尺！）
    MARGIN_L, MARGIN_R = 90, 30
    MARGIN_T, MARGIN_B = 50, 60
    COL_W_MM = 16                      # 每列横向占用 16mm
    max_len = max(l for _, l in LENGTHS)

    canvas_w_mm = MARGIN_L / PX_PER_MM + COL_W_MM * len(LENGTHS) + MARGIN_R / PX_PER_MM
    canvas_h_mm = MARGIN_T / PX_PER_MM + max_len + 4 + MARGIN_B / PX_PER_MM
    W_PX = int(canvas_w_mm * PX_PER_MM * SS)
    H_PX = int(canvas_h_mm * PX_PER_MM * SS)

    img = Image.new("RGB", (W_PX, H_PX), "#FBF7F4")
    dr = ImageDraw.Draw(img)
    CJK = "/System/Library/Fonts/PingFang.ttc"
    try:
        f_sm = ImageFont.truetype(CJK, 11 * SS)
        f_md = ImageFont.truetype(CJK, 14 * SS)
        f_lg = ImageFont.truetype(CJK, 18 * SS)
    except Exception:  # noqa: BLE001
        f_sm = f_md = f_lg = ImageFont.load_default()

    u = PX_PER_MM * SS / 10.0          # px per 0.1mm unit
    y_root = (MARGIN_T + max_len * PX_PER_MM) * SS   # 甲根线 y（所有指甲对齐）

    def X(mm_x: float) -> float:
        return (MARGIN_L + mm_x * PX_PER_MM) * SS

    def Y(mm_up: float) -> float:      # mm_up：相对甲根线向上的毫米
        return y_root - mm_up * PX_PER_MM * SS

    # ---- 纵轴：mm 刻度尺（每 5mm 主刻度 + 标签，每 1mm 次刻度）
    for mm in range(0, int(max_len) + 1):
        y = Y(mm)
        major = mm % 5 == 0
        x0 = MARGIN_L * SS
        dr.line([x0 - (10 if major else 5) * SS, y, x0, y],
                fill="#7A4A3A" if major else "#C9B8AE", width=2 * SS if major else SS)
        if major:
            dr.text((x0 - 14 * SS, y), f"{mm}", fill="#6B5B52", font=f_sm, anchor="rm")
            dr.line([x0, y, W_PX - MARGIN_R * SS, y], fill="#EDE3DC", width=SS)
    dr.text((MARGIN_L * SS - 14 * SS, Y(max_len) - 16 * SS), "mm",
            fill="#6B5B52", font=f_sm, anchor="rm")
    dr.line([MARGIN_L * SS, Y(0), W_PX - MARGIN_R * SS, Y(0)],
            fill="#7A4A3A", width=2 * SS)  # 甲根基准线

    # ---- 标题
    dr.text((W_PX / 2, 20 * SS), "Almond v3 · 顶视轮廓（同一毫米比例尺）",
            fill="#4A3B34", font=f_lg, anchor="mm")

    # ---- 四个长度
    for ci, (lid, length_mm) in enumerate(LENGTHS):
        col_cx_mm = COL_W_MM * (ci + 0.5)
        cx = X(col_cx_mm)
        pts = almond_outline_points(length_mm, WIDTH_MM, ALMOND_V3)
        poly = [(cx + px * u, y_root + py * u) for px, py in pts]
        dr.polygon(poly, fill="#E9BBA8")
        dr.line(poly + [poly[0]], fill="#7A4A3A", width=2 * SS, joint="curve")

        # 甲根宽标注（11mm 双向箭头线）
        half_w = WIDTH_MM / 2
        y_w = Y(0) + 14 * SS
        dr.line([cx - half_w * PX_PER_MM * SS, y_w, cx + half_w * PX_PER_MM * SS, y_w],
                fill="#8A766C", width=SS)
        dr.text((cx, y_w + 10 * SS), f"根宽 {WIDTH_MM:.0f}mm", fill="#8A766C",
                font=f_sm, anchor="mm")

        # 横轴标签
        dr.text((cx, Y(0) + 34 * SS), lid, fill="#4A3B34", font=f_md, anchor="mm")
        dr.text((cx, Y(0) + 52 * SS), f"L={length_mm:.0f}mm", fill="#8A766C",
                font=f_sm, anchor="mm")

    # 横轴标题
    dr.text((W_PX / 2, H_PX - 14 * SS), "长度档位（4 档，根宽统一 11mm）→",
            fill="#6B5B52", font=f_md, anchor="mm")

    img = img.resize((W_PX // SS, H_PX // SS), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    print(f"[v3-almond] -> {out_path}")


if __name__ == "__main__":
    render(OUT_PNG)
