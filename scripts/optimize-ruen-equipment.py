#!/usr/bin/env python3
"""Build lightweight, independent equipment GLBs with Blender 4.3.2.

Run from any directory:
  blender --background --factory-startup --threads 2 --python scripts/optimize-ruen-equipment.py

The originals are hash-checked and never exported over. Decimation affects only
the copies; UVs/PBR channels and the source coordinate system are retained. The
user's shield size adjustment belongs to the runtime mount, not this pipeline.
"""
import hashlib
import json
from pathlib import Path
import struct

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
EQUIPMENT = ROOT / "public/assets/models/ruen/equipment"
OUTPUT = EQUIPMENT / "runtime"
EVIDENCE = ROOT / "docs/evidence/ruen-game-equipment/runtime-inventory.json"
ASSETS = [
    dict(kind="sword", source="Meshy_AI_Azure_Oathblade_1022220336_texture.glb",
         output="azure-oathblade.glb", ratio=0.09, grip=[-0.000373, 0.65, -0.000586],
         sha256="111ea36ba748b0ff3d49651411cbb94bdd4bf4ca3f1728337be5d6b271e1e04d"),
    dict(kind="shield", source="Meshy_AI_Aegis_of_the_Azure_St_1022222231_texture.glb",
         output="aegis-of-the-azure.glb", ratio=0.15, grip=[-0.000351, 0.125, -0.275346],
         sha256="b639b29cd66260064cac6ea13f26764dd8c23e561b92da4440ce4e8b77ac7e23"),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def grip_surface_distance(obj, point):
    # glTF (x,y,z) imports into Blender (x,-z,y); evaluate in mesh-local space.
    blender_point = obj.matrix_world.inverted() @ Vector((point[0], -point[2], point[1]))
    surface = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    nearest = surface.find_nearest(blender_point)
    assert nearest[0] is not None
    return nearest[3]


def bake_runtime_normals(target, source, label):
    # The decimated triangles have different UV tangents. Reusing the source's
    # tangent-space normal image directly would make otherwise flat metal look
    # dented. Bake the original evaluated shading into the copy's tangent basis.
    material = target.data.materials[0].copy()
    target.data.materials[0] = material
    normal = next(node for node in material.node_tree.nodes if node.type == "NORMAL_MAP")
    image = bpy.data.images.new(label + "-runtime-normal", width=1024, height=1024, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    image.file_format = "PNG"
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.name = "Runtime normal bake"
    texture.image = image
    material.node_tree.nodes.active = texture
    source.hide_render = False
    source.hide_set(False)
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", use_selected_to_active=True,
                        cage_extrusion=0.01, max_ray_distance=0.03, margin=4, use_clear=True)
    material.node_tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
    source.select_set(False)


def image_dimensions(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return list(struct.unpack_from(">II", data, 16))
    if data[:2] == b"\xff\xd8":
        offset = 2
        while offset < len(data):
            assert data[offset] == 255
            while data[offset] == 255:
                offset += 1
            marker = data[offset]
            offset += 1
            if marker in (0x01, 0xD8) or 0xD0 <= marker <= 0xD7:
                continue
            length = struct.unpack_from(">H", data, offset)[0]
            if marker in (0xC0, 0xC1, 0xC2):
                height, width = struct.unpack_from(">HH", data, offset + 3)
                return [width, height]
            offset += length
    raise ValueError("Expected an embedded JPEG or PNG image")


def material_semantics(material):
    pbr = material.get("pbrMetallicRoughness", {})
    return dict(base_color=pbr.get("baseColorFactor", [1, 1, 1, 1]),
                metal=pbr.get("metallicFactor", 1), roughness=pbr.get("roughnessFactor", 1),
                alpha_mode=material.get("alphaMode", "OPAQUE"), double_sided=material.get("doubleSided", False),
                normal_scale=material.get("normalTexture", {}).get("scale", 1),
                texture_roles=[role for role, holder in (("baseColorTexture", pbr),
                              ("metallicRoughnessTexture", pbr), ("normalTexture", material)) if role in holder])


def inventory(path):
    data = path.read_bytes()
    assert struct.unpack_from("<4sII", data) == (b"glTF", 2, len(data))
    offset, raw, binary = 12, None, None
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            raw = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + size
    assert raw is not None and binary is not None
    assert len(raw.get("nodes", [])) == 1 and raw["nodes"][0].get("mesh") == 0
    node = raw["nodes"][0]
    # Export must preserve the source's flat identity transform. All coordinates
    # below are consequently also exterior-root/world glTF coordinates.
    assert node.get("translation", [0, 0, 0]) == [0, 0, 0]
    assert node.get("rotation", [0, 0, 0, 1]) == [0, 0, 0, 1]
    assert node.get("scale", [1, 1, 1]) == [1, 1, 1]
    assert node.get("matrix", [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) == [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    lo, hi = [float("inf")] * 3, [float("-inf")] * 3
    vertices, triangles = 0, 0
    for mesh in raw.get("meshes", []):
        for primitive in mesh["primitives"]:
            assert primitive.get("mode", 4) == 4
            assert all(key in primitive["attributes"] for key in ("POSITION", "NORMAL", "TEXCOORD_0"))
            accessor = raw["accessors"][primitive["attributes"]["POSITION"]]
            assert accessor["componentType"] == 5126 and accessor["type"] == "VEC3"
            view = raw["bufferViews"][accessor["bufferView"]]
            start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            for index in range(accessor["count"]):
                point = struct.unpack_from("<fff", binary, start + index * view.get("byteStride", 12))
                for axis, value in enumerate(point):
                    lo[axis], hi[axis] = min(lo[axis], value), max(hi[axis], value)
            vertices += accessor["count"]
            triangles += raw["accessors"][primitive["indices"]]["count"] // 3
    images = []
    for image in raw.get("images", []):
        view = raw["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        content = binary[start:start + view["byteLength"]]
        images.append(dict(mime_type=image["mimeType"], dimensions=image_dimensions(content), bytes=len(content)))
    return dict(path=str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path), bytes=len(data), sha256=digest(path),
                vertices=vertices, triangles=triangles, bounds=dict(min=lo, max=hi),
                materials=raw.get("materials", []), images=images,
                material_semantics=[material_semantics(material) for material in raw.get("materials", [])],
                animations=len(raw.get("animations", [])), skins=len(raw.get("skins", [])),
                extensions_used=raw.get("extensionsUsed", []),
                extensions_required=raw.get("extensionsRequired", []))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    report = dict(tool=f"Blender {bpy.app.version_string}", texture_size=1024, jpeg_quality=90,
                  method="Decimate collapse on independent copies; original surface normals transferred by nearest-face interpolation; normal texture baked from original shading to the reduced UV tangent basis and stored losslessly as PNG; preserved UVs/color/metal-roughness; textures1024, color/metal-roughness JPEG90; no geometry compression/decoder.",
                  coordinate_system="Original glTF +Y up, identity exterior transform; no baked mount scaling or grip adjustment.", assets=[])
    for config in ASSETS:
        source, output = EQUIPMENT / config["source"], OUTPUT / config["output"]
        assert digest(source) == config["sha256"], f"Unexpected master: {source}"
        before = inventory(source)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=True)
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        assert len(meshes) == 1
        grip_before = grip_surface_distance(meshes[0], config["grip"])
        for obj in meshes:
            normal_source = obj.copy()
            normal_source.data = obj.data.copy()
            bpy.context.scene.collection.objects.link(normal_source)
            normal_source.hide_render = True
            normal_source.hide_set(True)
            normal_source.select_set(False)
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            modifier = obj.modifiers.new("Runtime copy reduction", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = config["ratio"]
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            normals = obj.modifiers.new("Original surface normals", "DATA_TRANSFER")
            normals.object = normal_source
            normals.use_loop_data = True
            normals.data_types_loops = {"CUSTOM_NORMAL"}
            normals.loop_mapping = "POLYINTERP_NEAREST"
            bpy.ops.object.modifier_apply(modifier=normals.name)
            bake_runtime_normals(obj, normal_source, config["kind"])
            original_mesh = normal_source.data
            bpy.data.objects.remove(normal_source, do_unlink=True)
            bpy.data.meshes.remove(original_mesh)
            obj.name = config["kind"] + "-runtime"
        grip_after = grip_surface_distance(meshes[0], config["grip"])
        assert abs(grip_after - grip_before) < 0.005, "Grip geometry moved beyond tolerance"
        for image in bpy.data.images:
            if image.size[0] > 1024 or image.size[1] > 1024:
                image.scale(1024, 1024)
        bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True,
                                  export_animations=False, export_skins=False, export_morph=False,
                                  export_normals=True, export_tangents=False,
                                  export_image_format="AUTO", export_jpeg_quality=90, export_image_quality=90,
                                  export_keep_originals=False, export_yup=True)
        after = inventory(output)
        assert digest(source) == config["sha256"], "Master changed during export"
        assert after["animations"] == after["skins"] == 0
        assert len(after["materials"]) == 1 and len(after["images"]) == 3
        assert after["material_semantics"] == before["material_semantics"]
        assert not after["extensions_required"], "Runtime copy unexpectedly needs a decoder extension"
        assert all(image["dimensions"] == [1024, 1024] for image in after["images"])
        bound_delta = max(abs(a - b) for key in ("min", "max")
                          for a, b in zip(before["bounds"][key], after["bounds"][key]))
        assert bound_delta < 0.005, f"Source coordinate bounds moved: {bound_delta}"
        report["assets"].append(dict(kind=config["kind"], decimation_ratio=config["ratio"],
                                     source_unchanged=True, max_bound_delta=bound_delta,
                                     grip_raw_gltf=config["grip"],
                                     grip_to_surface=dict(source=grip_before, runtime=grip_after,
                                                          absolute_delta=abs(grip_after-grip_before)),
                                     source=before, runtime=after))
    report["totals"] = {version: {key: sum(asset[version][key] for asset in report["assets"])
                                     for key in ("bytes", "vertices", "triangles")}
                        for version in ("source", "runtime")}
    EVIDENCE.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print("Runtime equipment inventory:", json.dumps(report["totals"]))


if __name__ == "__main__":
    main()
