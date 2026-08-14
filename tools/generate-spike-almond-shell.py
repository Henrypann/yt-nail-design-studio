#!/usr/bin/env python3
"""Generate one deterministic, simulated almond nail shell for 3D spike review.

The globally signed 2D silhouette remains an immutable reference.  This v3
candidate uses a separate, product-review profile to soften the cuticle arc,
shoulders and upper taper without silently promoting that aesthetic decision.
The 3D curvature and thickness remain explicit simulated assumptions for
browser geometry evaluation; they are not scan, fit, material, print, or
manufacturing evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import platform
import re
from typing import Iterable

import numpy as np
import trimesh


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PARAMS_PATH = PROJECT_ROOT / "material-library/shapes/shape-params.json"
SILHOUETTE_PATH = PROJECT_ROOT / "material-library/shapes/silhouettes/almond_medium.svg"
CANDIDATE_PROFILE_PATH = PROJECT_ROOT / "assets/shape-calibration/candidates/almond-medium-elegant-v1.json"
REQUIREMENTS_PATH = PROJECT_ROOT / "tools/requirements-spike-almond-shell.txt"

ASSET_ID = "spike-almond-medium-shell-candidate-v3"
REVISION = "3.0.0-simulated-candidate"
GENERATOR_CONTRACT = "spike-almond-shell-generator-v3"
GENERATED_AT = "2026-08-14T00:00:00+08:00"
LONGITUDINAL_ROWS = 180
CROSS_SEGMENTS = 26
SVG_SAMPLES_PER_CUBIC = 192
QUANTIZATION_MM = 1e-5
EXPECTED_PYTHON = "3.9.6"
EXPECTED_NUMPY = "2.0.2"
EXPECTED_TRIMESH = "4.12.2"

STL_RELATIVE = Path("assets/stl/spike/almond-medium-shell-v3.simulated.stl")
GLB_DIRECTORY_RELATIVE = Path("assets/glb/shells/almond/medium-candidate-v3")
GLB_RELATIVE = GLB_DIRECTORY_RELATIVE / "shell.web.glb"
MANIFEST_RELATIVE = GLB_DIRECTORY_RELATIVE / "shell.manifest.json"
REPORT_RELATIVE = GLB_DIRECTORY_RELATIVE / "geometry-report.json"
EVIDENCE_REPORT_RELATIVE = Path("evidence/spike-3d-almond-base/attempt-02/asset-report.json")

NUMBER_TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
PATH_DATA = re.compile(r"<path\b[^>]*\bd=(['\"])(.*?)\1[^>]*>", re.IGNORECASE | re.DOTALL)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def toolchain_metadata() -> dict[str, str]:
    observed = {
        "pythonImplementation": platform.python_implementation(),
        "pythonVersion": platform.python_version(),
        "numpyVersion": np.__version__,
        "trimeshVersion": trimesh.__version__,
        "requirementsPath": str(REQUIREMENTS_PATH.relative_to(PROJECT_ROOT)),
        "requirementsSha256": sha256_file(REQUIREMENTS_PATH),
    }
    expected = {
        "pythonImplementation": "CPython",
        "pythonVersion": EXPECTED_PYTHON,
        "numpyVersion": EXPECTED_NUMPY,
        "trimeshVersion": EXPECTED_TRIMESH,
    }
    for key, value in expected.items():
        if observed[key] != value:
            raise RuntimeError(f"almond shell toolchain drift for {key}: expected {value}, observed {observed[key]}")
    return observed


def cubic_point(
    start: np.ndarray,
    control_1: np.ndarray,
    control_2: np.ndarray,
    end: np.ndarray,
    t: float,
) -> np.ndarray:
    inverse = 1.0 - t
    return (
        inverse**3 * start
        + 3.0 * inverse**2 * t * control_1
        + 3.0 * inverse * t**2 * control_2
        + t**3 * end
    )


def sample_svg_outline(svg: str) -> np.ndarray:
    matches = [match.group(2).strip() for match in PATH_DATA.finditer(svg)]
    unique = list(dict.fromkeys(matches))
    if len(unique) != 1:
        raise ValueError(f"expected one unique signed outline, found {len(unique)}")

    tokens = NUMBER_TOKEN.findall(unique[0])
    cursor = 0
    command = ""
    current = np.zeros(2, dtype=np.float64)
    start = np.zeros(2, dtype=np.float64)
    points: list[np.ndarray] = []

    def next_number() -> float:
        nonlocal cursor
        if cursor >= len(tokens) or re.fullmatch(r"[A-Za-z]", tokens[cursor]):
            raise ValueError(f"missing SVG path number at token {cursor}")
        value = float(tokens[cursor])
        cursor += 1
        if not math.isfinite(value):
            raise ValueError(f"non-finite SVG path number at token {cursor - 1}")
        return value

    while cursor < len(tokens):
        if re.fullmatch(r"[A-Za-z]", tokens[cursor]):
            command = tokens[cursor].upper()
            cursor += 1
        if command == "M":
            current = np.array([next_number(), next_number()], dtype=np.float64)
            start = current.copy()
            points.append(current.copy())
            command = "L"
        elif command == "L":
            current = np.array([next_number(), next_number()], dtype=np.float64)
            points.append(current.copy())
        elif command == "C":
            control_1 = np.array([next_number(), next_number()], dtype=np.float64)
            control_2 = np.array([next_number(), next_number()], dtype=np.float64)
            end = np.array([next_number(), next_number()], dtype=np.float64)
            for index in range(1, SVG_SAMPLES_PER_CUBIC + 1):
                points.append(cubic_point(current, control_1, control_2, end, index / SVG_SAMPLES_PER_CUBIC))
            current = end
        elif command == "Z":
            if not np.allclose(points[-1], start):
                points.append(start.copy())
            command = ""
        else:
            raise ValueError(f"unsupported SVG path command {command!r}")

    outline = np.asarray(points, dtype=np.float64) * 0.1
    if outline.shape[0] < 16 or not np.all(np.isfinite(outline)):
        raise ValueError("signed outline did not produce a finite closed polyline")
    if not np.allclose(outline[0], outline[-1]):
        outline = np.vstack([outline, outline[0]])
    return outline


def sample_candidate_outline(profile: dict[str, object]) -> np.ndarray:
    """Materialize the review-only symmetric Bézier planform in millimetres."""
    if profile.get("schemaVersion") != 1 or profile.get("status") != "PRODUCT_VISUAL_SIGNED_OFF_NOT_PROMOTED":
        raise ValueError("almond visual candidate contract is invalid")
    segments = profile.get("rightHalfFromRootToTip")
    if not isinstance(segments, list) or len(segments) < 3:
        raise ValueError("almond visual candidate needs at least three right-half segments")

    right: list[np.ndarray] = []
    previous_end: np.ndarray | None = None
    previous_tangent: np.ndarray | None = None
    for segment_index, raw in enumerate(segments):
        if not isinstance(raw, dict):
            raise ValueError(f"candidate segment {segment_index} is not an object")
        values: dict[str, np.ndarray] = {}
        for key in ("start", "control1", "control2", "end"):
            value = np.asarray(raw.get(key), dtype=np.float64)
            if value.shape != (2,) or not np.all(np.isfinite(value)):
                raise ValueError(f"candidate segment {segment_index}.{key} must be a finite XY tuple")
            values[key] = value
        if previous_end is not None:
            if not np.allclose(values["start"], previous_end, atol=1e-9):
                raise ValueError(f"candidate segment {segment_index} is position-discontinuous")
            incoming = previous_tangent
            outgoing = values["control1"] - values["start"]
            if incoming is None or np.linalg.norm(incoming) <= 1e-9 or np.linalg.norm(outgoing) <= 1e-9:
                raise ValueError(f"candidate segment {segment_index} has a zero join tangent")
            cosine = float(np.dot(incoming, outgoing) / (np.linalg.norm(incoming) * np.linalg.norm(outgoing)))
            if cosine < math.cos(math.radians(0.25)):
                raise ValueError(f"candidate segment {segment_index} is not C1 tangent-continuous")
        if segment_index == 0:
            right.append(values["start"].copy())
        for sample_index in range(1, SVG_SAMPLES_PER_CUBIC + 1):
            right.append(cubic_point(values["start"], values["control1"], values["control2"], values["end"], sample_index / SVG_SAMPLES_PER_CUBIC))
        previous_end = values["end"]
        previous_tangent = values["end"] - values["control2"]

    right_array = np.asarray(right, dtype=np.float64)
    if not np.allclose(right_array[0], [0.0, 1.1], atol=1e-6) or not np.allclose(right_array[-1], [0.0, -18.0], atol=1e-6):
        raise ValueError("candidate half must run from root centre to rounded tip centre")
    if np.any(right_array[:, 0] < -1e-9):
        raise ValueError("candidate right half crossed the symmetry axis")

    left_tip_to_root = right_array[-2::-1].copy()
    left_tip_to_root[:, 0] *= -1.0
    outline = np.vstack([right_array, left_tip_to_root])
    if not np.all(np.isfinite(outline)) or not np.allclose(outline[0], outline[-1]):
        raise ValueError("candidate outline did not close")
    return outline


def horizontal_intersections(outline: np.ndarray, y: float) -> list[float]:
    values: list[float] = []
    for start, end in zip(outline[:-1], outline[1:]):
        y_1, y_2 = float(start[1]), float(end[1])
        if abs(y_2 - y_1) <= 1e-12:
            continue
        if not ((y_1 <= y < y_2) or (y_2 <= y < y_1)):
            continue
        ratio = (y - y_1) / (y_2 - y_1)
        values.append(float(start[0] + ratio * (end[0] - start[0])))
    return sorted(values)


def half_width_at_y(outline: np.ndarray, y: float) -> float:
    intersections = horizontal_intersections(outline, y)
    if len(intersections) < 2:
        raise ValueError(f"outline has fewer than two intersections at y={y:.6f}")
    left, right = intersections[0], intersections[-1]
    half_width = (abs(left) + abs(right)) * 0.5
    if not math.isfinite(half_width) or half_width <= 0:
        raise ValueError(f"invalid outline half-width at y={y:.6f}")
    return half_width


def endpoint_smooth_envelope(t: float) -> float:
    """A unit arch with finite, zero slope at both longitudinal endpoints."""
    return 16.0 * t * t * (1.0 - t) * (1.0 - t)


def longitudinal_side_height(t: float) -> float:
    return 0.38 + 0.82 * endpoint_smooth_envelope(t) ** 0.90 + 0.18 * t


def transverse_crown_height(t: float) -> float:
    return 1.65 * endpoint_smooth_envelope(t) ** 0.72


def centre_thickness(t: float) -> float:
    linear = 0.60 * (1.0 - t) + 0.45 * t
    apex = 0.23 * math.exp(-((t - 0.55) / 0.24) ** 2)
    return linear + apex


def shell_heights(t: float, u: float) -> tuple[float, float, float]:
    profile = max(0.0, 1.0 - u * u)
    outer = longitudinal_side_height(t) + transverse_crown_height(t) * profile
    thickness = centre_thickness(t) * (0.78 + 0.22 * profile)
    inner = outer - thickness
    return outer, inner, thickness


def longitudinal_row_parameters(outline: np.ndarray, count: int) -> list[float]:
    """Leave bounded tip/root regions for local cap strips, never row fans."""
    tip_y = float(outline[:, 1].min())
    root_y = float(outline[:, 1].max())
    span_y = root_y - tip_y
    cap_y = 0.34
    parameters = np.linspace(cap_y / span_y, 1.0 - cap_y / span_y, count).tolist()
    if not all(0.0 < value < 1.0 for value in parameters) or not all(
        left < right for left, right in zip(parameters, parameters[1:])
    ):
        raise ValueError("signed outline side did not yield strictly increasing longitudinal rows")
    return parameters


def resample_open_polyline(points: np.ndarray, count: int) -> np.ndarray:
    if len(points) < 3 or count < 3:
        raise ValueError("cap polyline needs at least three source and output points")
    deltas = np.linalg.norm(np.diff(points, axis=0), axis=1)
    if np.any(deltas <= 1e-10):
        keep = np.concatenate([[True], deltas > 1e-10])
        points = points[keep]
        deltas = np.linalg.norm(np.diff(points, axis=0), axis=1)
    distances = np.concatenate([[0.0], np.cumsum(deltas)])
    targets = np.linspace(0.0, float(distances[-1]), count)
    result: list[np.ndarray] = []
    for target in targets:
        segment = min(int(np.searchsorted(distances, target, side="right") - 1), len(points) - 2)
        segment = max(0, segment)
        span = distances[segment + 1] - distances[segment]
        ratio = 0.0 if span <= 1e-12 else (target - distances[segment]) / span
        result.append(points[segment] * (1.0 - ratio) + points[segment + 1] * ratio)
    return np.asarray(result, dtype=np.float64)


def boundary_cap_points(outline: np.ndarray, end: str, count: int = 9) -> np.ndarray:
    tip_y = float(outline[:, 1].min())
    root_y = float(outline[:, 1].max())
    if end == "tip":
        selected = outline[:-1][outline[:-1, 1] <= tip_y + 0.24]
    elif end == "root":
        selected = outline[:-1][outline[:-1, 1] >= root_y - 0.24]
    else:
        raise ValueError(f"unknown boundary cap {end!r}")
    selected = selected[np.argsort(selected[:, 0])]
    if len(selected) < count:
        raise ValueError(f"candidate {end} cap has too few outline samples")
    return resample_open_polyline(selected, count)


def cross_segments_for_t(t: float) -> int:
    endpoint_factor = min(1.0, math.sin(math.pi * t) / 0.70)
    segments = int(round((8.0 + (CROSS_SEGMENTS - 8.0) * endpoint_factor) / 2.0)) * 2
    return max(8, min(CROSS_SEGMENTS, segments))


def triangulate_strip(upper: list[int], lower: list[int]) -> list[list[int]]:
    """Triangulate two ordered cross sections with potentially different counts."""
    upper_segments = len(upper) - 1
    lower_segments = len(lower) - 1
    upper_index = 0
    lower_index = 0
    triangles: list[list[int]] = []
    while upper_index < upper_segments or lower_index < lower_segments:
        next_upper = (upper_index + 1) / upper_segments if upper_index < upper_segments else math.inf
        next_lower = (lower_index + 1) / lower_segments if lower_index < lower_segments else math.inf
        if abs(next_upper - next_lower) <= 1e-12:
            triangles.append([upper[upper_index], upper[upper_index + 1], lower[lower_index + 1]])
            triangles.append([upper[upper_index], lower[lower_index + 1], lower[lower_index]])
            upper_index += 1
            lower_index += 1
        elif next_upper < next_lower:
            triangles.append([upper[upper_index], upper[upper_index + 1], lower[lower_index]])
            upper_index += 1
        else:
            triangles.append([upper[upper_index], lower[lower_index + 1], lower[lower_index]])
            lower_index += 1
    return triangles


def create_shell_mesh(outline: np.ndarray) -> tuple[trimesh.Trimesh, np.ndarray, dict[str, object]]:
    tip_y = float(outline[:, 1].min())
    root_y = float(outline[:, 1].max())
    span_y = root_y - tip_y
    if abs(tip_y + 18.0) > 0.05 or abs(root_y - 1.1) > 0.05:
        raise ValueError(f"unexpected signed outline extent y=[{tip_y}, {root_y}]")

    rows: list[dict[str, object]] = []
    for t in longitudinal_row_parameters(outline, LONGITUDINAL_ROWS):
        y = tip_y + span_y * t
        half_width = half_width_at_y(outline, y)
        rows.append({"t": t, "y": y, "halfWidth": half_width})

    outer_vertices: list[list[float]] = []
    inner_vertices: list[list[float]] = []
    outer_uv: list[list[float]] = []
    inner_uv: list[list[float]] = []
    outer_sections: list[list[int]] = []
    inner_sections_local: list[list[int]] = []

    def append_section(points: np.ndarray) -> None:
        outer_section: list[int] = []
        inner_section: list[int] = []
        for x, y in points:
            t = min(1.0, max(0.0, (float(y) - tip_y) / span_y))
            if abs(float(x)) <= 1e-10 and (t <= 1e-10 or t >= 1.0 - 1e-10):
                u = 0.0
            else:
                u = float(x) / half_width_at_y(outline, min(root_y - 1e-7, max(tip_y + 1e-7, float(y))))
            u = min(1.0, max(-1.0, u))
            outer_z, inner_z, _ = shell_heights(t, u)
            outer_section.append(len(outer_vertices))
            inner_section.append(len(inner_vertices))
            outer_vertices.append([float(x), float(y), outer_z])
            inner_vertices.append([float(x), float(y), inner_z])
            outer_uv.append([(u + 1.0) * 0.5, t])
            inner_uv.append([(u + 1.0) * 0.5, t])
        outer_sections.append(outer_section)
        inner_sections_local.append(inner_section)

    def cross_section_at_y(y: float, segments: int) -> np.ndarray:
        if segments == 0:
            return np.asarray([[0.0, y]], dtype=np.float64)
        half_width = half_width_at_y(outline, y)
        return np.asarray(
            [[half_width * (-1.0 + 2.0 * index / segments), y] for index in range(segments + 1)],
            dtype=np.float64,
        )

    # A bounded local cap ladder prevents an entire transverse row from fanning
    # into one endpoint.  Only two faces meet the extremum on each surface;
    # subsequent 3/5/9-vertex sections distribute curvature progressively.
    append_section(cross_section_at_y(tip_y, 0))
    append_section(cross_section_at_y(tip_y + 0.05, 2))
    append_section(cross_section_at_y(tip_y + 0.17, 4))
    for row in rows:
        t = float(row["t"])
        y = float(row["y"])
        half_width = float(row["halfWidth"])
        segments = cross_segments_for_t(t)
        points = np.asarray(
            [[half_width * (-1.0 + 2.0 * index / segments), y] for index in range(segments + 1)],
            dtype=np.float64,
        )
        append_section(points)
    append_section(cross_section_at_y(root_y - 0.17, 4))
    append_section(cross_section_at_y(root_y - 0.05, 2))
    append_section(cross_section_at_y(root_y, 0))

    vertices = np.asarray(outer_vertices + inner_vertices, dtype=np.float64)
    uv = np.asarray(outer_uv + inner_uv, dtype=np.float64)
    inner_offset = len(outer_vertices)
    inner_sections = [[inner_offset + index for index in section] for section in inner_sections_local]

    faces: list[list[int]] = []
    def connect_sections(lower: list[int], upper: list[int]) -> list[list[int]]:
        if len(lower) == 1:
            return [[lower[0], upper[index + 1], upper[index]] for index in range(len(upper) - 1)]
        if len(upper) == 1:
            return [[lower[index], lower[index + 1], upper[0]] for index in range(len(lower) - 1)]
        return triangulate_strip(lower, upper)

    for lower, upper in zip(outer_sections[:-1], outer_sections[1:]):
        faces.extend(connect_sections(lower, upper))

    # Concave inner surface, reverse winding toward the cavity.
    outer_surface_faces = list(faces)
    for face in outer_surface_faces:
        faces.append([inner_offset + face[2], inner_offset + face[1], inner_offset + face[0]])

    # Join outer and inner surfaces around the complete review-profile rim.
    outer_boundary = (
        list(outer_sections[0])
        + [section[-1] for section in outer_sections[1:-1]]
        + list(reversed(outer_sections[-1]))
        + [section[0] for section in reversed(outer_sections[1:-1])]
    )
    inner_boundary = (
        list(inner_sections[0])
        + [section[-1] for section in inner_sections[1:-1]]
        + list(reversed(inner_sections[-1]))
        + [section[0] for section in reversed(inner_sections[1:-1])]
    )
    for boundary_index in range(len(outer_boundary)):
        next_index = (boundary_index + 1) % len(outer_boundary)
        outer_a = outer_boundary[boundary_index]
        outer_b = outer_boundary[next_index]
        inner_a = inner_boundary[boundary_index]
        inner_b = inner_boundary[next_index]
        faces.append([outer_a, inner_a, inner_b])
        faces.append([outer_a, inner_b, outer_b])

    outer_face_count = len(outer_surface_faces)
    inner_face_count = outer_face_count
    rim_face_count = len(faces) - outer_face_count - inner_face_count

    faces_array = np.asarray(faces, dtype=np.int64)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces_array, process=False, validate=False)
    if mesh.volume < 0:
        mesh.faces = mesh.faces[:, ::-1]
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals(multibody=False)

    # Move the complete shell so the lowest inner point is Z=0 while preserving shape.
    z_shift = -float(mesh.bounds[0, 2])
    mesh.apply_translation([0.0, 0.0, z_shift])
    vertices[:, 2] += z_shift
    # STL and GLB both store float32 positions. Canonicalize the source mesh to
    # that same representation before hashing so parity is about geometry, not
    # an exporter precision side effect.
    mesh.vertices = np.asarray(mesh.vertices, dtype=np.float32)

    # remove_unreferenced_vertices does not change this intentionally fully-referenced mesh.
    if len(mesh.vertices) != len(uv):
        raise ValueError("UV cardinality changed while preparing shell mesh")
    mesh.visual = trimesh.visual.texture.TextureVisuals(
        uv=uv,
        material=trimesh.visual.material.PBRMaterial(
            name="simulated-almond-shell-candidate-v3",
            baseColorFactor=[244, 166, 190, 255],
            metallicFactor=0.0,
            roughnessFactor=0.24,
            doubleSided=True,
            alphaMode="OPAQUE",
        ),
    )

    outer_tip, inner_tip, tip_thickness = shell_heights(0.0, 0.0)
    outer_root, inner_root, root_thickness = shell_heights(1.0, 0.0)
    middle_row_index = min(range(len(rows)), key=lambda index: abs(float(rows[index]["y"]) + 8.0))
    middle_t = float(rows[middle_row_index]["t"])
    middle_outer_center, middle_inner_center, middle_thickness = shell_heights(middle_t, 0.0)
    middle_outer_side, middle_inner_side, middle_side_thickness = shell_heights(middle_t, 1.0)
    centreline_outer = [outer_tip]
    centreline_inner = [inner_tip]
    for row in rows:
        t = float(row["t"])
        outer_z, inner_z, _ = shell_heights(t, 0.0)
        centreline_outer.append(outer_z)
        centreline_inner.append(inner_z)
    centreline_outer.append(outer_root)
    centreline_inner.append(inner_root)

    sampled_y = np.linspace(tip_y + 0.001, root_y - 0.001, 2000)
    sampled_widths = np.asarray([2.0 * half_width_at_y(outline, float(y)) for y in sampled_y])
    max_width_index = int(np.argmax(sampled_widths))
    max_width_y = float(sampled_y[max_width_index])
    station_values = [0.05, 0.25, 0.5, 0.75, 0.95]
    c_curve_stations: list[dict[str, float]] = []
    longitudinal_stations: list[dict[str, float]] = []
    thickness_stations: list[dict[str, float]] = []
    for station_v in station_values:
        station_y = tip_y + station_v * span_y
        station_half_width = half_width_at_y(outline, station_y)
        station_outer, station_inner, station_thickness = shell_heights(station_v, 0.0)
        station_side_outer, _, _ = shell_heights(station_v, 1.0)
        station_sag = station_outer - station_side_outer
        equivalent_radius = (station_half_width * station_half_width + station_sag * station_sag) / (2.0 * station_sag)
        c_curve_stations.append({
            "v": station_v,
            "widthMm": station_half_width * 2.0,
            "crownRiseMm": station_sag,
            "radiusMm": equivalent_radius,
        })
        longitudinal_stations.append({"v": station_v, "outerZMm": station_outer + z_shift, "innerZMm": station_inner + z_shift})
        thickness_stations.append({"v": station_v, "thicknessMm": station_thickness})

    outer_points = np.asarray(mesh.vertices[:len(outer_vertices)], dtype=np.float64)
    tip_index = min(np.flatnonzero(np.isclose(outer_points[:, 1], outer_points[:, 1].min(), atol=1e-6)), key=lambda index: abs(float(outer_points[index, 0])))
    root_index = min(np.flatnonzero(np.isclose(outer_points[:, 1], outer_points[:, 1].max(), atol=1e-6)), key=lambda index: abs(float(outer_points[index, 0])))
    left_index = int(np.argmin(outer_points[:, 0]))
    right_index = int(np.argmax(outer_points[:, 0]))
    apex_index = int(np.argmax(outer_points[:, 2]))
    landmarks = [
        {"id": "tip", "xMm": float(outer_points[tip_index, 0]), "yMm": float(outer_points[tip_index, 1]), "zMm": float(outer_points[tip_index, 2])},
        {"id": "root_center", "xMm": float(outer_points[root_index, 0]), "yMm": float(outer_points[root_index, 1]), "zMm": float(outer_points[root_index, 2])},
        {"id": "left_side", "xMm": float(outer_points[left_index, 0]), "yMm": float(outer_points[left_index, 1]), "zMm": float(outer_points[left_index, 2])},
        {"id": "right_side", "xMm": float(outer_points[right_index, 0]), "yMm": float(outer_points[right_index, 1]), "zMm": float(outer_points[right_index, 2])},
        {"id": "apex", "xMm": float(outer_points[apex_index, 0]), "yMm": float(outer_points[apex_index, 1]), "zMm": float(outer_points[apex_index, 2])},
    ]

    metrics = {
        "tipYmm": tip_y,
        "cuticleSeatYmm": root_y,
        "nominalLengthMm": 18.0,
        "envelopeLengthMm": span_y,
        "maxWidthMm": float(outline[:, 0].max() - outline[:, 0].min()),
        "maxWidthYmm": max_width_y,
        "maxWidthPositionFromRootRatio": (root_y - max_width_y) / span_y,
        "tipCapSectionVertexCounts": [1, 3, 5],
        "rootCapSectionVertexCounts": [5, 3, 1],
        "regionFaceCounts": {"outer": outer_face_count, "inner": inner_face_count, "rim": rim_face_count},
        "landmarks": landmarks,
        "cCurveStations": c_curve_stations,
        "longitudinalStations": longitudinal_stations,
        "thicknessStations": thickness_stations,
        "transverseOuterCrownMm": middle_outer_center - middle_outer_side,
        "undersideCavityDepthMm": middle_inner_center - middle_inner_side,
        "longitudinalOuterRiseMm": max(centreline_outer) - max(centreline_outer[0], centreline_outer[-1]),
        "longitudinalInnerRiseMm": max(centreline_inner) - max(centreline_inner[0], centreline_inner[-1]),
        "thicknessMm": {
            "tipCentre": tip_thickness,
            "midbodyCentre": middle_thickness,
            "midbodySide": middle_side_thickness,
            "cuticleCentre": root_thickness,
        },
        "zShiftMm": z_shift,
    }
    return mesh, outline, metrics


def canonical_triangle_hash(mesh: trimesh.Trimesh) -> str:
    triangles: list[tuple[tuple[int, int, int], ...]] = []
    scale = 1.0 / QUANTIZATION_MM
    for triangle in mesh.triangles:
        quantized = [tuple(int(round(float(value) * scale)) for value in vertex) for vertex in triangle]
        triangles.append(tuple(sorted(quantized)))
    payload = json.dumps(sorted(triangles), separators=(",", ":")).encode("utf-8")
    return sha256_bytes(payload)


def assign_area_weighted_vertex_normals(mesh: trimesh.Trimesh) -> None:
    triangles = np.asarray(mesh.vertices)[np.asarray(mesh.faces)]
    face_vectors = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    vertex_vectors = np.zeros((len(mesh.vertices), 3), dtype=np.float64)
    for corner in range(3):
        np.add.at(vertex_vectors, np.asarray(mesh.faces)[:, corner], face_vectors)
    lengths = np.linalg.norm(vertex_vectors, axis=1)
    if np.any(lengths <= 1e-12) or not np.all(np.isfinite(lengths)):
        raise ValueError("cannot compute finite area-weighted vertex normals")
    mesh.vertex_normals = vertex_vectors / lengths[:, None]


def edge_topology(mesh: trimesh.Trimesh) -> dict[str, int | bool | float]:
    edges: dict[tuple[int, int], list[tuple[int, int, int]]] = {}
    for face_index, face in enumerate(mesh.faces):
        for start, end in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            key = (int(min(start, end)), int(max(start, end)))
            edges.setdefault(key, []).append((int(start), int(end), face_index))
    boundary = sum(1 for incidents in edges.values() if len(incidents) == 1)
    non_manifold = sum(1 for incidents in edges.values() if len(incidents) > 2)
    winding_errors = sum(
        1
        for incidents in edges.values()
        if len(incidents) == 2 and incidents[0][:2] == incidents[1][:2]
    )
    adjacency: list[set[int]] = [set() for _ in range(len(mesh.faces))]
    for incidents in edges.values():
        if len(incidents) != 2:
            continue
        first, second = incidents[0][2], incidents[1][2]
        adjacency[first].add(second)
        adjacency[second].add(first)
    visited: set[int] = set()
    connected_components = 0
    for start in range(len(adjacency)):
        if start in visited:
            continue
        connected_components += 1
        stack = [start]
        visited.add(start)
        while stack:
            current = stack.pop()
            for neighbour in adjacency[current]:
                if neighbour not in visited:
                    visited.add(neighbour)
                    stack.append(neighbour)
    unique_faces = mesh.unique_faces()
    nondegenerate_faces = mesh.nondegenerate_faces(height=1e-8)
    return {
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.faces)),
        "edges": int(len(edges)),
        "boundaryEdges": boundary,
        "nonManifoldEdges": non_manifold,
        "inconsistentWindingEdges": winding_errors,
        "connectedComponents": connected_components,
        "degenerateTriangles": int(len(mesh.faces) - int(np.count_nonzero(nondegenerate_faces))),
        "duplicateTriangles": int(len(mesh.faces) - int(np.count_nonzero(unique_faces))),
        "eulerNumber": int(mesh.euler_number),
        "watertight": bool(mesh.is_watertight),
        "windingConsistent": bool(mesh.is_winding_consistent),
        "volumeMm3": float(mesh.volume),
        "surfaceAreaMm2": float(mesh.area),
    }


def triangle_quality(mesh: trimesh.Trimesh) -> dict[str, float]:
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
    longest = edges.max(axis=1)
    aspect = longest / (2.0 * areas / longest)
    angles: list[np.ndarray] = []
    for opposite, adjacent_a, adjacent_b in (
        (edges[:, 0], edges[:, 1], edges[:, 2]),
        (edges[:, 1], edges[:, 2], edges[:, 0]),
        (edges[:, 2], edges[:, 0], edges[:, 1]),
    ):
        cosine = np.clip(
            (adjacent_a**2 + adjacent_b**2 - opposite**2) / (2.0 * adjacent_a * adjacent_b),
            -1.0,
            1.0,
        )
        angles.append(np.degrees(np.arccos(cosine)))
    return {
        "minTriangleAngleDeg": float(np.min(np.stack(angles, axis=1))),
        "maxTriangleAspectRatio": float(np.max(aspect)),
    }


def load_glb_mesh(value: bytes) -> trimesh.Trimesh:
    loaded = trimesh.load(file_obj=io.BytesIO(value), file_type="glb", force="scene", process=False)
    if isinstance(loaded, trimesh.Trimesh):
        return loaded
    meshes: list[trimesh.Trimesh] = []
    for node_name in loaded.graph.nodes_geometry:
        transform, geometry_name = loaded.graph[node_name]
        geometry = loaded.geometry[geometry_name].copy()
        geometry.apply_transform(transform)
        meshes.append(geometry)
    if len(meshes) != 1:
        raise ValueError(f"expected one GLB mesh/node, found {len(meshes)}")
    return meshes[0]


def max_point_to_polyline_distance(points: np.ndarray, polyline: np.ndarray) -> float:
    starts = polyline[:-1]
    vectors = polyline[1:] - starts
    lengths_squared = np.einsum("ij,ij->i", vectors, vectors)
    if np.any(lengths_squared <= 1e-16):
        raise ValueError("planform polyline contains a zero-length segment")
    maximum = 0.0
    for point in points:
        ratios = np.clip(np.einsum("ij,ij->i", point - starts, vectors) / lengths_squared, 0.0, 1.0)
        projected = starts + ratios[:, None] * vectors
        maximum = max(maximum, float(np.linalg.norm(projected - point, axis=1).min()))
    return maximum


def planform_hausdorff_mm(outline: np.ndarray, mesh: trimesh.Trimesh) -> float:
    vertices = np.asarray(mesh.vertices)
    x = vertices[:, 0]
    y = vertices[:, 1]
    z = vertices[:, 2]
    # Rim vertices occur in outer/inner pairs at matching XY. Keep the lowest and
    # highest X for each sampled Y plus the two poles.
    groups: dict[int, list[int]] = {}
    for index, value in enumerate(y):
        groups.setdefault(int(round(float(value) * 100_000)), []).append(index)
    sections: list[tuple[float, float, float]] = []
    for indices in groups.values():
        candidates = np.asarray(indices, dtype=np.int64)
        left = candidates[np.argmin(x[candidates])]
        right = candidates[np.argmax(x[candidates])]
        sections.append((float(y[left]), float(x[left]), float(x[right])))
    sections.sort(key=lambda item: item[0])
    right_side = [[right, row_y] for row_y, _left, right in sections]
    left_side = [[left, row_y] for row_y, left, _right in reversed(sections)]
    boundary_array = np.asarray(right_side + left_side[1:-1] + [right_side[0]], dtype=np.float64)
    # Silence the intentional non-use warning and ensure the geometry is finite.
    if not np.all(np.isfinite(z)):
        raise ValueError("mesh contains non-finite Z values")
    return max(
        max_point_to_polyline_distance(outline[:-1], boundary_array),
        max_point_to_polyline_distance(boundary_array[:-1], outline),
    )


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def generate(output_root: Path) -> dict[str, object]:
    toolchain = toolchain_metadata()
    params_bytes = PARAMS_PATH.read_bytes()
    svg_bytes = SILHOUETTE_PATH.read_bytes()
    candidate_profile_bytes = CANDIDATE_PROFILE_PATH.read_bytes()
    params = json.loads(params_bytes)
    candidate_profile = json.loads(candidate_profile_bytes)
    almond = params["shapes"]["almond"]
    medium = params["lengths"]["medium"]
    if almond["curveModel"] != "cuticle-seat" or medium["lengthMm"] != 18 or medium["widthMm"] != 11:
        raise ValueError("signed almond medium source contract changed")

    signed_outline = sample_svg_outline(svg_bytes.decode("utf-8"))
    outline = sample_candidate_outline(candidate_profile)
    mesh, outline, shape_metrics = create_shell_mesh(outline)
    topology = edge_topology(mesh)
    quality = triangle_quality(mesh)
    if not mesh.is_volume or topology["boundaryEdges"] != 0 or topology["nonManifoldEdges"] != 0:
        raise ValueError(f"generated shell is not one closed oriented volume: {topology}")

    source_hash = canonical_triangle_hash(mesh)
    assign_area_weighted_vertex_normals(mesh)
    stl_bytes = mesh.export(file_type="stl")
    if not isinstance(stl_bytes, bytes):
        stl_bytes = bytes(stl_bytes)
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=ASSET_ID, geom_name=ASSET_ID, transform=np.eye(4))
    glb_bytes = trimesh.exchange.gltf.export_glb(scene, include_normals=True)

    stl_mesh = trimesh.load(file_obj=io.BytesIO(stl_bytes), file_type="stl", force="mesh", process=False)
    glb_mesh = load_glb_mesh(glb_bytes)
    stl_hash = canonical_triangle_hash(stl_mesh)
    glb_hash = canonical_triangle_hash(glb_mesh)
    if stl_hash != source_hash or glb_hash != source_hash:
        raise ValueError(f"STL/GLB triangle drift: source={source_hash}, stl={stl_hash}, glb={glb_hash}")

    bounds = np.asarray(mesh.bounds, dtype=np.float64)
    stl_bounds = np.asarray(stl_mesh.bounds, dtype=np.float64)
    glb_bounds = np.asarray(glb_mesh.bounds, dtype=np.float64)
    if not np.allclose(bounds, stl_bounds, atol=0.01) or not np.allclose(bounds, glb_bounds, atol=0.01):
        raise ValueError("STL/GLB bounds drift beyond 0.01mm")

    generator_sha = sha256_file(Path(__file__).resolve())
    source = {
        "shapeParams": {
            "path": str(PARAMS_PATH.relative_to(PROJECT_ROOT)),
            "sha256": sha256_bytes(params_bytes),
            "version": params["version"],
        },
        "signed2dSilhouette": {
            "path": str(SILHOUETTE_PATH.relative_to(PROJECT_ROOT)),
            "sha256": sha256_bytes(svg_bytes),
            "evidence": "SIGNED_OFF_2D_SILHOUETTE",
        },
        "productVisualCandidate": {
            "path": str(CANDIDATE_PROFILE_PATH.relative_to(PROJECT_ROOT)),
            "sha256": sha256_bytes(candidate_profile_bytes),
            "profileId": candidate_profile["profileId"],
            "evidence": "PRODUCT_VISUAL_SIGNED_OFF_NOT_PROMOTED",
            "referenceHausdorffMm": planform_hausdorff_mm(signed_outline, mesh),
        },
        "generator": {
            "path": str(Path(__file__).resolve().relative_to(PROJECT_ROOT)),
            "sha256": generator_sha,
            "contract": GENERATOR_CONTRACT,
        },
        "toolchain": toolchain,
    }
    assumptions = {
        "evidence": "SIMULATED_3D_SOLID",
        "manufacturingValidated": False,
        "transverseProfile": "parabolic C-curve, tapered to candidate review rim",
        "longitudinalProfile": "finite-slope polynomial endpoint blend with local multi-vertex tip/root cap strips",
        "thickness": "vertical preview thickness; about 0.45mm cuticle, 0.60mm tip, 0.75mm apex and 0.50-0.58mm sides",
        "limitations": [
            "not fitted to a scanned nail bed",
            "not a normal-offset engineering shell",
            "product visual candidate has not replaced or promoted the signed 2D silhouette",
            "not validated for material, strength, printing, post-processing, wear or device compatibility",
        ],
    }
    report = {
        "schemaVersion": 1,
        "assetId": ASSET_ID,
        "revision": REVISION,
        "generatedAt": GENERATED_AT,
        "classification": "SIMULATED_ALMOND_SHELL_CANDIDATE",
        "truthLabel": "SIMULATED ALMOND SHELL · 预览/算法验证资产 · 非制造就绪",
        "disclosure": "STL/GLB 由同一参数化网格生成；仅验证数字几何与浏览器加载，未验证佩戴贴合、壁厚、强度、材料、打印、后处理或设备兼容性。",
        "coordinateSystem": {
            "units": "mm",
            "handedness": "RIGHT_HANDED",
            "origin": "NAIL_ROOT_CENTER_PLANFORM; Z shifted so lowest inner point is 0",
            "axes": {"x": "left_to_right", "y": "tip_negative_to_root_positive", "z": "surface_outward_positive"},
            "uv": {"u": "left_to_right_0_to_1", "v": "tip_to_root_0_to_1"},
        },
        "source": source,
        "assumptions": assumptions,
        "mesh": {
            **topology,
            **quality,
            "canonicalTriangleSha256": source_hash,
            "quantizationMm": QUANTIZATION_MM,
            "boundsMm": {"min": bounds[0].tolist(), "max": bounds[1].tolist()},
            "planformHausdorffMm": planform_hausdorff_mm(outline, mesh),
            "selfIntersectionRationale": "CONSTRUCTIVE_STRUCTURED_OUTER_INNER_WITH_POSITIVE_VERTICAL_SEPARATION; NOT_A_GENERAL_TRIANGLE_INTERSECTION_TEST",
        },
        "shapeMetrics": shape_metrics,
        "artifactParity": {
            "sourceTriangleSha256": source_hash,
            "stlTriangleSha256": stl_hash,
            "glbTriangleSha256": glb_hash,
            "boundsToleranceMm": 0.01,
            "sameCanonicalTriangles": True,
        },
    }

    stl_path = output_root / STL_RELATIVE
    glb_path = output_root / GLB_RELATIVE
    stl_path.parent.mkdir(parents=True, exist_ok=True)
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    stl_path.write_bytes(stl_bytes)
    glb_path.write_bytes(glb_bytes)

    artifacts = {
        "stl": {
            "path": str(STL_RELATIVE),
            "sha256": sha256_bytes(stl_bytes),
            "bytes": len(stl_bytes),
            "visibility": "INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED",
            "mime": "model/stl",
        },
        "glb": {
            "path": str(GLB_RELATIVE),
            "runtimeUrl": "/" + str(GLB_RELATIVE),
            "sha256": sha256_bytes(glb_bytes),
            "bytes": len(glb_bytes),
            "visibility": "DEV_REVIEW_ONLY",
            "mime": "model/gltf-binary",
        },
    }
    report["artifacts"] = artifacts
    manifest = {
        "schemaVersion": 1,
        "assetId": ASSET_ID,
        "revision": REVISION,
        "status": "SIMULATED_CANDIDATE_NOT_PROMOTED",
        "manufacturingValidated": False,
        "source": source,
        "coordinateSystem": report["coordinateSystem"],
        "canonicalTriangleSha256": source_hash,
        "boundsMm": report["mesh"]["boundsMm"],
        "topology": {
            "vertices": topology["vertices"],
            "triangles": topology["triangles"],
            "boundaryEdges": topology["boundaryEdges"],
            "nonManifoldEdges": topology["nonManifoldEdges"],
            "inconsistentWindingEdges": topology["inconsistentWindingEdges"],
            "connectedComponents": topology["connectedComponents"],
            "degenerateTriangles": topology["degenerateTriangles"],
            "duplicateTriangles": topology["duplicateTriangles"],
            "eulerNumber": topology["eulerNumber"],
        },
        "artifacts": artifacts,
    }
    write_json(output_root / REPORT_RELATIVE, report)
    write_json(output_root / MANIFEST_RELATIVE, manifest)
    write_json(output_root / EVIDENCE_REPORT_RELATIVE, report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", type=Path, default=PROJECT_ROOT)
    args = parser.parse_args()
    report = generate(args.output_root.resolve())
    summary = {
        "assetId": report["assetId"],
        "revision": report["revision"],
        "triangles": report["mesh"]["triangles"],
        "boundsMm": report["mesh"]["boundsMm"],
        "canonicalTriangleSha256": report["mesh"]["canonicalTriangleSha256"],
        "transverseOuterCrownMm": report["shapeMetrics"]["transverseOuterCrownMm"],
        "undersideCavityDepthMm": report["shapeMetrics"]["undersideCavityDepthMm"],
    }
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
