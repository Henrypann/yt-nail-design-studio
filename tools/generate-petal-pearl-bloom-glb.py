#!/usr/bin/env python3
"""Generate deterministic preview-only Petal Pearl Bloom component GLBs.

The meshes are communication assets for Editor V7 simulated preview. They do
not encode attachment engineering, material curing, fit, or manufacturing data.
"""

from __future__ import annotations

from pathlib import Path
import math

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/glb/components/petal-pearl-bloom"


def material(name: str, color: tuple[int, int, int, int], metallic: float = 0.0, roughness: float = 0.28):
    return trimesh.visual.material.PBRMaterial(
        name=name,
        baseColorFactor=color,
        metallicFactor=metallic,
        roughnessFactor=roughness,
        alphaMode="BLEND" if color[3] < 255 else "OPAQUE",
        doubleSided=True,
    )


def sphere(radius: float, center: tuple[float, float, float], mat) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=3, radius=radius)
    mesh.apply_translation(center)
    mesh.visual.material = mat
    return mesh


def export(name: str, geometry: list[trimesh.Trimesh]) -> None:
    target = OUT / name / f"{name}.web.glb"
    target.parent.mkdir(parents=True, exist_ok=True)
    scene = trimesh.Scene()
    for index, mesh in enumerate(geometry):
        scene.add_geometry(mesh, node_name=f"{name}-{index}")
    # `include_normals=False` keeps generation independent of optional scipy;
    # WebGL derives smooth normals at render time for these preview primitives.
    target.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=False))


def flower() -> list[trimesh.Trimesh]:
    clear = material("clear-petal-simulated", (255, 218, 235, 105), roughness=0.12)
    ruby = material("ruby-center-simulated", (158, 4, 57, 255), roughness=0.18)
    silver = material("silver-studs-simulated", (224, 229, 234, 255), metallic=0.92, roughness=0.14)
    parts: list[trimesh.Trimesh] = []
    for index in range(5):
        angle = math.radians(index * 72 + 90)
        petal = trimesh.creation.icosphere(subdivisions=3, radius=1.0)
        petal.apply_scale((1.28, 2.45, 0.27))
        petal.apply_translation((0, 1.8, 0.22))
        petal.apply_transform(trimesh.transformations.rotation_matrix(angle - math.pi / 2, (0, 0, 1)))
        petal.visual.material = clear
        parts.append(petal)
    parts.append(sphere(0.55, (0, 0, 0.42), ruby))
    for index in range(6):
        angle = index * math.tau / 6
        parts.append(sphere(0.22, (math.cos(angle) * 0.46, math.sin(angle) * 0.46, 0.82), silver))
    return parts


def pearl() -> list[trimesh.Trimesh]:
    return [sphere(1.05, (0, 0, 1.0), material("lavender-pearl-simulated", (202, 177, 240, 255), roughness=0.08))]


def silver_cluster() -> list[trimesh.Trimesh]:
    silver = material("silver-studs-simulated", (224, 229, 234, 255), metallic=0.94, roughness=0.12)
    parts = [sphere(0.38, (0, 0, 0.38), silver)]
    for index in range(5):
        angle = index * math.tau / 5
        parts.append(sphere(0.36, (math.cos(angle) * 0.68, math.sin(angle) * 0.68, 0.36), silver))
    return parts


def ruby_cluster() -> list[trimesh.Trimesh]:
    ruby = material("ruby-beads-simulated", (151, 0, 49, 255), roughness=0.11)
    return [sphere(0.32, (-0.46, 0.3, 0.31), ruby), sphere(0.32, (0.46, 0.38, 0.31), ruby), sphere(0.32, (0.12, -0.44, 0.31), ruby)]


if __name__ == "__main__":
    export("crystal-flower", flower())
    export("lavender-pearl", pearl())
    export("silver-stud-cluster", silver_cluster())
    export("ruby-microbeads", ruby_cluster())
    print("generated 4 Petal Pearl Bloom simulated preview GLBs")
