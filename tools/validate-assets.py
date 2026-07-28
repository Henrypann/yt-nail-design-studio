#!/usr/bin/env python3
"""validate-assets.py · 素材入库质量检查（DEV-PLAN §5.8 六项 + §4.8 资产 DoD）

对 material-library/ 与 assets/ 执行入库强制检查，任何一项失败即退出码 1
（无 reason 的不建议关系禁止入库——§5.5 / §9 红线）。

检查项（对应 §5.8）：
  1. 每套模板 6 个图案 SVG 的 viewBox 一致（本库进一步要求全库 60 个一致）
  2. 图案不溢出甲型轮廓（静态近似检查：必须内嵌 nail-clip clipPath 且
     全部 artwork 位于 clip 组内 + 数值坐标不超出 viewBox 容差范围；
     正式的像素级溢出检查由预览 Pipeline 执行）
  3. 缩略图存在且为合法 PNG
  4. manifest.json 引用的文件全部存在
  5. shape_compatibility 不含不存在的甲型 ID；not_recommended 必有非空 reason；
     每模板三档覆盖全部 6 甲型且不重复
  6. 6 甲型 × 4 长度 = 24 个轮廓 SVG 全部存在且可解析（预览全组合前置条件）

附加资产检查（§4.8）：
  - 手部双视图 SVG + hands/manifest.json + slots 双 JSON（10 锚点、字段合法、
    归一化坐标 ∈ [0,1]、fingerCode 覆盖 L1–L5/R1–R5）
  - 附件 manifest：文件存在、heightMm ∈ [0.05, 0.30]（§9 红线）
  - 色板恰好 8 色、hex 合法；质感恰含 gloss/matte/pearl
  - STL manifest 状态为 MOCK_PENDING_ALGO 且 mock 文件存在
  - 全部 SVG 为合法 XML
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "material-library"
ASSETS = ROOT / "assets"

SHAPE_IDS = {"almond", "coffin", "squoval", "round", "square", "stiletto"}
LENGTH_IDS = {"short", "medium", "long", "extra-long"}
FINISH_IDS = {"gloss", "matte", "pearl"}
STYLE_TAGS = {"trending", "sweet", "minimal", "cool", "retro", "luxe", "holiday"}
EXPECTED_TEMPLATE_COUNT = 12
FINGER_CODES = {f"{h}{i}" for h in "LR" for i in range(1, 6)}

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(f"JSON 解析失败: {path.relative_to(ROOT)}: {e}")
        return None


def parse_svg(path: Path) -> ET.Element | None:
    try:
        return ET.parse(path).getroot()
    except Exception as e:  # noqa: BLE001
        err(f"SVG 不是合法 XML: {path.relative_to(ROOT)}: {e}")
        return None


def check_templates() -> None:
    index = load_json(LIB / "index.json")
    if not index:
        return
    templates = index.get("templates", [])
    if len(templates) != EXPECTED_TEMPLATE_COUNT:
        err(f"index.json 模板数量 = {len(templates)}，应为 {EXPECTED_TEMPLATE_COUNT}")

    seen_ids: set[str] = set()
    all_viewboxes: set[str] = set()

    for t in templates:
        tid = t.get("id", "<missing>")
        if tid in seen_ids:
            err(f"模板 id 重复: {tid}")
        seen_ids.add(tid)

        # ---- §5.8-5 shape_compatibility 合法性
        compat = t.get("shape_compatibility", {})
        buckets: dict[str, list[str]] = {"highly_compatible": [], "neutral": []}
        covered: list[str] = []
        for bucket in ("highly_compatible", "neutral"):
            ids = compat.get(bucket, [])
            if not isinstance(ids, list):
                err(f"{tid}: {bucket} 必须是数组")
                continue
            for sid in ids:
                if sid not in SHAPE_IDS:
                    err(f"{tid}: {bucket} 含不存在的甲型 ID: {sid}")
                covered.append(sid)
        nr = compat.get("not_recommended", {})
        if not isinstance(nr, dict):
            err(f"{tid}: not_recommended 必须是对象（shape → reason），无 reason 的不建议关系禁止入库")
            nr = {}
        for sid, reason in nr.items():
            if sid not in SHAPE_IDS:
                err(f"{tid}: not_recommended 含不存在的甲型 ID: {sid}")
            if not isinstance(reason, str) or not reason.strip():
                err(f"{tid}: not_recommended.{sid} 缺少人类可读 reason（入库红线）")
            covered.append(sid)
        if sorted(covered) != sorted(SHAPE_IDS):
            err(f"{tid}: 三档适配未完整覆盖 6 甲型或存在重复: {sorted(covered)}")

        # 风格标签
        tags = t.get("style_tags", [])
        if not tags or not set(tags) & STYLE_TAGS:
            err(f"{tid}: style_tags 至少需含一个已注册风格标签: {sorted(STYLE_TAGS)}")

        # finish / base_color 合法性
        if t.get("default_finish") not in FINISH_IDS:
            err(f"{tid}: default_finish 非法: {t.get('default_finish')}")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", t.get("default_base_color", "")):
            err(f"{tid}: default_base_color 非法: {t.get('default_base_color')}")

        # ---- §5.8-4 manifest 引用文件存在
        mpath = ROOT / t.get("manifest_url", f"material-library/templates/{tid}/manifest.json")
        manifest = load_json(mpath) if mpath.exists() else None
        if not mpath.exists():
            err(f"{tid}: manifest 不存在: {mpath.relative_to(ROOT)}")
            continue
        if manifest is None:
            continue
        patterns = manifest.get("patterns", {})
        if set(patterns.keys()) != SHAPE_IDS:
            err(f"{tid}: manifest.patterns 未覆盖 6 甲型: {sorted(patterns.keys())}")
        viewboxes: set[str] = set()
        for sid, rel in patterns.items():
            fpath = mpath.parent / rel
            if not fpath.exists():
                err(f"{tid}: manifest 引用文件不存在: {fpath.relative_to(ROOT)} (§5.8-4)")
                continue
            root_el = parse_svg(fpath)
            if root_el is None:
                continue
            vb = root_el.get("viewBox", "")
            viewboxes.add(vb)
            all_viewboxes.add(vb)
            # ---- §5.8-2 图案不溢出（静态近似）
            text = fpath.read_text(encoding="utf-8")
            if 'id="nail-clip"' not in text or 'clip-path="url(#nail-clip)"' not in text:
                err(f"{tid}/{sid}: 图案 SVG 缺少 nail-clip 裁剪（溢出风险，§5.8-2）")
            # 剥离 hex 色值与 url(...) 引用后再提取坐标数值，避免误判
            artwork = text.split("</defs>")[-1]
            artwork = re.sub(r"viewBox=\"[^\"]*\"", "", artwork)
            artwork = re.sub(r"#[0-9A-Fa-f]{3,8}\b", "", artwork)
            nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", artwork)]
            if nums and (max(nums) > 260 or min(nums) < -260):
                err(f"{tid}/{sid}: 图案坐标超出合理范围（§5.8-2）")

        # ---- §5.8-1 6 个 SVG viewBox 一致
        if len(viewboxes) > 1:
            err(f"{tid}: 6 个图案 SVG viewBox 不一致: {sorted(viewboxes)} (§5.8-1)")

        # ---- §5.8-3 缩略图存在且可加载
        thumbs = manifest.get("thumbnails", {})
        if "default" not in thumbs:
            err(f"{tid}: manifest.thumbnails 缺少 default (§5.8-3)")
        for tname, trel in thumbs.items():
            tpath = mpath.parent / trel
            if not tpath.exists():
                err(f"{tid}: 缩略图不存在: {tpath.relative_to(ROOT)} (§5.8-3)")
            elif tpath.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
                err(f"{tid}: 缩略图不是合法 PNG: {tpath.relative_to(ROOT)} (§5.8-3)")
        # index.json 中的 thumbnail_url 也要存在
        turl = t.get("thumbnail_url")
        if turl and not (ROOT / turl).exists():
            err(f"{tid}: index.json thumbnail_url 不存在: {turl}")

        # uv_params
        uv = manifest.get("uv_params", {})
        for k in ("anchor_u", "anchor_v", "scale_u", "scale_v"):
            if k not in uv:
                err(f"{tid}: manifest.uv_params 缺少 {k}")

    # 全库 viewBox 一致（比 §5.8-1 更严，便于渲染器统一处理）
    if len(all_viewboxes) > 1:
        err(f"全库图案 viewBox 不统一: {sorted(all_viewboxes)}")


def check_shapes() -> None:
    params = load_json(LIB / "shapes" / "shape-params.json")
    if not params:
        return
    if set(params.get("shapes", {}).keys()) != SHAPE_IDS:
        err(f"shape-params.json 甲型集合非法: {sorted(params.get('shapes', {}))}")
    if set(params.get("lengths", {}).keys()) != LENGTH_IDS:
        err(f"shape-params.json 长度集合非法: {sorted(params.get('lengths', {}))}")
    # ---- §5.8-6 6 甲型 × 4 长度全组合存在且可解析
    for sid in sorted(SHAPE_IDS):
        for lid in sorted(LENGTH_IDS):
            fpath = LIB / "shapes" / "silhouettes" / f"{sid}_{lid.replace('-', '_')}.svg"
            if not fpath.exists():
                err(f"轮廓缺失: {fpath.relative_to(ROOT)} (§5.8-6)")
            else:
                root_el = parse_svg(fpath)
                if root_el is not None and 'id="nail-clip"' not in fpath.read_text(encoding="utf-8"):
                    err(f"轮廓缺少 nail-clip: {fpath.relative_to(ROOT)}")


def check_palette_finishes() -> None:
    palette = load_json(LIB / "colors" / "palette.json")
    if palette:
        colors = palette.get("colors", [])
        if len(colors) != 8:
            err(f"palette.json 色数 = {len(colors)}，应为 8")
        for c in colors:
            if not re.fullmatch(r"#[0-9A-Fa-f]{6}", c.get("hex", "")):
                err(f"palette.json 非法 hex: {c}")
    finishes = load_json(LIB / "finishes" / "finishes.json")
    if finishes:
        ids = {f.get("id") for f in finishes.get("finishes", [])}
        if ids != FINISH_IDS:
            err(f"finishes.json 必须恰含 gloss/matte/pearl: {sorted(ids)}")


def check_hands_slots() -> None:
    for view in ("back", "palm"):
        svg = ASSETS / "hands" / f"hand-{view}.svg"
        if not svg.exists():
            err(f"手部底图缺失: {svg.relative_to(ROOT)}")
        else:
            root_el = parse_svg(svg)
            if root_el is not None and root_el.get("viewBox") != "0 0 1200 900":
                err(f"{svg.relative_to(ROOT)}: viewBox 应为 '0 0 1200 900'，实际 {root_el.get('viewBox')}")
        slots = load_json(ASSETS / "nail-slots" / f"slots.{view}.json")
        if not slots:
            continue
        items = slots.get("slots", [])
        codes = {s.get("fingerCode") for s in items}
        if codes != FINGER_CODES:
            err(f"slots.{view}.json fingerCode 覆盖不全: 缺 {sorted(FINGER_CODES - codes)} 多 {sorted(codes - FINGER_CODES)}")
        for s in items:
            a = s.get("anchor", {})
            if not (0 <= a.get("x", -1) <= 1 and 0 <= a.get("y", -1) <= 1):
                err(f"slots.{view}.json {s.get('fingerCode')}: anchor 越界 {a}")
            if not isinstance(s.get("rotationDeg"), (int, float)):
                err(f"slots.{view}.json {s.get('fingerCode')}: rotationDeg 缺失/非法")
            if not (5 <= s.get("fingerWidthMm", 0) <= 25):
                err(f"slots.{view}.json {s.get('fingerCode')}: fingerWidthMm 异常 {s.get('fingerWidthMm')}")
        if slots.get("image") and not (ASSETS / "nail-slots" / slots["image"]).resolve().exists():
            err(f"slots.{view}.json image 指向不存在: {slots['image']}")
    hm = load_json(ASSETS / "hands" / "manifest.json")
    if hm:
        for view, v in hm.get("views", {}).items():
            for key in ("image", "slots"):
                p = (ASSETS / "hands" / v.get(key, "")).resolve()
                if not p.exists():
                    err(f"hands/manifest.json {view}.{key} 指向不存在: {v.get(key)}")


def check_decorations() -> None:
    manifest = load_json(ASSETS / "decorations" / "manifest.json")
    if not manifest:
        return
    items = manifest.get("decorations", [])
    if len(items) < 4:
        err(f"decorations manifest 组件数 = {len(items)}，应 ≥ 4（爱心/珍珠/蝴蝶结/星星）")
    for d in items:
        fpath = ASSETS / "decorations" / d.get("file", "")
        if not fpath.exists():
            err(f"附件 SVG 缺失: {fpath.relative_to(ROOT)}")
        else:
            parse_svg(fpath)
        h = d.get("defaults", {}).get("heightMm")
        if h is None or not (0.05 <= h <= 0.30):
            err(f"附件 {d.get('id')}: heightMm={h} 超出参数域 0.05–0.30（§9 红线）")


def check_illustrations_stl() -> None:
    for name in ("customers-empty", "devices-empty", "designs-empty", "404"):
        fpath = ASSETS / "illustrations" / f"{name}.svg"
        if not fpath.exists():
            err(f"空状态插画缺失: {fpath.relative_to(ROOT)}")
        else:
            parse_svg(fpath)
    stl_manifest = load_json(ASSETS / "stl" / "manifest.json")
    if stl_manifest:
        if stl_manifest.get("status") != "MOCK_PENDING_ALGO":
            err(f"stl/manifest.json status 应为 MOCK_PENDING_ALGO: {stl_manifest.get('status')}")
        mock = ASSETS / "stl" / stl_manifest.get("mock_file", "")
        if not mock.exists():
            err(f"Mock STL 缺失: {mock.relative_to(ROOT)}")
        elif not mock.read_text(encoding="ascii", errors="ignore").startswith("solid"):
            err(f"Mock STL 不是 ASCII STL: {mock.relative_to(ROOT)}")
        for e in stl_manifest.get("entries", []):
            if e.get("status") != "MOCK_PENDING_ALGO":
                err(f"STL 条目状态非法: {e}")


def main() -> int:
    check_templates()
    check_shapes()
    check_palette_finishes()
    check_hands_slots()
    check_decorations()
    check_illustrations_stl()

    for w in warnings:
        print(f"  WARN  {w}")
    if errors:
        print(f"\n[validate-assets] FAILED · {len(errors)} 个问题：")
        for e in errors:
            print(f"  FAIL  {e}")
        return 1
    print("[validate-assets] PASS · §5.8 六项检查 + §4.8 资产检查全部通过")
    print(f"  - {EXPECTED_TEMPLATE_COUNT} 模板 × 6 甲型 = {EXPECTED_TEMPLATE_COUNT * 6} 图案 SVG（viewBox 全库一致、nail-clip 齐备、引用文件齐全）")
    print("  - 6 甲型 × 4 长度 = 24 轮廓 SVG；色板 8 色；质感 3 项")
    print("  - 手部双视图 + 20 NailSlot 锚点；4 附件（heightMm ≤ 0.30）；4 插画；STL MOCK_PENDING_ALGO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
