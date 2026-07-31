#!/usr/bin/env python3
"""validate-assets.py · 素材入库质量检查（DEV-PLAN §5.8 六项 + §4.8 资产 DoD）

对 material-library/ 与 assets/ 执行入库强制检查，任何一项失败即退出码 1
（无 reason 的不建议关系禁止入库——§5.5 / §9 红线）。

检查项（对应 §5.8）：
  1. 每套模板所有已适配甲型的图案 SVG viewBox 一致
  2. 图案不溢出甲型轮廓（静态近似检查：必须内嵌 nail-clip clipPath 且
     全部 artwork 位于 clip 组内 + 数值坐标不超出 viewBox 容差范围；
     正式的像素级溢出检查由预览 Pipeline 执行）
  3. 缩略图存在且为合法 PNG
  4. manifest.json 引用的文件全部存在
  5. shape_compatibility 不含不存在的甲型 ID；not_recommended 必有非空 reason；
     每模板三档覆盖全部 templates=complete 甲型且不重复
  6. 所有已注册几何 × 4 长度的轮廓 SVG 全部存在且可解析

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
import struct
import sys
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "material-library"
ASSETS = ROOT / "assets"

LENGTH_IDS = {"short", "medium", "long", "extra-long"}
FINISH_IDS = {"gloss", "matte", "pearl"}
STYLE_TAGS = {"trending", "sweet", "minimal", "cool", "retro", "luxe", "holiday"}
EXPECTED_CANONICAL_TEMPLATE_COUNT = 12
EXPECTED_CONCEPT_TEMPLATE_COUNT = 1
EXPECTED_TIER_ONE = {"almond", "oval", "squoval", "square", "coffin"}
EXPECTED_WIZARD_ENABLED = {"almond", "oval", "coffin"}
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


@lru_cache(maxsize=1)
def shape_sets() -> tuple[set[str], set[str], set[str]]:
    """返回（产品注册、已有几何、模板完整）甲型集合，并校验非几何能力门禁。"""
    registry = load_json(LIB / "shapes" / "shape-capabilities.json")
    if not registry:
        return set(), set(), set()
    items = registry.get("shapes", [])
    if not (10 <= len(items) <= 15):
        err(f"shape-capabilities 注册数量 = {len(items)}，应为 10–15")

    ids = [item.get("id") for item in items]
    registered = set(ids)
    if len(registered) != len(ids):
        err("shape-capabilities 存在重复 id")
    tier_one = [item for item in items if item.get("tier") == 1]
    tier_two = [item for item in items if item.get("tier") == 2]
    if len(tier_one) != 5:
        err(f"Tier 1 数量 = {len(tier_one)}，应为 5")
    tier_one_ids = {item.get("id") for item in tier_one}
    if tier_one_ids != EXPECTED_TIER_ONE:
        err(f"Tier 1 集合错误: {sorted(tier_one_ids)}，应为 {sorted(EXPECTED_TIER_ONE)}")
    if len(tier_two) != len(items) - 5:
        err("除 Tier 1 外的甲型必须全部属于 Tier 2")
    for tier in (tier_one, tier_two):
        orders = [item.get("order") for item in tier]
        if len(set(orders)) != len(orders) or not all(isinstance(order, int) and order > 0 for order in orders):
            err(f"Tier {tier[0].get('tier') if tier else '?'} order 必须为不重复的正整数")

    geometry_ids: set[str] = set()
    template_ids: set[str] = set()
    wizard_enabled_ids: set[str] = set()
    aliases: set[str] = set()
    for item in items:
        sid = item.get("id", "<missing>")
        caps = item.get("capabilities", {})
        geometry_id = item.get("geometry_id")
        geometry_status = caps.get("geometry")
        item_aliases = item.get("aliases", [])
        if not isinstance(item_aliases, list):
            err(f"{sid}: aliases 必须是数组")
            item_aliases = []
        for alias in item_aliases:
            if alias in registered or alias in aliases:
                err(f"{sid}: alias 重复或与正式 id 冲突: {alias}")
            aliases.add(alias)

        if geometry_status == "placeholder":
            if geometry_id is not None:
                err(f"{sid}: placeholder 不得绑定 geometry_id")
        else:
            if geometry_id != sid:
                err(f"{sid}: 当前几何就绪项 geometry_id 必须与产品 id 一致")
            geometry_ids.add(sid)
        if caps.get("templates") == "complete":
            template_ids.add(sid)
        if caps.get("wizard") == "enabled":
            wizard_enabled_ids.add(sid)
            required = {
                "geometry": "signed_off",
                "templates": "complete",
                "styles": "complete",
            }
            for key, expected in required.items():
                if caps.get(key) != expected:
                    err(f"{sid}: wizard enabled 但 {key}={caps.get(key)}，应为 {expected}")
            if geometry_id is None:
                err(f"{sid}: wizard enabled 但 geometry_id 为空")
    if wizard_enabled_ids != EXPECTED_WIZARD_ENABLED:
        err(
            f"Wizard 开放甲型错误: {sorted(wizard_enabled_ids)}，"
            f"应为 {sorted(EXPECTED_WIZARD_ENABLED)}"
        )

    generated = ROOT / "src" / "generated" / "shape-types.ts"
    if not generated.exists():
        err("缺少生成类型 src/generated/shape-types.ts")
    else:
        match = re.search(r"NAIL_SHAPE_IDS\s*=\s*(\[[\s\S]*?\])\s+as const", generated.read_text(encoding="utf-8"))
        if not match or json.loads(match.group(1)) != ids:
            err("shape-types.ts 与 shape-capabilities.json 不同步，请运行 npm run generate:shape-types")

    return registered, geometry_ids, template_ids


def parse_svg(path: Path) -> ET.Element | None:
    try:
        return ET.parse(path).getroot()
    except Exception as e:  # noqa: BLE001
        err(f"SVG 不是合法 XML: {path.relative_to(ROOT)}: {e}")
        return None


def check_templates() -> None:
    _, _, template_shape_ids = shape_sets()
    index = load_json(LIB / "index.json")
    if not index:
        return
    if set(index.get("shape_ids", [])) != template_shape_ids:
        err(
            "index.json shape_ids 必须等于 shape-capabilities 中 templates=complete 的集合: "
            f"{sorted(template_shape_ids)}"
        )
    templates = index.get("templates", [])
    canonical_templates = [t for t in templates if t.get("asset_status", "REAL") == "REAL"]
    concept_templates = [t for t in templates if t.get("asset_status") == "CONCEPT"]
    if len(canonical_templates) != EXPECTED_CANONICAL_TEMPLATE_COUNT:
        err(
            f"index.json 正式模板数量 = {len(canonical_templates)}，"
            f"应为 {EXPECTED_CANONICAL_TEMPLATE_COUNT}"
        )
    if len(concept_templates) != EXPECTED_CONCEPT_TEMPLATE_COUNT:
        err(
            f"index.json Concept 模板数量 = {len(concept_templates)}，"
            f"应为 {EXPECTED_CONCEPT_TEMPLATE_COUNT}"
        )

    seen_ids: set[str] = set()
    all_viewboxes: set[str] = set()
    all_ids = {t.get("id") for t in templates}

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
                if sid not in template_shape_ids:
                    err(f"{tid}: {bucket} 含不存在的甲型 ID: {sid}")
                covered.append(sid)
        nr = compat.get("not_recommended", {})
        if not isinstance(nr, dict):
            err(f"{tid}: not_recommended 必须是对象（shape → reason），无 reason 的不建议关系禁止入库")
            nr = {}
        for sid, reason in nr.items():
            if sid not in template_shape_ids:
                err(f"{tid}: not_recommended 含不存在的甲型 ID: {sid}")
            if not isinstance(reason, str) or not reason.strip():
                err(f"{tid}: not_recommended.{sid} 缺少人类可读 reason（入库红线）")
            covered.append(sid)
        if sorted(covered) != sorted(template_shape_ids):
            err(f"{tid}: 三档适配未完整覆盖模板就绪甲型或存在重复: {sorted(covered)}")

        # 风格标签
        tags = t.get("style_tags", [])
        if not tags or not set(tags) & STYLE_TAGS:
            err(f"{tid}: style_tags 至少需含一个已注册风格标签: {sorted(STYLE_TAGS)}")

        # finish / base_color 合法性
        if t.get("default_finish") not in FINISH_IDS:
            err(f"{tid}: default_finish 非法: {t.get('default_finish')}")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", t.get("default_base_color", "")):
            err(f"{tid}: default_base_color 非法: {t.get('default_base_color')}")

        asset_status = t.get("asset_status", "REAL")
        if asset_status not in {"REAL", "CONCEPT"}:
            err(f"{tid}: asset_status 必须为 REAL 或 CONCEPT")
        if asset_status == "CONCEPT":
            render_template_id = t.get("render_template_id")
            if not render_template_id or render_template_id == tid or render_template_id not in all_ids:
                err(f"{tid}: CONCEPT 必须指向另一个已注册 render_template_id")
            else:
                render_target = next((item for item in templates if item.get("id") == render_template_id), None)
                if render_target and render_target.get("asset_status", "REAL") != "REAL":
                    err(f"{tid}: render_template_id 必须指向 REAL 模板")
            spec_url = str(t.get("asset_spec_url", ""))
            if not spec_url or not (ROOT / spec_url.lstrip("/")).exists():
                err(f"{tid}: CONCEPT 的 Asset Spec 不存在: {spec_url}")
            summary = t.get("capability_summary", {})
            if not summary.get("supported") or not summary.get("pending"):
                err(f"{tid}: CONCEPT 必须同时声明 supported 与 pending 能力")
            turl = t.get("thumbnail_url")
            if not turl or not (ROOT / turl.lstrip("/")).exists():
                err(f"{tid}: Concept 缩略图不存在: {turl}")
            # Concept 没有自己的 Canonical pattern；后续正式化时再进入下方几何资产校验。
            continue

        # ---- §5.8-4 manifest 引用文件存在
        mpath = ROOT / t.get("manifest_url", f"material-library/templates/{tid}/manifest.json")
        manifest = load_json(mpath) if mpath.exists() else None
        if not mpath.exists():
            err(f"{tid}: manifest 不存在: {mpath.relative_to(ROOT)}")
            continue
        if manifest is None:
            continue
        patterns = manifest.get("patterns", {})
        if set(patterns.keys()) != template_shape_ids:
            err(f"{tid}: manifest.patterns 未覆盖模板就绪甲型: {sorted(patterns.keys())}")
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
            if tid in {"t_french_white", "t_petal_veil_french"}:
                smile = re.search(r"M -60 (-?\d+(?:\.\d+)?) Q 0 (-?\d+(?:\.\d+)?) 60", text)
                if not smile:
                    err(f"{tid}/{sid}: 缺少可验证的法式微笑线路径")
                else:
                    wing_y, center_y = map(float, smile.groups())
                    if sid == "square":
                        if center_y != wing_y:
                            err(f"{tid}/{sid}: 方形法式应保持平直")
                    elif center_y >= wing_y:
                        err(
                            f"{tid}/{sid}: 微笑线中心必须朝甲尖（centerY < wingY），"
                            f"实际 {center_y} >= {wing_y}"
                        )
            # 剥离 hex 色值与 url(...) 引用后再提取坐标数值，避免误判
            artwork = text.split("</defs>")[-1]
            artwork = re.sub(r"viewBox=\"[^\"]*\"", "", artwork)
            artwork = re.sub(r"#[0-9A-Fa-f]{3,8}\b", "", artwork)
            nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", artwork)]
            if nums and (max(nums) > 260 or min(nums) < -260):
                err(f"{tid}/{sid}: 图案坐标超出合理范围（§5.8-2）")

        # ---- §5.8-1 已适配甲型 SVG viewBox 一致
        if len(viewboxes) > 1:
            err(f"{tid}: 图案 SVG viewBox 不一致: {sorted(viewboxes)} (§5.8-1)")

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


def image_size(path: Path) -> tuple[int, int] | None:
    if path.suffix.lower() == ".png":
        data = path.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n" or len(data) < 24:
            return None
        return struct.unpack(">II", data[16:24])
    if path.suffix.lower() == ".svg":
        root = parse_svg(path)
        if root is None:
            return None
        view_box = root.attrib.get("viewBox", "").split()
        if len(view_box) == 4:
            return round(float(view_box[2])), round(float(view_box[3]))
        width = re.sub(r"[^0-9.]", "", root.attrib.get("width", ""))
        height = re.sub(r"[^0-9.]", "", root.attrib.get("height", ""))
        if width and height:
            return round(float(width)), round(float(height))
    return None


def check_styles() -> None:
    registry = load_json(LIB / "shapes" / "shape-capabilities.json")
    index = load_json(LIB / "index.json")
    manifest = load_json(ASSETS / "styles" / "manifest.json")
    if not registry or not index or not manifest:
        return
    valid_templates = {item.get("id") for item in index.get("templates", [])}
    valid_lengths = LENGTH_IDS
    recommendations = manifest.get("recommendations", {})
    styles_ready = {
        item.get("id")
        for item in registry.get("shapes", [])
        if item.get("capabilities", {}).get("styles") == "complete"
    }
    for sid in styles_ready:
        items = recommendations.get(sid, [])
        if len(items) < 3:
            err(f"styles complete 的 {sid} 推荐数 = {len(items)}，应 ≥ 3")
            continue
        priorities = [item.get("priority") for item in items]
        if len(set(priorities)) != len(priorities):
            err(f"{sid}: 风格推荐 priority 必须唯一")
        featured = [item for item in items if item.get("featured") is True]
        if featured and len(featured) != 3:
            err(f"{sid}: 启用 featured 后必须恰好有 3 个，实际 {len(featured)}")
        for item in items:
            style_id = item.get("id", "<missing>")
            template_id = item.get("template_id")
            if template_id is not None and template_id not in valid_templates:
                err(f"{sid}/{style_id}: template_id 不存在: {template_id}")
            lengths = item.get("best_lengths", [])
            if not lengths or not set(lengths).issubset(valid_lengths):
                err(f"{sid}/{style_id}: best_lengths 非法: {lengths}")
            cover_status = item.get("cover_status")
            if cover_status not in {"REAL", "CONCEPT", "MOCK"}:
                err(f"{sid}/{style_id}: cover_status 必须为 REAL、CONCEPT 或 MOCK")
            if cover_status == "CONCEPT":
                if item.get("preview_fidelity") != "APPROXIMATE":
                    err(f"{sid}/{style_id}: CONCEPT 必须标记 preview_fidelity=APPROXIMATE")
                if not str(item.get("concept_note", "")).strip():
                    err(f"{sid}/{style_id}: CONCEPT 必须提供 concept_note，说明画布为近似基础方案")
                spec_url = item.get("asset_spec_url", "")
                spec = ROOT / str(spec_url).lstrip("/")
                if not spec_url or not spec.exists():
                    err(f"{sid}/{style_id}: CONCEPT 的 Asset Spec 不存在: {spec_url}")
            cover_url = item.get("cover_url", "")
            cover = ROOT / cover_url.lstrip("/")
            if not cover.exists():
                err(f"{sid}/{style_id}: cover 不存在: {cover_url}")
                continue
            if image_size(cover) != (1280, 720):
                err(f"{sid}/{style_id}: cover 必须为 1280×720，实际 {image_size(cover)}")


def check_compatibility_rules() -> None:
    taxonomy = load_json(LIB / "taxonomy" / "nail-design-taxonomy.json")
    rules = load_json(LIB / "taxonomy" / "compatibility-rules.json")
    if not taxonomy or not rules:
        return

    shape_ids = set(taxonomy.get("shapes", []))
    length_ids = {item.get("id") for item in taxonomy.get("length_presets", [])}
    look_ids = {item.get("id") for item in taxonomy.get("look_presets", [])}
    policy = rules.get("policy", {})
    if (
        policy.get("mode") != "advisory"
        or policy.get("allow_override") is not True
        or policy.get("auto_select_length") is not False
    ):
        err("compatibility-rules 必须保持 advisory、允许覆盖且不得自动改选长度")

    severity = rules.get("severity", {})
    for level in ("caution", "strong"):
        if severity.get(level, {}).get("selectable") is not True:
            err(f"compatibility-rules severity.{level} 必须保持 selectable=true")

    def check_rule(rule: dict, dimension: str, valid_ids: set[str]) -> None:
        key = f"{dimension}_id"
        entity_id = rule.get(key)
        if entity_id not in valid_ids:
            err(f"compatibility-rules {key} 非法: {entity_id}")
        recommended = set(rule.get("recommended", []))
        warning = rule.get("warning", {})
        warning_lengths = set(warning)
        if not recommended.issubset(length_ids):
            err(f"compatibility-rules {entity_id}: recommended 含非法长度")
        if not warning_lengths.issubset(length_ids):
            err(f"compatibility-rules {entity_id}: warning 含非法长度")
        if recommended & warning_lengths:
            err(f"compatibility-rules {entity_id}: 同一长度不能同时 recommended 和 warning")
        for length_id, item in warning.items():
            if item.get("severity") not in {"caution", "strong"}:
                err(f"compatibility-rules {entity_id}/{length_id}: severity 非法")
            reason = item.get("reason", {})
            if not reason.get("zh") or not reason.get("en"):
                err(f"compatibility-rules {entity_id}/{length_id}: 缺少中英文 reason")

    shape_rules = rules.get("shape_length", [])
    if len({item.get("shape_id") for item in shape_rules}) != len(shape_rules):
        err("compatibility-rules shape_length 存在重复 shape_id")
    for rule in shape_rules:
        check_rule(rule, "shape", shape_ids)

    look_rules = rules.get("look_length", [])
    if len({item.get("look_id") for item in look_rules}) != len(look_rules):
        err("compatibility-rules look_length 存在重复 look_id")
    for rule in look_rules:
        check_rule(rule, "look", look_ids)


def check_shapes() -> None:
    _, geometry_shape_ids, _ = shape_sets()
    params = load_json(LIB / "shapes" / "shape-params.json")
    if not params:
        return
    if set(params.get("shapes", {}).keys()) != geometry_shape_ids:
        err(f"shape-params.json 甲型集合非法: {sorted(params.get('shapes', {}))}")
    if set(params.get("lengths", {}).keys()) != LENGTH_IDS:
        err(f"shape-params.json 长度集合非法: {sorted(params.get('lengths', {}))}")
    registry = load_json(LIB / "shapes" / "shape-capabilities.json") or {}
    by_id = {item.get("id"): item for item in registry.get("shapes", [])}
    for sid in sorted(geometry_shape_ids):
        status = by_id.get(sid, {}).get("capabilities", {}).get("geometry")
        shape_params = params.get("shapes", {}).get(sid, {})
        signed_off_at = shape_params.get("signed_off_at")
        if status == "signed_off" and not signed_off_at:
            err(f"{sid}: geometry=signed_off 但 shape-params 缺少 signed_off_at")
        if shape_params.get("sidewallProfile") == "single-convex":
            power = float(shape_params.get("sidewallPower", 0))
            tip_width = float(shape_params.get("tipWidthRatio", 0))
            if power <= 1:
                err(f"{sid}: single-convex 的 sidewallPower 必须 > 1，实际 {power}")
                continue
            widths = [
                1.0 - (1.0 - tip_width) * (i / 40) ** power
                for i in range(41)
            ]
            if any(widths[i + 1] >= widths[i] for i in range(40)):
                err(f"{sid}: single-convex 侧壁必须从甲根到甲尖单调收窄")
            second_differences = [
                widths[i + 1] - 2 * widths[i] + widths[i - 1]
                for i in range(1, 40)
            ]
            if any(delta >= 1e-9 for delta in second_differences):
                err(f"{sid}: single-convex 侧壁出现反向曲率或 S 形拐点")
    # ---- §5.8-6 已注册几何 × 4 长度全组合存在且可解析
    for sid in sorted(geometry_shape_ids):
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
    registered_shape_ids, geometry_shape_ids, template_shape_ids = shape_sets()
    check_templates()
    check_styles()
    check_compatibility_rules()
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
    print(
        f"  - {len(registered_shape_ids)} 个产品甲型注册；Tier 1 = 5；"
        f"Wizard enabled = {sum(1 for item in (load_json(LIB / 'shapes' / 'shape-capabilities.json') or {}).get('shapes', []) if item.get('capabilities', {}).get('wizard') == 'enabled')}"
    )
    print(
        f"  - {EXPECTED_CANONICAL_TEMPLATE_COUNT} 正式模板 × {len(template_shape_ids)} 个模板就绪甲型 = "
        f"{EXPECTED_CANONICAL_TEMPLATE_COUNT * len(template_shape_ids)} 图案 SVG；"
        f"{EXPECTED_CONCEPT_TEMPLATE_COUNT} 个 Concept 模板（明确降级渲染）"
    )
    print(
        f"  - {len(geometry_shape_ids)} 个几何甲型 × {len(LENGTH_IDS)} 长度 = "
        f"{len(geometry_shape_ids) * len(LENGTH_IDS)} 轮廓 SVG；色板 8 色；质感 3 项"
    )
    print("  - 手部双视图 + 20 NailSlot 锚点；4 附件（heightMm ≤ 0.30）；4 插画；STL MOCK_PENDING_ALGO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
