#!/usr/bin/env python3
"""generate-nail-shapes.py · 甲型轮廓生成器（薄封装）

几何单一事实源（single source of truth）：
  daimon 托管 skills 目录
  nails-shape-svg/scripts/generate_nail_shapes.py
  （坐标约定 / 参数模型见该 skill 的 references/shape-spec.md）

本文件只做两件事：
  1. 把项目内参数源 material-library/shapes/shape-params.json 与输出目录
     material-library/shapes/silhouettes/ 传给 skill 生成器；
  2. 向下游 re-export outline_path_d / SHAPE_IDS / LENGTH_IDS ——
     generate-template-patterns.py 以 `import generate-nail-shapes` 方式
     复用同一几何（「预览 = 打印」红线，禁止第二参数源）。

CLI 行为与输出路径与 v1 完全一致：`python tools/generate-nail-shapes.py`
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARAMS_PATH = ROOT / "material-library" / "shapes" / "shape-params.json"
OUT_DIR = ROOT / "material-library" / "shapes" / "silhouettes"

SKILL_SCRIPTS_DIR = Path(
    "/Users/henry.macbook/Library/Application Support/kimi-desktop/"
    "daimon-share/daimon/skills/nails-shape-svg/scripts"
)

if str(SKILL_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPTS_DIR))

import generate_nail_shapes as _gen  # noqa: E402

# 下游 import 契约（签名不变，禁止在此另起几何）
outline_path_d = _gen.outline_path_d
outline_points = _gen.outline_points
build_svg = _gen.build_svg
silhouette_viewbox = _gen.silhouette_viewbox

# 生成集合来自项目唯一参数源，不再受外部 skill 内的历史六甲型列表限制。
# 几何计算仍 100% 复用 skill 的 outline/build 函数，本文件只负责遍历与落盘。
_params_doc = json.loads(PARAMS_PATH.read_text(encoding="utf-8"))
SHAPE_IDS = list(_params_doc["shapes"].keys())
LENGTH_IDS = list(_params_doc["lengths"].keys())


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for shape_id in SHAPE_IDS:
        shape_params = _params_doc["shapes"][shape_id]
        for length_id in LENGTH_IDS:
            length_params = _params_doc["lengths"][length_id]
            svg = build_svg(
                shape_id,
                length_id,
                length_params["lengthMm"],
                length_params["widthMm"],
                shape_params,
            )
            filename = f"{shape_id}_{length_id.replace('-', '_')}.svg"
            (OUT_DIR / filename).write_text(svg, encoding="utf-8")
            count += 1
    print(f"[generate-nail-shapes] wrote {count} silhouette SVGs -> {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
