#!/usr/bin/env python3
"""generate-mock-stl.py · Mock STL 生成器（DEV-PLAN §4.6）

生成参数化甲片壳体占位 STL（半椭球壳，ASCII STL，单位 mm），吃
material-library/shapes/shape-params.json 同一参数源（预览 = 打印红线）。
用于跑通「导出清单 → 文件管理 → 工艺包字段占位」链路。

正式 STL 由算法组（8/3 到岗）工艺映射引擎产出；替换时只改
assets/stl/manifest.json 指向，UI 与导出链路零改动。

红线：原型期 PNG 是唯一用户可见导出形态，STL 不暴露给用户。
"""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARAMS_PATH = ROOT / "material-library" / "shapes" / "shape-params.json"
OUT_DIR = ROOT / "assets" / "stl"

# Mock 壳体基准：almond / medium（参数源驱动；仅占位，不代表工艺参数）
BASE_SHAPE = "almond"
BASE_LENGTH = "medium"
DOME_HEIGHT_MM = 2.8     # 壳体拱高（占位值，正式值由工艺映射引擎给出）
SHELL_BOTTOM_Z = 0.0
SEG_U = 24               # 经向分段
SEG_V = 12               # 纬向分段（0 → π/2）


def ellipsoid_point(a: float, b: float, c: float, u: float, v: float) -> tuple[float, float, float]:
    """u ∈ [0, 2π) 经向；v ∈ [0, π/2] 纬向（v=π/2 为顶点）。"""
    return (
        a * math.cos(v) * math.cos(u),
        b * math.cos(v) * math.sin(u),
        c * math.sin(v) + SHELL_BOTTOM_Z,
    )


def normal_of(p: tuple[float, float, float], a: float, b: float, c: float) -> tuple[float, float, float]:
    nx, ny, nz = p[0] / a**2, p[1] / b**2, (p[2] - SHELL_BOTTOM_Z) / c**2
    n = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    return (nx / n, ny / n, nz / n)


def fmt(v: float) -> str:
    return f"{v:.6f}"


def facet(n, v1, v2, v3) -> str:
    vs = "\n".join(f"      vertex {fmt(p[0])} {fmt(p[1])} {fmt(p[2])}" for p in (v1, v2, v3))
    return (
        f"  facet normal {fmt(n[0])} {fmt(n[1])} {fmt(n[2])}\n"
        f"    outer loop\n{vs}\n"
        f"    endloop\n  endfacet\n"
    )


def build_stl(a: float, b: float, c: float) -> str:
    facets: list[str] = []
    grid = [
        [ellipsoid_point(a, b, c, 2 * math.pi * i / SEG_U, (math.pi / 2) * j / SEG_V) for j in range(SEG_V + 1)]
        for i in range(SEG_U)
    ]
    for i in range(SEG_U):
        ni = (i + 1) % SEG_U
        for j in range(SEG_V):
            p00, p01 = grid[i][j], grid[i][j + 1]
            p10, p11 = grid[ni][j], grid[ni][j + 1]
            if j == SEG_V - 1:
                # 顶点退化：只画一个三角形
                n = normal_of(p01, a, b, c)
                facets.append(facet(n, p00, p10, p01))
            else:
                n = normal_of(p00, a, b, c)
                facets.append(facet(n, p00, p10, p11))
                facets.append(facet(n, p00, p11, p01))
    # 底面封盖（z = SHELL_BOTTOM_Z 圆盘，法线朝下）
    rim = [grid[i][0] for i in range(SEG_U)]
    rim = [(p[0], p[1], SHELL_BOTTOM_Z) for p in rim]
    for i in range(SEG_U):
        ni = (i + 1) % SEG_U
        facets.append(facet((0.0, 0.0, -1.0), (0.0, 0.0, SHELL_BOTTOM_Z), rim[ni], rim[i]))

    body = "".join(facets)
    return f"solid mock_nail_shell\n{body}endsolid mock_nail_shell\n"


def main() -> None:
    params = json.loads(PARAMS_PATH.read_text(encoding="utf-8"))
    lp = params["lengths"][BASE_LENGTH]
    # 半椭球：a = 半宽，b = 半长，c = 拱高（参数源驱动）
    a = lp["widthMm"] / 2
    b = lp["lengthMm"] / 2
    c = DOME_HEIGHT_MM * (1 + params["shapes"][BASE_SHAPE]["cCurve"] * 0.2)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stl = build_stl(a, b, c)
    (OUT_DIR / "mock-shell.stl").write_text(stl, encoding="ascii")

    manifest = {
        "version": 1,
        "updated_at": "2026-07-23T00:00:00Z",
        "status": "MOCK_PENDING_ALGO",
        "comment": "Mock STL 占位清单（DEV-PLAN §4.6）。正式 STL 由算法组工艺映射引擎产出，替换时只改本 manifest 指向，UI 与导出链路零改动。原型期 STL 不暴露给用户（PNG 唯一导出）。",
        "mock_file": "mock-shell.stl",
        "mock_params": {
            "shape": BASE_SHAPE,
            "length": BASE_LENGTH,
            "semi_axes_mm": [round(a, 2), round(b, 2), round(c, 2)],
            "source": "material-library/shapes/shape-params.json",
        },
        "entries": [
            {
                "template_id": tid,
                "shape": shape,
                "status": "MOCK_PENDING_ALGO",
                "placeholder_file": "mock-shell.stl",
                "final_file": None,
                "note": "正式 STL 待算法组工艺映射引擎产出（Q3 后段）",
            }
            for tid in [
                "t_french_white", "t_nude_gradient", "t_cat_eye_nude", "t_y2k_ice", "t_dark_gradient",
                "t_chrome_mirror", "t_checkerboard", "t_3d_waterdrop", "t_classic_high_gloss", "t_holiday_glitter",
            ]
            for shape in params["shapes"].keys()
        ],
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[generate-mock-stl] wrote mock-shell.stl ({stl.count('facet normal')} facets) + manifest.json ({len(manifest['entries'])} entries, MOCK_PENDING_ALGO)")


if __name__ == "__main__":
    main()
