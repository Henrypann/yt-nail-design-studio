#!/usr/bin/env python3
"""Generate deterministic preview-only GLB kits for four v0.7.2 nail Looks.

The meshes are visual communication representations. They do not establish
attachment engineering, adhesion, material, curing, fit, strength, print, or
manufacturing evidence.
"""

from __future__ import annotations

from pathlib import Path
import math

import numpy as np
import trimesh


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/glb/components/v0-7-2-four-looks"


def pbr(name: str, rgba: tuple[int, int, int, int], metallic: float = 0.0, roughness: float = 0.25):
    return trimesh.visual.material.PBRMaterial(
        name=name,
        baseColorFactor=rgba,
        metallicFactor=metallic,
        roughnessFactor=roughness,
        alphaMode="BLEND" if rgba[3] < 255 else "OPAQUE",
        doubleSided=True,
    )


GOLD = pbr("polished-gold-simulated", (233, 173, 46, 255), 0.94, 0.12)
CLEAR = pbr("clear-crystal-simulated", (222, 241, 255, 108), 0.0, 0.08)
PEARL = pbr("ivory-pearl-simulated", (255, 248, 238, 255), 0.12, 0.1)
IVORY = pbr("ivory-relief-simulated", (255, 248, 241, 255), 0.0, 0.2)
HONEY = pbr("honey-jelly-simulated", (255, 194, 58, 176), 0.0, 0.12)


def sphere(radius: float, center: tuple[float, float, float], material) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=2, radius=radius)
    mesh.apply_translation(center)
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh


def gem(scale: tuple[float, float, float], center: tuple[float, float, float], material=CLEAR) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=2, radius=1.0)
    mesh.apply_scale(scale)
    mesh.apply_translation(center)
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh


def bar(extents: tuple[float, float, float], center: tuple[float, float, float], material=GOLD) -> trimesh.Trimesh:
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(center)
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh


def bead_curve(count: int, width: float, amplitude: float, y_offset: float = 0.0) -> list[trimesh.Trimesh]:
    parts: list[trimesh.Trimesh] = []
    for index in range(count):
        t = index / max(1, count - 1)
        x = (t - 0.5) * width
        y = y_offset + math.sin((t - 0.5) * math.pi) * amplitude
        parts.append(sphere(0.19, (x, y, 0.2), GOLD))
    return parts


def flower(material, center_material, petal_scale=(0.72, 1.18, 0.2)) -> list[trimesh.Trimesh]:
    parts: list[trimesh.Trimesh] = []
    for index in range(5):
        angle = index * math.tau / 5 - math.pi / 2
        petal = trimesh.creation.icosphere(subdivisions=2, radius=1.0)
        petal.apply_scale(petal_scale)
        petal.apply_translation((0, 0.82, 0.22))
        petal.apply_transform(trimesh.transformations.rotation_matrix(angle + math.pi / 2, (0, 0, 1)))
        petal.visual = trimesh.visual.TextureVisuals(material=material)
        parts.append(petal)
    parts.append(sphere(0.34, (0, 0, 0.43), center_material))
    return parts


def lace_applique() -> list[trimesh.Trimesh]:
    parts: list[trimesh.Trimesh] = []
    for ring_index, radius in enumerate((0.55, 0.92, 1.28)):
        tube = trimesh.creation.torus(major_radius=radius, minor_radius=0.045, major_sections=32, minor_sections=6)
        tube.apply_scale((1.0, 0.62, 0.45))
        tube.apply_translation((-0.28 + ring_index * 0.18, 0.0, 0.06))
        tube.visual = trimesh.visual.TextureVisuals(material=IVORY)
        parts.append(tube)
    for index in range(7):
        angle = index * math.pi / 6
        length = 2.5
        cylinder = trimesh.creation.cylinder(radius=0.035, height=length, sections=8)
        cylinder.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, (1, 0, 0)))
        cylinder.apply_transform(trimesh.transformations.rotation_matrix(angle, (0, 0, 1)))
        cylinder.apply_translation((0, 0, 0.05))
        cylinder.visual = trimesh.visual.TextureVisuals(material=IVORY)
        parts.append(cylinder)
    return parts


def leopard_gilded() -> dict[str, list[trimesh.Trimesh]]:
    cluster = [gem((0.42, 1.05, 0.28), (0, 0, 0.32))]
    for index, position in enumerate(((-0.7, -0.45), (-0.58, 0.45), (0.58, -0.38), (0.65, 0.5), (0.0, 1.08))):
        cluster.append(sphere(0.22 if index < 4 else 0.18, (position[0], position[1], 0.25), GOLD))
    cluster.extend([gem((0.24, 0.24, 0.2), (-0.3, 0.92, 0.24)), gem((0.26, 0.26, 0.2), (0.35, -0.9, 0.24))])
    return {"gilded-crystal-cluster": cluster}


def crimson_reliquary() -> dict[str, list[trimesh.Trimesh]]:
    cross = bead_curve(20, 3.8, 0.5, 1.1) + bead_curve(18, 3.3, -0.38, -1.1)
    cross.extend([bar((0.54, 2.0, 0.24), (0, 0, 0.22)), bar((1.45, 0.46, 0.24), (0, 0.32, 0.22))])
    cross.extend([sphere(0.18, (-0.72, 0.32, 0.25), GOLD), sphere(0.18, (0.72, 0.32, 0.25), GOLD)])
    return {"gold-cross-chain": cross}


def ivory_lace_crystal() -> dict[str, list[trimesh.Trimesh]]:
    crystal = [gem((0.62, 1.12, 0.35), (0, 0, 0.36))]
    crystal.extend([sphere(0.26, (-0.58, 0.65, 0.27), PEARL), sphere(0.22, (0.62, 0.42, 0.23), PEARL)])
    crystal.extend([gem((0.25, 0.25, 0.18), (-0.6, -0.52, 0.23)), gem((0.22, 0.22, 0.17), (0.56, -0.68, 0.22))])
    return {
        "teardrop-pearl-cluster": crystal,
        "ivory-relief-flower": flower(IVORY, CLEAR),
        "ivory-lace-applique": lace_applique(),
    }


def honey_petal_glass() -> dict[str, list[trimesh.Trimesh]]:
    return {"glass-flower-pearl": flower(CLEAR, HONEY, (0.75, 1.22, 0.22)) + [sphere(0.32, (0, 0, 0.72), PEARL)]}


LOOKS = {
    "leopard-gilded-nude": leopard_gilded(),
    "crimson-reliquary": crimson_reliquary(),
    "ivory-lace-crystal": ivory_lace_crystal(),
    "honey-petal-glass": honey_petal_glass(),
}


def write_scene(path: Path, components: dict[str, list[trimesh.Trimesh]]) -> None:
    scene = trimesh.Scene()
    for component_name in sorted(components):
        for index, mesh in enumerate(components[component_name]):
            delivery = mesh.copy()
            triangles = delivery.vertices[delivery.faces]
            face_vectors = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
            lengths = np.linalg.norm(face_vectors, axis=1)
            face_vectors[lengths > 0] /= lengths[lengths > 0, None]
            vertex_normals = np.zeros_like(delivery.vertices)
            for corner in range(3):
                np.add.at(vertex_normals, delivery.faces[:, corner], face_vectors)
            normal_lengths = np.linalg.norm(vertex_normals, axis=1)
            vertex_normals[normal_lengths > 0] /= normal_lengths[normal_lengths > 0, None]
            delivery.vertex_normals = vertex_normals
            scene.add_geometry(delivery, node_name=f"{component_name}-{index:02d}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=True))


def main() -> None:
    generated = 0
    for look_id, components in LOOKS.items():
        root = OUT / look_id
        for component_name, geometry in components.items():
            write_scene(root / component_name / f"{component_name}.web.glb", {component_name: geometry})
            generated += 1
        write_scene(root / "dimensional-kit.web.glb", components)
        generated += 1
    print(f"generated {generated} simulated v0.7.2 Look GLBs")


if __name__ == "__main__":
    main()
