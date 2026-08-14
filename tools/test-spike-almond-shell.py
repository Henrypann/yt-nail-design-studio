#!/usr/bin/env python3
"""Independent acceptance gates for the simulated almond shell candidate."""

from __future__ import annotations

import hashlib
import io
import json
import math
from pathlib import Path
import platform
import re
import subprocess
import struct
import sys
import tempfile

import numpy as np
import trimesh


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "tools/generate-spike-almond-shell.py"
PARAMS = ROOT / "material-library/shapes/shape-params.json"
SILHOUETTE = ROOT / "material-library/shapes/silhouettes/almond_medium.svg"
CANDIDATE_PROFILE = ROOT / "assets/shape-calibration/candidates/almond-medium-elegant-v1.json"
REQUIREMENTS = ROOT / "tools/requirements-spike-almond-shell.txt"
STL_RELATIVE = Path("assets/stl/spike/almond-medium-shell-v3.simulated.stl")
GLB_RELATIVE = Path("assets/glb/shells/almond/medium-candidate-v3/shell.web.glb")
MANIFEST_RELATIVE = Path("assets/glb/shells/almond/medium-candidate-v3/shell.manifest.json")
REPORT_RELATIVE = Path("assets/glb/shells/almond/medium-candidate-v3/geometry-report.json")
QUANTIZATION_MM = 1e-5
NUMBER_TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
PATH_DATA = re.compile(r"<path\b[^>]*\bd=(['\"])(.*?)\1[^>]*>", re.IGNORECASE | re.DOTALL)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sample_signed_outline(svg: str, samples_per_cubic: int = 192) -> np.ndarray:
    paths = list(dict.fromkeys(match.group(2).strip() for match in PATH_DATA.finditer(svg)))
    require(len(paths) == 1, f"signed SVG must have exactly one path, found {len(paths)}")
    tokens = NUMBER_TOKEN.findall(paths[0])
    cursor = 0
    command = ""
    current = np.zeros(2, dtype=np.float64)
    start = np.zeros(2, dtype=np.float64)
    points: list[np.ndarray] = []

    def number() -> float:
        nonlocal cursor
        require(cursor < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[cursor]), "malformed signed SVG path")
        value = float(tokens[cursor])
        cursor += 1
        require(math.isfinite(value), "signed SVG contains a non-finite coordinate")
        return value

    while cursor < len(tokens):
        if re.fullmatch(r"[A-Za-z]", tokens[cursor]):
            command = tokens[cursor].upper()
            cursor += 1
        if command == "M":
            current = np.array([number(), number()], dtype=np.float64)
            start = current.copy()
            points.append(current.copy())
            command = "L"
        elif command == "L":
            current = np.array([number(), number()], dtype=np.float64)
            points.append(current.copy())
        elif command == "C":
            c1 = np.array([number(), number()], dtype=np.float64)
            c2 = np.array([number(), number()], dtype=np.float64)
            end = np.array([number(), number()], dtype=np.float64)
            for index in range(1, samples_per_cubic + 1):
                t = index / samples_per_cubic
                inverse = 1.0 - t
                points.append(
                    inverse**3 * current
                    + 3.0 * inverse**2 * t * c1
                    + 3.0 * inverse * t**2 * c2
                    + t**3 * end
                )
            current = end
        elif command == "Z":
            if not np.allclose(points[-1], start):
                points.append(start.copy())
            command = ""
        else:
            raise AssertionError(f"unsupported signed SVG command {command!r}")
    outline = np.asarray(points, dtype=np.float64) * 0.1
    require(len(outline) >= 16 and np.all(np.isfinite(outline)), "signed SVG sampling failed")
    if not np.allclose(outline[0], outline[-1]):
        outline = np.vstack([outline, outline[0]])
    return outline


def sample_candidate_outline(profile: dict[str, object], samples_per_cubic: int = 192) -> np.ndarray:
    require(profile.get("status") == "PRODUCT_VISUAL_SIGNED_OFF_NOT_PROMOTED", "visual sign-off must remain distinct from registry promotion")
    segments = profile.get("rightHalfFromRootToTip")
    require(isinstance(segments, list) and len(segments) >= 3, "candidate profile segments missing")
    right: list[np.ndarray] = []
    previous_end: np.ndarray | None = None
    previous_tangent: np.ndarray | None = None
    for index, raw in enumerate(segments):
        require(isinstance(raw, dict), f"candidate segment {index} must be an object")
        points = {key: np.asarray(raw[key], dtype=np.float64) for key in ("start", "control1", "control2", "end")}
        require(all(value.shape == (2,) and np.all(np.isfinite(value)) for value in points.values()), f"candidate segment {index} invalid")
        if previous_end is not None:
            require(np.allclose(points["start"], previous_end, atol=1e-9), f"candidate segment {index} position discontinuity")
            outgoing = points["control1"] - points["start"]
            require(previous_tangent is not None and np.linalg.norm(outgoing) > 1e-9, f"candidate segment {index} zero tangent")
            cosine = float(np.dot(previous_tangent, outgoing) / (np.linalg.norm(previous_tangent) * np.linalg.norm(outgoing)))
            require(cosine >= math.cos(math.radians(0.25)), f"candidate segment {index} is not C1 continuous")
        if index == 0:
            right.append(points["start"])
        for sample in range(1, samples_per_cubic + 1):
            t = sample / samples_per_cubic
            inverse = 1.0 - t
            right.append(
                inverse**3 * points["start"]
                + 3.0 * inverse**2 * t * points["control1"]
                + 3.0 * inverse * t**2 * points["control2"]
                + t**3 * points["end"]
            )
        previous_end = points["end"]
        previous_tangent = points["end"] - points["control2"]
    right_array = np.asarray(right)
    left = right_array[-2::-1].copy()
    left[:, 0] *= -1
    outline = np.vstack([right_array, left])
    require(np.allclose(outline[0], outline[-1]), "candidate outline must close")
    return outline


def max_point_to_polyline_distance(points: np.ndarray, polyline: np.ndarray) -> float:
    starts = polyline[:-1]
    vectors = polyline[1:] - starts
    lengths_squared = np.einsum("ij,ij->i", vectors, vectors)
    require(np.all(lengths_squared > 1e-16), "planform polyline contains a zero-length segment")
    maximum = 0.0
    for point in points:
        ratios = np.clip(np.einsum("ij,ij->i", point - starts, vectors) / lengths_squared, 0.0, 1.0)
        projected = starts + ratios[:, None] * vectors
        maximum = max(maximum, float(np.linalg.norm(projected - point, axis=1).min()))
    return maximum


def outline_half_width(outline: np.ndarray, y: float) -> tuple[float, float]:
    xs: list[float] = []
    for start, end in zip(outline[:-1], outline[1:]):
        if abs(float(end[1] - start[1])) <= 1e-12:
            continue
        if not ((start[1] <= y < end[1]) or (end[1] <= y < start[1])):
            continue
        ratio = (y - float(start[1])) / float(end[1] - start[1])
        xs.append(float(start[0] + ratio * (end[0] - start[0])))
    require(len(xs) >= 2, f"candidate outline has no width at y={y:.4f}")
    return min(xs), max(xs)


def candidate_planform_measurements(outline: np.ndarray, profile: dict[str, object]) -> dict[str, float]:
    tip_y = float(outline[:, 1].min())
    root_y = float(outline[:, 1].max())
    span = root_y - tip_y
    ys = np.linspace(tip_y + 0.01, root_y - 0.01, 2400)
    widths: list[float] = []
    symmetry_error = 0.0
    for y in ys:
        left, right = outline_half_width(outline, float(y))
        widths.append(right - left)
        symmetry_error = max(symmetry_error, abs(right + left))
    max_index = int(np.argmax(widths))
    max_y = float(ys[max_index])
    max_from_root = (root_y - max_y) / span
    descending_widths: list[float] = []
    for y in np.linspace(max_y, tip_y + 0.08, 800):
        left, right = outline_half_width(outline, float(y))
        descending_widths.append(right - left)
    maximum_taper_increase = max(
        [next_width - width for width, next_width in zip(descending_widths, descending_widths[1:])] or [0.0]
    )
    segments = profile["rightHalfFromRootToTip"]
    root_shoulder = np.asarray(segments[0]["end"], dtype=np.float64)
    tip_control = np.asarray(segments[-1]["control2"], dtype=np.float64)
    return {
        "symmetryErrorMm": symmetry_error,
        "maxWidthYmm": max_y,
        "maxWidthPositionFromRootRatio": max_from_root,
        "maximumPostMaxTaperIncreaseMm": maximum_taper_increase,
        "rootArcRiseMm": root_y - float(root_shoulder[1]),
        "rootShoulderHalfWidthMm": float(root_shoulder[0]),
        "tipClosingControlRadiusMm": abs(float(tip_control[0])),
        "tipClosingTangentYErrorMm": abs(float(tip_control[1]) - tip_y),
    }


def independent_mesh_measurements(mesh: trimesh.Trimesh, outline: np.ndarray) -> dict[str, object]:
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    require(np.all(np.isfinite(vertices)), "GLB vertices must be finite")

    rows: dict[float, dict[float, list[float]]] = {}
    for x, y, z in vertices:
        y_key = round(float(y), 5)
        x_key = round(float(x), 5)
        rows.setdefault(y_key, {}).setdefault(x_key, []).append(float(z))
    require(len(rows) >= 100, "GLB has too few longitudinal sections")

    def section(y_key: float) -> dict[str, float]:
        cells = rows[y_key]
        paired = {x: sorted(values) for x, values in cells.items() if len(values) >= 2}
        require(len(paired) >= 1, f"section y={y_key} has no outer/inner vertex pairs")
        centre_x = min(paired, key=lambda x: abs(x))
        side_extent = max(abs(x) for x in paired)
        side_xs = [x for x in paired if abs(abs(x) - side_extent) <= 1e-4]
        centre_values = paired[centre_x]
        side_outer = float(np.mean([max(paired[x]) for x in side_xs]))
        side_inner = float(np.mean([min(paired[x]) for x in side_xs]))
        return {
            "centreOuter": max(centre_values),
            "centreInner": min(centre_values),
            "sideOuter": side_outer,
            "sideInner": side_inner,
            "centreThickness": max(centre_values) - min(centre_values),
            "sideThickness": float(np.mean([max(paired[x]) - min(paired[x]) for x in side_xs])),
        }

    y_values = sorted(rows)
    tip_y, root_y = y_values[0], y_values[-1]
    middle_y = min(y_values, key=lambda value: abs(value + 8.0))
    tip = section(tip_y)
    middle = section(middle_y)
    root = section(root_y)
    centreline_outer = [section(y)["centreOuter"] for y in y_values]
    centreline_inner = [section(y)["centreInner"] for y in y_values]

    sections: list[tuple[float, float, float]] = []
    for y, cells in rows.items():
        xs = list(cells)
        sections.append((y, min(xs), max(xs)))
    sections.sort(key=lambda item: item[0])
    right_side = [[right, y] for y, _left, right in sections]
    left_side = [[left, y] for y, left, _right in reversed(sections)]
    boundary_array = np.asarray(right_side + left_side[1:-1] + [right_side[0]], dtype=np.float64)
    hausdorff = max(
        max_point_to_polyline_distance(outline[:-1], boundary_array),
        max_point_to_polyline_distance(boundary_array[:-1], outline),
    )

    triangles = np.asarray(mesh.triangles, dtype=np.float64)
    edges = np.stack(
        [
            np.linalg.norm(triangles[:, 1] - triangles[:, 0], axis=1),
            np.linalg.norm(triangles[:, 2] - triangles[:, 1], axis=1),
            np.linalg.norm(triangles[:, 0] - triangles[:, 2], axis=1),
        ],
        axis=1,
    )
    areas = trimesh.triangles.area(triangles)
    require(np.all(areas > 1e-10), "quality measurement found a degenerate triangle")
    longest = edges.max(axis=1)
    minimum_altitude = 2.0 * areas / longest
    aspect = longest / minimum_altitude
    angles: list[np.ndarray] = []
    for opposite, adjacent_a, adjacent_b in ((edges[:, 0], edges[:, 1], edges[:, 2]), (edges[:, 1], edges[:, 2], edges[:, 0]), (edges[:, 2], edges[:, 0], edges[:, 1])):
        cosine = np.clip((adjacent_a**2 + adjacent_b**2 - opposite**2) / (2.0 * adjacent_a * adjacent_b), -1.0, 1.0)
        angles.append(np.degrees(np.arccos(cosine)))
    min_angle = float(np.min(np.stack(angles, axis=1)))

    return {
        "middleSectionYmm": middle_y,
        "transverseOuterCrownMm": middle["centreOuter"] - middle["sideOuter"],
        "undersideCavityDepthMm": middle["centreInner"] - middle["sideInner"],
        "longitudinalOuterRiseMm": max(centreline_outer) - max(centreline_outer[0], centreline_outer[-1]),
        "longitudinalInnerRiseMm": max(centreline_inner) - max(centreline_inner[0], centreline_inner[-1]),
        "thicknessMm": {
            "tipCentre": tip["centreThickness"],
            "midbodyCentre": middle["centreThickness"],
            "midbodySide": middle["sideThickness"],
            "cuticleCentre": root["centreThickness"],
        },
        "planformHausdorffMm": hausdorff,
        "minTriangleAngleDeg": min_angle,
        "maxTriangleAspectRatio": float(np.max(aspect)),
    }


def canonical_triangle_hash(mesh: trimesh.Trimesh) -> str:
    scale = 1.0 / QUANTIZATION_MM
    triangles: list[tuple[tuple[int, int, int], ...]] = []
    for triangle in mesh.triangles:
        quantized = [tuple(int(round(float(value) * scale)) for value in vertex) for vertex in triangle]
        triangles.append(tuple(sorted(quantized)))
    payload = json.dumps(sorted(triangles), separators=(",", ":")).encode("utf-8")
    return sha256(payload)


def load_glb(value: bytes) -> tuple[trimesh.Scene, trimesh.Trimesh]:
    scene = trimesh.load(io.BytesIO(value), file_type="glb", force="scene", process=False)
    require(isinstance(scene, trimesh.Scene), "GLB must parse as one scene")
    nodes = list(scene.graph.nodes_geometry)
    require(len(nodes) == 1, f"GLB must contain one geometry node, found {len(nodes)}")
    transform, geometry_name = scene.graph[nodes[0]]
    require(np.allclose(transform, np.eye(4), atol=1e-8), "GLB node transform must be identity")
    require(len(scene.geometry) == 1, f"GLB must contain one mesh, found {len(scene.geometry)}")
    mesh = scene.geometry[geometry_name].copy()
    mesh.apply_transform(transform)
    return scene, mesh


def glb_document(value: bytes) -> dict[str, object]:
    magic, version, total_length = struct.unpack_from("<4sII", value, 0)
    require(magic == b"glTF" and version == 2 and total_length == len(value), "invalid GLB header")
    chunk_length, chunk_type = struct.unpack_from("<II", value, 12)
    require(chunk_type == 0x4E4F534A, "first GLB chunk must be JSON")
    return json.loads(value[20:20 + chunk_length].rstrip(b" \x00").decode("utf-8"))


def topology(mesh: trimesh.Trimesh) -> dict[str, int]:
    edges: dict[tuple[int, int], list[tuple[int, int, int]]] = {}
    for face_index, face in enumerate(mesh.faces):
        for start, end in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            key = (int(min(start, end)), int(max(start, end)))
            edges.setdefault(key, []).append((int(start), int(end), face_index))
    boundary = sum(len(incidents) == 1 for incidents in edges.values())
    non_manifold = sum(len(incidents) > 2 for incidents in edges.values())
    winding_errors = sum(
        len(incidents) == 2 and incidents[0][:2] == incidents[1][:2]
        for incidents in edges.values()
    )
    adjacency: list[set[int]] = [set() for _ in mesh.faces]
    for incidents in edges.values():
        if len(incidents) != 2:
            continue
        first, second = incidents[0][2], incidents[1][2]
        adjacency[first].add(second)
        adjacency[second].add(first)
    visited: set[int] = set()
    components = 0
    for start in range(len(adjacency)):
        if start in visited:
            continue
        components += 1
        stack = [start]
        visited.add(start)
        while stack:
            for neighbour in adjacency[stack.pop()]:
                if neighbour not in visited:
                    visited.add(neighbour)
                    stack.append(neighbour)
    triangle_areas = trimesh.triangles.area(mesh.triangles)
    face_keys = {
        tuple(sorted(int(index) for index in face))
        for face in mesh.faces
    }
    return {
        "boundaryEdges": int(boundary),
        "nonManifoldEdges": int(non_manifold),
        "inconsistentWindingEdges": int(winding_errors),
        "connectedComponents": components,
        "degenerateTriangles": int(np.count_nonzero(triangle_areas <= 1e-10)),
        "duplicateTriangles": int(len(mesh.faces) - len(face_keys)),
    }


def check_mesh(label: str, mesh: trimesh.Trimesh, expected_triangles: int) -> None:
    welded = mesh.copy()
    welded.merge_vertices(digits_vertex=5, merge_tex=True, merge_norm=True)
    observed = topology(welded)
    require(len(welded.faces) == expected_triangles, f"{label} triangle count drift")
    require(observed["boundaryEdges"] == 0, f"{label} has boundary edges")
    require(observed["nonManifoldEdges"] == 0, f"{label} has non-manifold edges")
    require(observed["inconsistentWindingEdges"] == 0, f"{label} has winding errors")
    require(observed["connectedComponents"] == 1, f"{label} is not one connected component")
    require(observed["degenerateTriangles"] == 0, f"{label} has degenerate triangles")
    require(observed["duplicateTriangles"] == 0, f"{label} has duplicate triangles")
    require(welded.is_watertight, f"{label} is not watertight")
    require(welded.is_winding_consistent, f"{label} winding is inconsistent")
    require(welded.euler_number == 2, f"{label} Euler characteristic must be 2")
    require(np.isfinite(welded.volume) and welded.volume > 0, f"{label} volume must be finite and positive")


def endpoint_face_incidence(mesh: trimesh.Trimesh) -> dict[str, int]:
    vertices = np.asarray(mesh.vertices)
    faces = np.asarray(mesh.faces)
    counts = np.bincount(faces.reshape(-1), minlength=len(vertices))
    tip_y = float(vertices[:, 1].min())
    root_y = float(vertices[:, 1].max())
    tip_indices = np.flatnonzero(np.abs(vertices[:, 1] - tip_y) <= 1e-5)
    root_indices = np.flatnonzero(np.abs(vertices[:, 1] - root_y) <= 1e-5)
    require(len(tip_indices) >= 2 and len(root_indices) >= 2, "outer/inner endpoint vertices missing")
    return {
        "tipMaxFaceIncidence": int(counts[tip_indices].max()),
        "rootMaxFaceIncidence": int(counts[root_indices].max()),
        "globalMaxFaceIncidence": int(counts.max()),
    }


def main() -> None:
    report = json.loads((ROOT / REPORT_RELATIVE).read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / MANIFEST_RELATIVE).read_text(encoding="utf-8"))
    stl_bytes = (ROOT / STL_RELATIVE).read_bytes()
    glb_bytes = (ROOT / GLB_RELATIVE).read_bytes()

    require(report["classification"] == "SIMULATED_ALMOND_SHELL_CANDIDATE", "candidate classification drift")
    require(report["assumptions"]["manufacturingValidated"] is False, "candidate cannot be manufacturing validated")
    require(report["source"]["signed2dSilhouette"]["evidence"] == "SIGNED_OFF_2D_SILHOUETTE", "2D evidence label drift")
    require(report["source"]["productVisualCandidate"]["evidence"] == "PRODUCT_VISUAL_SIGNED_OFF_NOT_PROMOTED", "visual sign-off must stay distinct from registry promotion")
    require(report["assumptions"]["evidence"] == "SIMULATED_3D_SOLID", "3D evidence label drift")
    require("非制造就绪" in report["truthLabel"], "visible truth label must reject manufacturing readiness")
    require(manifest["status"] == "SIMULATED_CANDIDATE_NOT_PROMOTED", "candidate must not be promoted")
    require(
        REQUIREMENTS.read_text(encoding="utf-8") == "numpy==2.0.2\ntrimesh==4.12.2\n",
        "almond shell dependency lock drift",
    )
    toolchain = report["source"]["toolchain"]
    require(toolchain["pythonImplementation"] == platform.python_implementation(), "Python implementation drift")
    require(toolchain["pythonVersion"] == platform.python_version(), "Python version drift")
    require(toolchain["numpyVersion"] == np.__version__, "NumPy version drift")
    require(toolchain["trimeshVersion"] == trimesh.__version__, "Trimesh version drift")
    require(toolchain["requirementsSha256"] == sha256(REQUIREMENTS.read_bytes()), "requirements SHA drift")

    source_entries = report["source"]
    require(source_entries["shapeParams"]["sha256"] == sha256(PARAMS.read_bytes()), "shape params SHA drift")
    require(source_entries["signed2dSilhouette"]["sha256"] == sha256(SILHOUETTE.read_bytes()), "silhouette SHA drift")
    require(source_entries["productVisualCandidate"]["sha256"] == sha256(CANDIDATE_PROFILE.read_bytes()), "candidate profile SHA drift")
    require(source_entries["generator"]["sha256"] == sha256(GENERATOR.read_bytes()), "generator SHA drift")
    require(report["artifacts"]["stl"]["sha256"] == sha256(stl_bytes), "STL SHA drift")
    require(report["artifacts"]["glb"]["sha256"] == sha256(glb_bytes), "GLB SHA drift")
    require(report["artifacts"]["stl"]["bytes"] == len(stl_bytes), "STL byte length drift")
    require(report["artifacts"]["glb"]["bytes"] == len(glb_bytes), "GLB byte length drift")
    require(manifest["artifacts"] == report["artifacts"], "manifest/report artifact split brain")

    stl_mesh = trimesh.load(io.BytesIO(stl_bytes), file_type="stl", force="mesh", process=False)
    _, glb_mesh = load_glb(glb_bytes)
    glb_json = glb_document(glb_bytes)
    expected_triangles = report["mesh"]["triangles"]
    check_mesh("STL", stl_mesh, expected_triangles)
    check_mesh("GLB", glb_mesh, expected_triangles)
    require(getattr(glb_mesh.visual, "uv", None) is not None, "GLB must contain TEXCOORD_0")
    require(len(glb_mesh.visual.uv) == len(glb_mesh.vertices), "GLB UV cardinality drift")
    require(len(glb_json.get("meshes", [])) == 1, "GLB JSON must contain one mesh")
    primitives = glb_json["meshes"][0].get("primitives", [])
    require(len(primitives) == 1, "GLB mesh must contain one primitive")
    attributes = primitives[0].get("attributes", {})
    require("POSITION" in attributes and "NORMAL" in attributes and "TEXCOORD_0" in attributes, "GLB primitive must contain POSITION/NORMAL/TEXCOORD_0")
    require("indices" in primitives[0], "GLB primitive must be indexed")

    expected_hash = report["mesh"]["canonicalTriangleSha256"]
    require(canonical_triangle_hash(stl_mesh) == expected_hash, "STL canonical triangle hash drift")
    require(canonical_triangle_hash(glb_mesh) == expected_hash, "GLB canonical triangle hash drift")
    require(np.allclose(stl_mesh.bounds, glb_mesh.bounds, atol=0.01), "STL/GLB bounds differ beyond 0.01mm")

    bounds = np.asarray(glb_mesh.bounds)
    extents = bounds[1] - bounds[0]
    profile = json.loads(CANDIDATE_PROFILE.read_text(encoding="utf-8"))
    outline = sample_candidate_outline(profile)
    signed_outline = sample_signed_outline(SILHOUETTE.read_text(encoding="utf-8"))
    observed = independent_mesh_measurements(glb_mesh, outline)
    visual = candidate_planform_measurements(outline, profile)
    endpoint_incidence = endpoint_face_incidence(glb_mesh)
    metrics = report["shapeMetrics"]
    require(abs(extents[0] - 11.0) <= 0.05, "maximum width must be 11mm ±0.05")
    require(abs(bounds[0, 1] + 18.0) <= 0.05, "tip must be y=-18mm ±0.05")
    require(abs(bounds[1, 1] - 1.1) <= 0.05, "cuticle seat must be y=+1.1mm ±0.05")
    require(2.8 <= extents[2] <= 3.2, f"Z span must reject a flat slab, observed {extents[2]:.4f}mm")
    require(observed["transverseOuterCrownMm"] >= 1.5, "independently measured transverse C-curve is too flat")
    require(observed["longitudinalOuterRiseMm"] >= 0.8, "independently measured longitudinal arch is too flat")
    require(observed["undersideCavityDepthMm"] >= 1.0, "independently measured underside cavity is too shallow")
    require(observed["planformHausdorffMm"] <= 0.1, "independently measured 3D planform drifts from candidate profile beyond 0.1mm")
    require(visual["symmetryErrorMm"] <= 1e-6, "candidate planform lost bilateral symmetry")
    require(0.20 <= visual["maxWidthPositionFromRootRatio"] <= 0.30, "maximum width must sit 20-30% down from the root")
    require(visual["maximumPostMaxTaperIncreaseMm"] <= 0.002, "candidate widens again after maximum width")
    require(1.0 <= visual["rootArcRiseMm"] <= 1.3, "root edge is not a shallow organic arc")
    require(4.3 <= visual["rootShoulderHalfWidthMm"] <= 4.6, "root shoulder width drift")
    require(visual["tipClosingControlRadiusMm"] >= 0.9, "rounded tip control radius collapsed")
    require(visual["tipClosingTangentYErrorMm"] <= 1e-9, "tip closing tangent is not horizontal")
    require(endpoint_incidence["tipMaxFaceIncidence"] <= 8, "tip reverted to a high-valence triangle fan")
    require(endpoint_incidence["rootMaxFaceIncidence"] <= 8, "root reverted to a high-valence triangle fan")
    require(observed["minTriangleAngleDeg"] >= 1.5, f"triangle fan is too acute: {observed['minTriangleAngleDeg']:.4f}°")
    require(observed["maxTriangleAspectRatio"] <= 50.0, f"triangle aspect ratio is too high: {observed['maxTriangleAspectRatio']:.4f}")
    require(abs(observed["minTriangleAngleDeg"] - report["mesh"]["minTriangleAngleDeg"]) <= 1e-5, "generator report drift for minimum triangle angle")
    require(abs(observed["maxTriangleAspectRatio"] - report["mesh"]["maxTriangleAspectRatio"]) <= 1e-4, "generator report drift for maximum triangle aspect")
    for key in ("transverseOuterCrownMm", "longitudinalOuterRiseMm", "longitudinalInnerRiseMm", "undersideCavityDepthMm"):
        require(abs(observed[key] - metrics[key]) <= 0.01, f"generator report drift for {key}")
    require(abs(observed["planformHausdorffMm"] - report["mesh"]["planformHausdorffMm"]) <= 0.005, "generator report drift for planform Hausdorff")
    signed_reference_distance = max(
        max_point_to_polyline_distance(signed_outline[:-1], outline),
        max_point_to_polyline_distance(outline[:-1], signed_outline),
    )
    require(abs(signed_reference_distance - report["source"]["productVisualCandidate"]["referenceHausdorffMm"]) <= 0.005, "signed reference distance drift")
    require("selfIntersectionRationale" in report["mesh"], "constructive self-intersection rationale missing")
    require("selfIntersectionEvidence" not in report["mesh"], "constructive rationale must not be called executed evidence")
    thickness = observed["thicknessMm"]
    require(0.50 <= thickness["tipCentre"] <= 0.70, "tip preview thickness drift")
    require(0.35 <= thickness["cuticleCentre"] <= 0.55, "cuticle preview thickness drift")
    require(0.65 <= thickness["midbodyCentre"] <= 0.85, "midbody centre preview thickness drift")
    require(0.45 <= thickness["midbodySide"] <= 0.65, "midbody side preview thickness drift")
    require(expected_triangles < 20_000, "candidate exceeds 20k triangle budget")
    require(len(glb_bytes) < 2_000_000, "candidate GLB exceeds 2MB")

    vite_source = (ROOT / "vite.config.ts").read_text(encoding="utf-8")
    require("normalized.endsWith('.stl')" in vite_source, "Vite must keep STL out of runtime serving/build output")

    with tempfile.TemporaryDirectory(prefix="nextgen-almond-shell-") as directory:
        temp_root = Path(directory)
        result = subprocess.run(
            [sys.executable, str(GENERATOR), "--output-root", str(temp_root)],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        require(result.returncode == 0, f"deterministic regeneration failed: {result.stderr}")
        for relative in (STL_RELATIVE, GLB_RELATIVE, MANIFEST_RELATIVE, REPORT_RELATIVE):
            require((temp_root / relative).read_bytes() == (ROOT / relative).read_bytes(), f"non-deterministic output: {relative}")

    print("PASS spike almond shell candidate")
    print(json.dumps({
        "triangles": expected_triangles,
        "boundsMm": report["mesh"]["boundsMm"],
        "canonicalTriangleSha256": expected_hash,
        "planformHausdorffMm": report["mesh"]["planformHausdorffMm"],
        "transverseOuterCrownMm": observed["transverseOuterCrownMm"],
        "longitudinalOuterRiseMm": observed["longitudinalOuterRiseMm"],
        "undersideCavityDepthMm": observed["undersideCavityDepthMm"],
        "minTriangleAngleDeg": observed["minTriangleAngleDeg"],
        "maxTriangleAspectRatio": observed["maxTriangleAspectRatio"],
        "visualPlanform": visual,
        "endpointFaceIncidence": endpoint_incidence,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
