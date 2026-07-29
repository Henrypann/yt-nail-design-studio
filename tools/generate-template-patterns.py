#!/usr/bin/env python3
"""generate-template-patterns.py · 模板图案生成器（DEV-PLAN §5.6）

为模板库中的款式生成所有已注册几何甲型适配的图案 SVG，并为每套模板写
manifest.json（§5.6 / 后端架构文档 §2.3 规范，含 uv_params）与缩略图。

约定：
  - 所有图案 SVG 使用统一 viewBox "-60 -200 120 220"（0.1mm 单位，
    原点 = 甲根中心），按 medium 长度（18mm）基准设计；
    渲染器按 NailSlot 缩放规则等比缩放，换长度不重新出图。
  - 每个图案 SVG 内嵌对应甲型的 medium 轮廓 clipPath（id="nail-clip"），
    图案绘制在 <g clip-path="url(#nail-clip)"> 内，保证不溢出甲型轮廓。
  - 轮廓几何复用 tools/generate-nail-shapes.py（同一参数源）。
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import importlib

gen = importlib.import_module("generate-nail-shapes")

PARAMS_DOC = json.loads((ROOT / "material-library" / "shapes" / "shape-params.json").read_text(encoding="utf-8"))
SHAPES = PARAMS_DOC["shapes"]
LIB = ROOT / "material-library" / "templates"

VIEWBOX = "-60 -200 120 220"
MED_LEN, MED_W = 18.0, 11.0  # medium 基准尺寸（mm）

# 每甲型的法式微笑线参数（ys = 侧翼 y，yc = 中心控制点 y）。
# 坐标系中甲尖为负 y、甲根接近 0，因此中心朝甲尖 = yc < ys。
FRENCH_SMILE = {
    "almond": (-92, -128),
    "oval": (-96, -126),
    "squoval": (-100, -124),
    "coffin": (-98, -126),
    "square": (-130, -130),  # 方形：平直白边
    "round": (-94, -122),
    "stiletto": (-84, -118),
}


def clip_def(shape_id: str) -> str:
    d = gen.outline_path_d(shape_id, MED_LEN, MED_W, SHAPES[shape_id])
    return d


def svg_doc(shape_id: str, template_id: str, defs: str, body: str) -> str:
    d = clip_def(shape_id)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" '
        f'data-template="{template_id}" data-shape="{shape_id}" '
        f'data-units="0.1mm" data-origin="nail-root-center">\n'
        f"  <defs>\n"
        f'    <clipPath id="nail-clip"><path d="{d}"/></clipPath>\n'
        f"{defs}"
        f"  </defs>\n"
        f'  <g clip-path="url(#nail-clip)">\n'
        f"{body}"
        f"  </g>\n"
        f"</svg>\n"
    )


def f(v: float) -> str:
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


# ---------------------------------------------------------------- 各模板图案

def p_french_white(shape_id: str) -> tuple[str, str]:
    ys, yc = FRENCH_SMILE[shape_id]
    body = (
        f'    <path d="M -60 -200 H 60 V {ys} Q 0 {yc} -60 {ys} Z" fill="#FFFFFF"/>\n'
        f'    <path d="M -60 {ys} Q 0 {yc} 60 {ys}" fill="none" stroke="#F3E8E2" stroke-width="1.2"/>\n'
    )
    return "", body


def p_petal_veil_french(shape_id: str) -> tuple[str, str]:
    """Petal Veil French：奶雾底、薄法式、低浮雕五瓣花、珠心与细金线。"""
    ys, yc = FRENCH_SMILE[shape_id]
    defs = (
        '    <linearGradient id="petal-veil-base" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-180">\n'
        '      <stop offset="0" stop-color="#F6E5DE" stop-opacity="0.52"/>\n'
        '      <stop offset="0.55" stop-color="#F4DDD7" stop-opacity="0.34"/>\n'
        '      <stop offset="1" stop-color="#FFF9F4" stop-opacity="0.18"/>\n'
        "    </linearGradient>\n"
        '    <radialGradient id="petal-relief" cx="0.35" cy="0.25" r="0.85">\n'
        '      <stop offset="0" stop-color="#FFFFFF"/>\n'
        '      <stop offset="0.62" stop-color="#FAF3EE"/>\n'
        '      <stop offset="1" stop-color="#E8D7CE"/>\n'
        "    </radialGradient>\n"
        '    <radialGradient id="petal-pearl" cx="0.35" cy="0.28" r="0.8">\n'
        '      <stop offset="0" stop-color="#FFFFFF"/>\n'
        '      <stop offset="0.48" stop-color="#F7E8D1"/>\n'
        '      <stop offset="1" stop-color="#D6B483"/>\n'
        "    </radialGradient>\n"
    )
    flower = (
        '    <g transform="translate(15 -92) rotate(12)">\n'
        '      <ellipse cx="0" cy="-8" rx="4.8" ry="8.5" fill="url(#petal-relief)" stroke="#EBDDD5" stroke-width="0.65"/>\n'
        '      <ellipse cx="0" cy="-8" rx="4.8" ry="8.5" fill="url(#petal-relief)" stroke="#EBDDD5" stroke-width="0.65" transform="rotate(72)"/>\n'
        '      <ellipse cx="0" cy="-8" rx="4.8" ry="8.5" fill="url(#petal-relief)" stroke="#EBDDD5" stroke-width="0.65" transform="rotate(144)"/>\n'
        '      <ellipse cx="0" cy="-8" rx="4.8" ry="8.5" fill="url(#petal-relief)" stroke="#EBDDD5" stroke-width="0.65" transform="rotate(216)"/>\n'
        '      <ellipse cx="0" cy="-8" rx="4.8" ry="8.5" fill="url(#petal-relief)" stroke="#EBDDD5" stroke-width="0.65" transform="rotate(-72)"/>\n'
        '      <circle cx="0" cy="0" r="3.5" fill="url(#petal-pearl)" stroke="#F9F0E3" stroke-width="0.7"/>\n'
        "    </g>\n"
    )
    shimmer = "".join(
        f'    <circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF" opacity="{o}"/>\n'
        for x, y, r, o in [
            (-19, -68, 0.9, 0.62),
            (8, -54, 0.7, 0.52),
            (-8, -118, 0.8, 0.58),
            (26, -132, 0.65, 0.5),
            (-27, -146, 0.55, 0.48),
        ]
    )
    body = (
        '    <rect x="-60" y="-200" width="120" height="220" fill="url(#petal-veil-base)"/>\n'
        f'    <path d="M -60 -200 H 60 V {ys} Q 0 {yc} -60 {ys} Z" fill="#FFFDF9" opacity="0.9"/>\n'
        f'    <path d="M -60 {ys} Q 0 {yc} 60 {ys}" fill="none" stroke="#F0E3DC" stroke-width="1.1" opacity="0.88"/>\n'
        + shimmer
        + '    <path d="M -35 -48 C -24 -70 -6 -86 12 -101 C 25 -112 34 -129 38 -148" fill="none" stroke="#D3AC6E" stroke-width="1.45" stroke-linecap="round"/>\n'
        + flower
        + '    <ellipse cx="-22" cy="-108" rx="2.2" ry="2.2" fill="url(#petal-pearl)" opacity="0.95"/>\n'
    )
    return defs, body


def p_nude_gradient(shape_id: str) -> tuple[str, str]:
    defs = (
        '    <linearGradient id="nude-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-180">\n'
        '      <stop offset="0" stop-color="#F2C9C4" stop-opacity="0.05"/>\n'
        '      <stop offset="0.55" stop-color="#EBA9B3" stop-opacity="0.45"/>\n'
        '      <stop offset="1" stop-color="#E08CA2" stop-opacity="0.9"/>\n'
        "    </linearGradient>\n"
    )
    body = '    <rect x="-60" y="-200" width="120" height="220" fill="url(#nude-g)"/>\n'
    return defs, body


def p_dark_gradient(shape_id: str) -> tuple[str, str]:
    defs = (
        '    <linearGradient id="dark-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-180">\n'
        '      <stop offset="0" stop-color="#53357E" stop-opacity="0.55"/>\n'
        '      <stop offset="0.55" stop-color="#35205C" stop-opacity="0.85"/>\n'
        '      <stop offset="1" stop-color="#170B30" stop-opacity="0.98"/>\n'
        "    </linearGradient>\n"
    )
    body = (
        '    <rect x="-60" y="-200" width="120" height="220" fill="url(#dark-g)"/>\n'
        '    <ellipse cx="0" cy="-70" rx="34" ry="10" fill="#8A6AB8" opacity="0.18"/>\n'
    )
    return defs, body


def p_cat_eye_nude(shape_id: str) -> tuple[str, str]:
    defs = (
        '    <linearGradient id="ce-band" x1="0" y1="0" x2="1" y2="0">\n'
        '      <stop offset="0" stop-color="#FFFBEF" stop-opacity="0"/>\n'
        '      <stop offset="0.5" stop-color="#FFFBEF" stop-opacity="0.95"/>\n'
        '      <stop offset="1" stop-color="#FFFBEF" stop-opacity="0"/>\n'
        "    </linearGradient>\n"
    )
    body = (
        '    <rect x="-60" y="-200" width="120" height="220" fill="#E7CDBE" opacity="0.35"/>\n'
        '    <rect x="-70" y="-107" width="140" height="30" fill="url(#ce-band)" transform="rotate(-28 0 -90)"/>\n'
        '    <rect x="-70" y="-107" width="140" height="8" fill="url(#ce-band)" opacity="0.5" transform="rotate(-28 0 -120)"/>\n'
    )
    return defs, body


def p_liquid_velvet_cat_eye(shape_id: str) -> tuple[str, str]:
    """Liquid Velvet Cat-eye：裸透丝绒猫眼、侧弧金线与单颗低浮雕水滴。"""
    defs = (
        '    <linearGradient id="liquid-velvet-base" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-180">\n'
        '      <stop offset="0" stop-color="#8A625A" stop-opacity="0.58"/>\n'
        '      <stop offset="0.48" stop-color="#A97D75" stop-opacity="0.72"/>\n'
        '      <stop offset="1" stop-color="#6E4844" stop-opacity="0.68"/>\n'
        "    </linearGradient>\n"
        '    <linearGradient id="velvet-beam" x1="0" y1="0" x2="1" y2="0">\n'
        '      <stop offset="0" stop-color="#FFF8F1" stop-opacity="0"/>\n'
        '      <stop offset="0.32" stop-color="#F7DDD6" stop-opacity="0.12"/>\n'
        '      <stop offset="0.5" stop-color="#FFFDF8" stop-opacity="0.96"/>\n'
        '      <stop offset="0.68" stop-color="#F7DDD6" stop-opacity="0.12"/>\n'
        '      <stop offset="1" stop-color="#FFF8F1" stop-opacity="0"/>\n'
        "    </linearGradient>\n"
        '    <radialGradient id="velvet-drop" cx="0.34" cy="0.28" r="0.82">\n'
        '      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.96"/>\n'
        '      <stop offset="0.38" stop-color="#F8EAE4" stop-opacity="0.58"/>\n'
        '      <stop offset="1" stop-color="#9A6E66" stop-opacity="0.25"/>\n'
        "    </radialGradient>\n"
        '    <filter id="velvet-soft" x="-30%" y="-10%" width="160%" height="120%">\n'
        '      <feGaussianBlur stdDeviation="3.2"/>\n'
        "    </filter>\n"
    )
    shimmer = "".join(
        f'    <circle cx="{x}" cy="{y}" r="{r}" fill="#FFF7F0" opacity="{o}"/>\n'
        for x, y, r, o in [
            (-28, -44, 0.7, 0.34),
            (20, -58, 0.55, 0.38),
            (-16, -94, 0.65, 0.4),
            (25, -118, 0.75, 0.34),
            (-24, -142, 0.55, 0.38),
            (9, -160, 0.7, 0.36),
        ]
    )
    body = (
        '    <rect x="-60" y="-200" width="120" height="220" fill="url(#liquid-velvet-base)"/>\n'
        '    <rect x="-38" y="-205" width="76" height="230" fill="url(#velvet-beam)" opacity="0.5" filter="url(#velvet-soft)" transform="rotate(-7 0 -90)"/>\n'
        '    <rect x="-28" y="-205" width="56" height="230" fill="url(#velvet-beam)" opacity="0.92" transform="rotate(-7 0 -90)"/>\n'
        + shimmer
        + '    <path d="M 39 -35 C 38 -67 34 -98 27 -124 C 23 -140 16 -154 7 -164" fill="none" stroke="#D8B16E" stroke-width="1.5" stroke-linecap="round"/>\n'
        + '    <path d="M 36 -37 C 35 -68 31 -96 25 -121" fill="none" stroke="#FFF2CB" stroke-width="0.45" stroke-linecap="round" opacity="0.9"/>\n'
        + '    <ellipse cx="-20" cy="-72" rx="6.8" ry="8.4" fill="url(#velvet-drop)" stroke="#F7E8E0" stroke-width="0.75"/>\n'
        + '    <ellipse cx="-22.2" cy="-75.2" rx="1.8" ry="1.3" fill="#FFFFFF" opacity="0.86" transform="rotate(-25 -22.2 -75.2)"/>\n'
    )
    return defs, body


def p_y2k_ice(shape_id: str) -> tuple[str, str]:
    defs = (
        '    <linearGradient id="ice-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-180">\n'
        '      <stop offset="0" stop-color="#DFF2FA" stop-opacity="0.5"/>\n'
        '      <stop offset="1" stop-color="#B7DDF2" stop-opacity="0.85"/>\n'
        "    </linearGradient>\n"
    )
    shards = [
        ("0,-178 -14,-150 6,-128 -8,-100", "#FFFFFF", 2.5),
        ("-30,-160 -18,-138 -34,-112 -22,-88", "#8FCBEA", 1.6),
        ("28,-168 40,-144 24,-118 36,-92", "#FFFFFF", 2.0),
        ("-6,-84 10,-66 -2,-46 14,-30", "#8FCBEA", 1.4),
        ("14,-176 4,-156 18,-140", "#DFF2FA", 1.2),
    ]
    lines = "".join(
        f'    <polyline points="{pts}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>\n'
        for pts, c, w in shards
    )
    tris = (
        '    <polygon points="-38,-72 -30,-58 -44,-56" fill="#FFFFFF" opacity="0.55"/>\n'
        '    <polygon points="30,-40 40,-28 26,-22" fill="#FFFFFF" opacity="0.45"/>\n'
        '    <polygon points="6,-112 14,-100 0,-96" fill="#B7DDF2" opacity="0.6"/>\n'
    )
    body = '    <rect x="-60" y="-200" width="120" height="220" fill="url(#ice-g)"/>\n' + lines + tris
    return defs, body


def p_chrome_mirror(shape_id: str) -> tuple[str, str]:
    defs = (
        '    <linearGradient id="chrome-g" gradientUnits="userSpaceOnUse" x1="-55" y1="0" x2="55" y2="0">\n'
        '      <stop offset="0" stop-color="#9FA6AE"/>\n'
        '      <stop offset="0.45" stop-color="#E8EBEF"/>\n'
        '      <stop offset="0.6" stop-color="#F8F9FA"/>\n'
        '      <stop offset="1" stop-color="#A9B0B8"/>\n'
        "    </linearGradient>\n"
        '    <linearGradient id="streak-g" x1="0" y1="0" x2="1" y2="0">\n'
        '      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>\n'
        '      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.95"/>\n'
        '      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>\n'
        "    </linearGradient>\n"
    )
    body = (
        '    <rect x="-60" y="-200" width="120" height="220" fill="url(#chrome-g)"/>\n'
        '    <rect x="-16" y="-200" width="20" height="220" fill="url(#streak-g)" transform="rotate(8 0 -90)"/>\n'
    )
    return defs, body


def p_checkerboard(shape_id: str) -> tuple[str, str]:
    sq = 22
    rects = []
    for ix in range(-3, 3):
        for iy in range(-9, 1):
            color = "#26262B" if (ix + iy) % 2 == 0 else "#F2F2F4"
            rects.append(f'    <rect x="{ix * sq}" y="{iy * sq}" width="{sq}" height="{sq}" fill="{color}"/>\n')
    return "", "".join(rects)


def _teardrop(cx: float, cy: float, r: float) -> str:
    return (
        f"M {f(cx)} {f(cy - 1.7 * r)} "
        f"C {f(cx + 1.2 * r)} {f(cy - 0.9 * r)} {f(cx + 1.15 * r)} {f(cy + 0.9 * r)} {f(cx)} {f(cy + r)} "
        f"C {f(cx - 1.15 * r)} {f(cy + 0.9 * r)} {f(cx - 1.2 * r)} {f(cy - 0.9 * r)} {f(cx)} {f(cy - 1.7 * r)} Z"
    )


def p_3d_waterdrop(shape_id: str) -> tuple[str, str]:
    defs = (
        '    <radialGradient id="drop-g" cx="0.35" cy="0.3" r="0.9">\n'
        '      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/>\n'
        '      <stop offset="0.45" stop-color="#A9D4EA"/>\n'
        '      <stop offset="1" stop-color="#6FA8CC"/>\n'
        "    </radialGradient>\n"
    )
    drops = [(0, -150, 13), (-24, -106, 10), (22, -94, 9), (-6, -58, 8), (30, -142, 6)]
    body = ""
    for cx, cy, r in drops:
        body += f'    <path d="{_teardrop(cx, cy, r)}" fill="url(#drop-g)" stroke="#5E94B8" stroke-width="0.8" opacity="0.95"/>\n'
        body += f'    <ellipse cx="{f(cx - r * 0.35)}" cy="{f(cy - r * 0.55)}" rx="{f(r * 0.22)}" ry="{f(r * 0.14)}" fill="#FFFFFF" opacity="0.9" transform="rotate(-30 {f(cx - r * 0.35)} {f(cy - r * 0.55)})"/>\n'
    return defs, body


def p_classic_high_gloss(shape_id: str) -> tuple[str, str]:
    # 经典高光 = 空图案（DEV-PLAN 任务定义）：仅底色 + 封层质感，无图案层内容
    return "", '    <!-- classic_high_gloss: intentionally empty pattern layer -->\n'


def p_holiday_glitter(shape_id: str) -> tuple[str, str]:
    rng = random.Random(42)
    colors = ["#E9C46A", "#DCDCE2", "#E8AEBF", "#F4E3C1"]
    body = ""
    for i in range(70):
        x = rng.uniform(-52, 52)
        y = -(rng.random() ** 0.6 * 176)  # 越靠甲尖越密
        r = 1.2 + rng.random() * 2.6
        body += f'    <circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{colors[i % 4]}" opacity="{f(0.55 + rng.random() * 0.4)}"/>\n'
    # 6 个四角星闪光
    for sx, sy, s in [(-20, -150, 7), (24, -120, 6), (-34, -92, 5), (8, -66, 6), (36, -160, 5), (-4, -178, 6)]:
        body += (
            f'    <path d="M {sx} {sy - s} L {sx + s * 0.28:.1f} {sy - s * 0.28:.1f} L {sx + s} {sy} '
            f'L {sx + s * 0.28:.1f} {sy + s * 0.28:.1f} L {sx} {sy + s} L {sx - s * 0.28:.1f} {sy + s * 0.28:.1f} '
            f'L {sx - s} {sy} L {sx - s * 0.28:.1f} {sy - s * 0.28:.1f} Z" fill="#FFFFFF" opacity="0.9"/>\n'
        )
    return "", body


GENERATORS = {
    "t_liquid_velvet_cat_eye": p_liquid_velvet_cat_eye,
    "t_petal_veil_french": p_petal_veil_french,
    "t_french_white": p_french_white,
    "t_nude_gradient": p_nude_gradient,
    "t_cat_eye_nude": p_cat_eye_nude,
    "t_y2k_ice": p_y2k_ice,
    "t_dark_gradient": p_dark_gradient,
    "t_chrome_mirror": p_chrome_mirror,
    "t_checkerboard": p_checkerboard,
    "t_3d_waterdrop": p_3d_waterdrop,
    "t_classic_high_gloss": p_classic_high_gloss,
    "t_holiday_glitter": p_holiday_glitter,
}

# 缩略图代表色（PIL 绘制占位缩略图，正式缩略图由设计师替换）
THUMB_STYLE = {
    "t_liquid_velvet_cat_eye": ("#8A625A", "#FFF8F1"),
    "t_petal_veil_french": ("#F6E5DE", "#FFFDF9"),
    "t_french_white": ("#F5E0D3", "#FFFFFF"),
    "t_nude_gradient": ("#F2C9C4", "#E08CA2"),
    "t_cat_eye_nude": ("#E7CDBE", "#FFFBEF"),
    "t_y2k_ice": ("#DFF2FA", "#8FCBEA"),
    "t_dark_gradient": ("#53357E", "#170B30"),
    "t_chrome_mirror": ("#E8EBEF", "#9FA6AE"),
    "t_checkerboard": ("#F2F2F4", "#26262B"),
    "t_3d_waterdrop": ("#F5E0D3", "#6FA8CC"),
    "t_classic_high_gloss": ("#F5E0D3", "#F5E0D3"),
    "t_holiday_glitter": ("#7E2A44", "#E9C46A"),
}


def make_thumbnail(tid: str, out: Path) -> None:
    """生成 240×320 占位缩略图（杏仁甲剪影 + 模板代表色渐变 + 简单意象）。"""
    try:
        from PIL import Image, ImageDraw
    except ModuleNotFoundError:
        # 正式缩略图可由设计资产流程单独写入；图案生成不应被可选的 Pillow 阻断。
        print(f"[generate-template-patterns] Pillow 未安装，跳过占位缩略图: {out.relative_to(ROOT)}")
        return

    c1, c2 = THUMB_STYLE[tid]
    W, H = 240, 320
    img = Image.new("RGB", (W, H), "#FAFAFA")
    dr = ImageDraw.Draw(img)
    # 竖向渐变底
    def hx(c):
        return tuple(int(c[i : i + 2], 16) for i in (1, 3, 5))

    a, b = hx(c1), hx(c2)
    for y in range(H):
        t = y / H
        dr.line([(0, y), (W, y)], fill=tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    # 杏仁甲剪影（居中）
    cx, top, bot, hw = 120, 40, 290, 62
    dr.polygon(
        [(cx - hw, bot), (cx - hw + 6, 160), (cx - 30, 70), (cx, top),
         (cx + 30, 70), (cx + hw - 6, 160), (cx + hw, bot)],
        fill="#FFFFFF",
    )
    # 意象
    if tid == "t_french_white":
        dr.polygon([(cx - hw, bot), (cx - hw + 6, 160), (cx - 30, 70), (cx, top),
                    (cx + 30, 70), (cx + hw - 6, 160), (cx + hw, bot)], fill="#FFFFFF")
        dr.arc([cx - hw + 4, 90, cx + hw - 4, 250], 200, 340, fill="#E8D5CC", width=3)
    elif tid == "t_checkerboard":
        for ix in range(5):
            for iy in range(6):
                if (ix + iy) % 2 == 0:
                    dr.rectangle([cx - 50 + ix * 20, 80 + iy * 20, cx - 30 + ix * 20, 100 + iy * 20], fill="#26262B")
    elif tid == "t_holiday_glitter":
        rng = random.Random(7)
        for _ in range(40):
            x, y = cx + rng.uniform(-45, 45), rng.uniform(70, 280)
            dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=rng.choice(["#E9C46A", "#DCDCE2", "#E8AEBF"]))
    elif tid == "t_3d_waterdrop":
        for dx, dy, r in [(0, 90, 14), (-25, 150, 10), (22, 190, 9)]:
            dr.ellipse([cx + dx - r, dy - r, cx + dx + r, dy + r], fill="#A9D4EA", outline="#5E94B8")
    elif tid == "t_cat_eye_nude":
        dr.line([(cx - 60, 220), (cx + 60, 120)], fill="#FFFBEF", width=14)
    elif tid == "t_y2k_ice":
        for pts in [[(cx, 60), (cx - 12, 120), (cx + 6, 170)], [(cx - 28, 90), (cx - 16, 150)], [(cx + 26, 80), (cx + 36, 140)]]:
            dr.line(pts, fill="#FFFFFF", width=4)
    img.save(out, "PNG")


def main() -> None:
    requested = sys.argv[1:] or list(GENERATORS)
    unknown = [tid for tid in requested if tid not in GENERATORS]
    if unknown:
        raise SystemExit(f"未知模板 id: {', '.join(unknown)}")

    count = 0
    for tid in requested:
        fn = GENERATORS[tid]
        tdir = LIB / tid
        (tdir / "patterns").mkdir(parents=True, exist_ok=True)
        (tdir / "thumbnails").mkdir(parents=True, exist_ok=True)
        patterns = {}
        for shape_id in gen.SHAPE_IDS:
            defs, body = fn(shape_id)
            svg = svg_doc(shape_id, tid, defs, body)
            rel = f"patterns/{shape_id}.svg"
            (tdir / rel).write_text(svg, encoding="utf-8")
            patterns[shape_id] = rel
            count += 1
        make_thumbnail(tid, tdir / "thumbnails" / "default.png")
        manifest = {
            "template_id": tid,
            "version": 1,
            "patterns": patterns,
            "thumbnails": {"default": "thumbnails/default.png"},
            "uv_params": {"anchor_u": 0.5, "anchor_v": 0.85, "scale_u": 1.0, "scale_v": 1.0},
        }
        (tdir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"[generate-template-patterns] wrote {count} pattern SVGs + "
        f"{len(requested)} manifests + {len(requested)} thumbnails -> material-library/templates/"
    )


if __name__ == "__main__":
    main()
