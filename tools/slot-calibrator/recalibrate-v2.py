#!/usr/bin/env python3
"""recalibrate-v2.py · NailSlot V2 十指重标定（Phase 0，人工签收前迭代用）

背景：cursor agent 版 slots.back.v2.json 十指均有偏移、中轴不平行于指尖方向，
L1/R1 拇指悬浮在指蹼空区；且旧 slot 长度普遍超出线稿甲床 ~40%。

方法：4× 放大坐标网格人工读数（tools/slot-calibrator/grid-*.png 调试图），
每指记录三个界标 = 甲尖点 tip / 甲根中心 root / 甲床中宽 width。
（程序检测已验证不可用：线稿甲床侧壁与手指轮廓同一笔连通，且多数甲床
非闭合环，泛洪法仅 6/10 可用且尺寸系统性偏小。）

生成 NailSlotV2 契约字段 + 校准覆盖图（图例 calibration-legend.txt）。

局部 UV 约定（与 v2 契约一致）：
  (0.5,1)=甲根中心，(0.5,0)=甲尖中心；transform = SVG matrix(a b c d tx ty)，
  x=a·u+c·v+tx, y=b·u+d·v+ty；(a,b)=宽度向量/单位u，(c,d)=尖→根向量/单位v，
  (tx,ty)=uv(0,0)=甲尖左角。中轴 = root→tip 连线，平行于指尖方向。

用法：python3 tools/slot-calibrator/recalibrate-v2.py [--write]
  默认只渲染覆盖图与打印表格；--write 才覆写 slots.back.v2.json（先备份 .bak）。
"""

from __future__ import annotations

import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent.parent
PLATE = ROOT / "assets/visual-plates/back/back-line-art-approved-v1.png"
SLOTS_JSON = ROOT / "assets/nail-slots/slots.back.v2.json"
OVERLAY = ROOT / "assets/nail-slots/calibration-back-v2-overlay.png"

SRC_W, SRC_H = 1200, 900

# ---------------- 十指界标（网格读数，原生 px） ----------------
# (fingerCode, role, tip(x,y), root(x,y), 甲床中宽 px)
LANDMARKS = [
    ("L5", "pinky", (156.5, 240.0), (158.0, 281.5), 28.0),
    ("L4", "ring", (267.0, 150.0), (260.0, 204.0), 35.0),
    ("L3", "middle", (358.0, 110.0), (352.0, 169.0), 38.0),
    ("L2", "index", (463.0, 182.0), (452.0, 232.0), 32.0),
    ("L1", "thumb", (551.0, 409.0), (503.0, 457.0), 32.0),
    ("R1", "thumb", (643.0, 408.0), (691.0, 456.0), 32.0),
    ("R2", "index", (744.0, 184.5), (741.0, 238.5), 34.0),
    ("R3", "middle", (843.0, 123.5), (840.0, 181.0), 37.0),
    ("R4", "ring", (932.0, 158.5), (929.0, 214.5), 36.0),
    ("R5", "pinky", (1043.0, 246.0), (1045.0, 292.0), 31.0),
]

FINGER_COLORS = {  # calibration-legend.txt
    "thumb": "#D23B3B", "index": "#E08A2E", "middle": "#3E9B4F",
    "ring": "#3B6FD2", "pinky": "#8B4FC9",
}


def build_slot(code: str, role: str, tip_xy, root_xy, width_px: float):
    tip = np.array(tip_xy, dtype=np.float64)
    root_c = np.array(root_xy, dtype=np.float64)
    axis = tip - root_c                       # 根→尖（中轴，平行指尖方向）
    len_px = float(np.hypot(*axis))
    t_hat = axis / len_px
    w_hat = np.array([-t_hat[1], t_hat[0]])   # u 方向：尖朝上时的左→右

    root_left = root_c - w_hat * (width_px / 2)
    root_right = root_c + w_hat * (width_px / 2)
    rot = math.degrees(math.atan2(axis[0], -axis[1]))

    a, b = w_hat * width_px                   # u：左→右全宽
    c, d = root_c - tip                       # v：尖→根全长
    tx, ty = tip - 0.5 * np.array([a, b])     # uv(0,0)=尖左角

    # 椭圆轮廓（36 点）：中心=轴中点，半长=len/2 沿轴，半宽=w/2
    center = (tip + root_c) / 2
    contour = []
    for i in range(36):
        t = 2 * math.pi * i / 36
        p = center + t_hat * (len_px / 2 * math.cos(t)) + w_hat * (width_px / 2 * math.sin(t))
        contour.append([round(float(p[0]), 1), round(float(p[1]), 1)])
    clip = "M " + " L ".join(f"{p[0]} {p[1]}" for p in contour) + " Z"

    return {
        "id": f"back-{code}",
        "fingerCode": code,
        "fingerRole": role,
        "view": "back",
        "rootLeft": {"x": round(float(root_left[0]), 1), "y": round(float(root_left[1]), 1)},
        "rootRight": {"x": round(float(root_right[0]), 1), "y": round(float(root_right[1]), 1)},
        "tipCenter": {"x": round(float(tip[0]), 1), "y": round(float(tip[1]), 1)},
        "center": {"x": round(float(root_c[0]), 1), "y": round(float(root_c[1]), 1)},
        "rotationDeg": round(rot, 2),
        "nailBedWidthPx": round(width_px, 2),
        "visibleLengthPx": round(len_px, 2),
        "transform": [round(float(a), 2), round(float(b), 2),
                      round(float(c), 2), round(float(d), 2),
                      round(float(tx), 2), round(float(ty), 2)],
        "localUv": {"rootCenter": [0.5, 1], "tipCenter": [0.5, 0]},
        "contourPx": contour,
        "clipPath": clip,
    }


def main() -> None:
    write = "--write" in sys.argv
    plate = Image.open(PLATE).convert("RGB")
    assert plate.size == (SRC_W, SRC_H), f"底图尺寸 {plate.size} ≠ 1200×900"

    slots = []
    print(f"{'slot':<9} {'root':>13} {'tip':>13} {'rot':>7} {'w':>6} {'len':>6}")
    for code, role, tip_xy, root_xy, w in LANDMARKS:
        slot = build_slot(code, role, tip_xy, root_xy, w)
        slots.append(slot)
        rc, tp = slot["center"], slot["tipCenter"]
        print(f"back-{code:<5} ({rc['x']:6.1f},{rc['y']:6.1f})  ({tp['x']:6.1f},{tp['y']:6.1f}) "
              f"{slot['rotationDeg']:6.1f}° {slot['nailBedWidthPx']:5.1f} {slot['visibleLengthPx']:6.1f}")

    # ---- 覆盖图
    ov = plate.copy()
    dr = ImageDraw.Draw(ov)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", 13)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()
    for s in slots:
        color = FINGER_COLORS[s["fingerRole"]]
        contour = [(p[0], p[1]) for p in s["contourPx"]]
        dr.polygon(contour, outline=color, width=2)
        rl, rr = s["rootLeft"], s["rootRight"]
        dr.line([(rl["x"], rl["y"]), (rr["x"], rr["y"])], fill="#D23B3B", width=3)
        rc, tp = s["center"], s["tipCenter"]
        dr.line([(rc["x"], rc["y"]), (tp["x"], tp["y"])], fill="#2E5FD2", width=3)
        dr.ellipse([tp["x"] - 3, tp["y"] - 3, tp["x"] + 3, tp["y"] + 3], fill="#111111")
        dr.text((rc["x"] - 8, rc["y"] + 5), s["fingerCode"], fill=color, font=font)
    ov.save(OVERLAY, "PNG")
    print(f"[overlay] -> {OVERLAY}")

    # ---- 写回 JSON
    if write:
        old = json.loads(SLOTS_JSON.read_text(encoding="utf-8"))
        shutil.copy2(SLOTS_JSON, SLOTS_JSON.with_suffix(".json.bak"))
        out = {
            "version": 2,
            "updated_at": "2026-07-27",
            "view": "back",
            "plate": old["plate"],
            "coordinate_space": old["coordinate_space"],
            "local_uv_contract": old["local_uv_contract"],
            "handedness": old["handedness"],
            "calibration": {
                "method": "manual landmarks on 4x coordinate grid (tools/slot-calibrator/recalibrate-v2.py)",
                "landmarks": "tip / root-center / mid-width per finger; axis = root→tip (parallel to finger)",
                "supersedes": "cursor-agent hand-tuned landmarks (10/10 offset, axis not parallel, thumbs off-nail)",
                "status": "pending_human_signoff",
            },
            "slots": slots,
        }
        SLOTS_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[json] -> {SLOTS_JSON}（旧版备份 .bak）")
    else:
        print("[json] 未写回（加 --write 覆写 slots.back.v2.json）")


if __name__ == "__main__":
    main()
