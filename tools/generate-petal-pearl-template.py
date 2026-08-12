#!/usr/bin/env python3
"""Generate seven Wizard preview SVGs for the Petal Pearl Bloom Look."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHAPES = ROOT / "material-library/shapes/silhouettes"
TARGET = ROOT / "material-library/templates/t_petal_pearl_bloom_simulated"


def outline(shape: str) -> tuple[str, str]:
    text = (SHAPES / f"{shape}_medium.svg").read_text(encoding="utf-8")
    view_box = text.split('viewBox="', 1)[1].split('"', 1)[0]
    path = text.split('<path d="', 1)[1].split('"', 1)[0]
    return view_box, path


def svg(shape: str) -> str:
    view_box, path = outline(shape)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" data-template="t_petal_pearl_bloom_simulated" data-shape="{shape}" data-evidence="SIMULATED" data-units="0.1mm" data-origin="nail-root-center">
  <defs>
    <clipPath id="nail-clip"><path d="{path}"/></clipPath>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFF8FB" stop-opacity=".74"/><stop offset="1" stop-color="#EFB9CB" stop-opacity=".86"/></linearGradient>
    <radialGradient id="crystal"><stop stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="#F7B8D0" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></radialGradient>
    <radialGradient id="pearl"><stop stop-color="#fff"/><stop offset=".35" stop-color="#D8C0F2"/><stop offset="1" stop-color="#9271BD"/></radialGradient>
  </defs>
  <g clip-path="url(#nail-clip)">
    <rect x="-60" y="-200" width="120" height="220" fill="url(#base)"/>
    <g transform="translate(0 -92) scale(.62)" fill="url(#crystal)" stroke="#fff" stroke-width="2">
      <ellipse cy="-22" rx="13" ry="25"/><ellipse cy="-22" rx="13" ry="25" transform="rotate(72)"/><ellipse cy="-22" rx="13" ry="25" transform="rotate(144)"/><ellipse cy="-22" rx="13" ry="25" transform="rotate(216)"/><ellipse cy="-22" rx="13" ry="25" transform="rotate(288)"/>
      <circle r="7" fill="#B80A46"/><g fill="#E6EBEF" stroke="#777" stroke-width="1"><circle cx="-5" r="3.2"/><circle cx="5" r="3.2"/><circle cy="-5" r="3.2"/></g>
    </g>
    <circle cx="-26" cy="-142" r="8" fill="url(#pearl)" stroke="#F2E9FF" stroke-width="2"/>
    <g fill="#A70038" stroke="#FFD9E5" stroke-width="1"><circle cx="24" cy="-55" r="3"/><circle cx="31" cy="-47" r="3"/><circle cx="20" cy="-43" r="3"/></g>
  </g>
</svg>'''


if __name__ == "__main__":
    shapes = ["almond", "oval", "coffin", "squoval", "round", "square", "stiletto"]
    (TARGET / "patterns").mkdir(parents=True, exist_ok=True)
    for shape in shapes:
        (TARGET / "patterns" / f"{shape}.svg").write_text(svg(shape), encoding="utf-8")
    manifest = {
        "template_id": "t_petal_pearl_bloom_simulated", "version": 1, "asset_status": "SIMULATED",
        "renderer_id": "svg-2.5d/petal-pearl-bloom-1", "visual_signoff": "pending_designer_trial",
        "manufacturing": "blocked/unvalidated", "patterns": {shape: f"patterns/{shape}.svg" for shape in shapes},
        "uv_params": {"anchor_u": 0.5, "anchor_v": 0.85, "scale_u": 1.0, "scale_v": 1.0},
    }
    (TARGET / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("generated 7 Petal Pearl Bloom Wizard preview SVGs")
