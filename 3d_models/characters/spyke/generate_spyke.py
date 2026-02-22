"""
Spyke Tinwall — Blender Character Generation Script
=====================================================
Run inside Blender: File > Scripting > Open > Run Script
Or from CLI: blender --background --python generate_spyke.py

Generates a proportionally correct blockout model of Spyke Tinwall
with full armature, material assignments, and equipment pieces.
The blockout can be refined/sculpted into final art, but proportions,
rig, materials, and equipment placement are production-ready.

Character spec source: pipeline/data/characters/spyke-tinwall.yaml
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# CONSTANTS — Spyke's canonical measurements
# ---------------------------------------------------------------------------
# 21-year-old male, slim athletic build. Using ~1.78m (5'10") as base height.
TOTAL_HEIGHT = 1.78
HEAD_HEIGHT = TOTAL_HEIGHT / 7.5  # Manga proportion (slightly heroic)

# Body segment ratios (from ground up, as fraction of total height)
PROPORTIONS = {
    "foot_height": 0.05,
    "ankle_y": 0.06,
    "knee_y": 0.27,
    "hip_y": 0.47,
    "waist_y": 0.54,
    "chest_y": 0.67,
    "shoulder_y": 0.78,
    "neck_y": 0.83,
    "chin_y": 0.85,
    "head_top_y": 1.0,
    # Widths
    "shoulder_width": 0.24,   # Each side from center
    "hip_width": 0.12,
    "waist_width": 0.14,
    "chest_width": 0.20,
    "head_width": 0.08,
    "neck_width": 0.05,
}

# Arm lengths (from shoulder)
ARM = {
    "upper_len": 0.17,   # Shoulder to elbow
    "forearm_len": 0.15,  # Elbow to wrist
    "hand_len": 0.06,
}

# Leg lengths
LEG = {
    "thigh_len": 0.24,   # Hip to knee
    "shin_len": 0.22,    # Knee to ankle
}

# ---------------------------------------------------------------------------
# COLOR PALETTE — Exact character colors
# ---------------------------------------------------------------------------
COLORS = {
    "skin":          (0.87, 0.74, 0.62, 1.0),   # Fair skin
    "hair_ginger":   (0.75, 0.30, 0.08, 1.0),   # Copper-red/ginger
    "eyes_green":    (0.18, 0.72, 0.22, 1.0),   # Sharp green
    "bandana_red":   (0.85, 0.10, 0.10, 1.0),   # Bright red
    "tshirt_black":  (0.05, 0.05, 0.05, 1.0),   # Black fitted t-shirt
    "cloak_white":   (0.92, 0.90, 0.88, 1.0),   # White cloak (slightly warm)
    "cloak_trim":    (0.05, 0.05, 0.05, 1.0),   # Black geometric bottom hem
    "belt_red":      (0.70, 0.08, 0.08, 1.0),   # Red-accented belt
    "pants_black":   (0.08, 0.08, 0.08, 1.0),   # Black combat pants
    "boots_dark":    (0.12, 0.10, 0.08, 1.0),   # Dark combat boots
    "glove_red":     (0.80, 0.12, 0.10, 1.0),   # Red fingerless glove
    "bracer_red":    (0.72, 0.08, 0.06, 1.0),   # Red metallic bracer
    "bracer_metal":  (0.55, 0.15, 0.12, 1.0),   # Metallic red accent
    "harness_brown": (0.40, 0.25, 0.12, 1.0),   # Thick brown leather
    "sword_grey":    (0.35, 0.35, 0.38, 1.0),   # Dark grey metallic
    "sheath_grey":   (0.25, 0.25, 0.28, 1.0),   # Sheath dark grey
    "knee_pad_metal":(0.50, 0.50, 0.55, 1.0),   # Metal knee pauldron
    "katana_sheath": (0.15, 0.12, 0.10, 1.0),   # Dark katana sheath
    "dojo_insignia": (0.02, 0.02, 0.02, 1.0),   # Black insignia
}


# ===========================================================================
# UTILITY FUNCTIONS
# ===========================================================================

def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def y(name):
    """Convert named proportion to world-space Y coordinate."""
    return PROPORTIONS[name] * TOTAL_HEIGHT


def create_material(name, color):
    """Create a simple material with the given RGBA color."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    for node in nodes:
        nodes.remove(node)

    # Principled BSDF
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Specular IOR Level'].default_value = 0.1

    # Output
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return mat


def assign_material(obj, mat):
    """Assign material to object."""
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def create_capsule(name, radius, height, location, material, segments=16):
    """Create a capsule shape (cylinder with hemisphere caps)."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=height,
        location=location,
        vertices=segments,
    )
    obj = bpy.context.active_object
    obj.name = name

    # Smooth shading
    bpy.ops.object.shade_smooth()

    # Add subdivision for smoother shape
    mod = obj.modifiers.new("Subsurf", 'SUBSURF')
    mod.levels = 1
    mod.render_levels = 2

    assign_material(obj, material)
    return obj


def create_box(name, dimensions, location, material, rotation=(0, 0, 0)):
    """Create a box with given dimensions at location."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (dimensions[0], dimensions[1], dimensions[2])
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    assign_material(obj, material)
    return obj


def create_hexagon(name, radius, depth, location, material, rotation=(0, 0, 0)):
    """Create a hexagonal shape (for knee pauldron)."""
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    assign_material(obj, material)
    return obj


# ===========================================================================
# BODY CONSTRUCTION
# ===========================================================================

def build_body(materials):
    """Build Spyke's body blockout — slim athletic male, age 21."""
    parts = []
    skin = materials["skin"]

    # --- HEAD ---
    head_center_y = (y("chin_y") + y("head_top_y")) / 2
    head_h = y("head_top_y") - y("chin_y")
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=head_h * 0.52,
        location=(0, 0, head_center_y),
        segments=24, ring_count=16,
    )
    head = bpy.context.active_object
    head.name = "Spyke_Head"
    # Slightly elongate for manga proportions
    head.scale = (1.0, 0.9, 1.05)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    assign_material(head, skin)
    parts.append(head)

    # --- NECK ---
    neck_center = (y("chin_y") + y("neck_y")) / 2
    neck = create_capsule(
        "Spyke_Neck", 0.035, y("chin_y") - y("neck_y"),
        (0, 0, neck_center), skin,
    )
    parts.append(neck)

    # --- TORSO (upper chest) ---
    chest_center = (y("shoulder_y") + y("waist_y")) / 2
    chest_h = y("shoulder_y") - y("waist_y")
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, chest_center))
    torso = bpy.context.active_object
    torso.name = "Spyke_Torso"
    torso.scale = (
        PROPORTIONS["chest_width"] * TOTAL_HEIGHT,
        0.12 * TOTAL_HEIGHT,
        chest_h / 2,
    )
    bpy.ops.object.transform_apply(scale=True)
    # Add subsurf for organic shape
    mod = torso.modifiers.new("Subsurf", 'SUBSURF')
    mod.levels = 2
    mod.render_levels = 2
    bpy.ops.object.shade_smooth()
    assign_material(torso, materials["tshirt_black"])
    parts.append(torso)

    # --- WAIST / HIP ---
    hip_center = (y("waist_y") + y("hip_y")) / 2
    hip_h = y("waist_y") - y("hip_y")
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, hip_center))
    hips = bpy.context.active_object
    hips.name = "Spyke_Hips"
    hips.scale = (
        PROPORTIONS["hip_width"] * TOTAL_HEIGHT,
        0.10 * TOTAL_HEIGHT,
        hip_h / 2,
    )
    bpy.ops.object.transform_apply(scale=True)
    mod = hips.modifiers.new("Subsurf", 'SUBSURF')
    mod.levels = 1
    bpy.ops.object.shade_smooth()
    assign_material(hips, materials["pants_black"])
    parts.append(hips)

    # --- ARMS ---
    for side_name, sign in [("Right", 1), ("Left", -1)]:
        shoulder_x = sign * PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT
        shoulder_z = y("shoulder_y")

        # Upper arm
        elbow_z = shoulder_z - ARM["upper_len"] * TOTAL_HEIGHT
        ua_center_z = (shoulder_z + elbow_z) / 2
        ua = create_capsule(
            f"Spyke_UpperArm_{side_name}",
            0.032, ARM["upper_len"] * TOTAL_HEIGHT,
            (shoulder_x, 0, ua_center_z), skin,
        )
        parts.append(ua)

        # Forearm
        wrist_z = elbow_z - ARM["forearm_len"] * TOTAL_HEIGHT
        fa_center_z = (elbow_z + wrist_z) / 2
        fa = create_capsule(
            f"Spyke_Forearm_{side_name}",
            0.028, ARM["forearm_len"] * TOTAL_HEIGHT,
            (shoulder_x, 0, fa_center_z), skin,
        )
        parts.append(fa)

        # Hand
        hand_z = wrist_z - ARM["hand_len"] * TOTAL_HEIGHT * 0.5
        hand = create_capsule(
            f"Spyke_Hand_{side_name}",
            0.022, ARM["hand_len"] * TOTAL_HEIGHT,
            (shoulder_x, 0, hand_z), skin,
        )
        parts.append(hand)

    # --- LEGS ---
    for side_name, sign in [("Right", 1), ("Left", -1)]:
        hip_x = sign * PROPORTIONS["hip_width"] * TOTAL_HEIGHT * 0.8

        # Thigh
        knee_z = y("knee_y")
        hip_z = y("hip_y")
        thigh_center = (hip_z + knee_z) / 2
        thigh = create_capsule(
            f"Spyke_Thigh_{side_name}",
            0.055, hip_z - knee_z,
            (hip_x, 0, thigh_center), materials["pants_black"],
        )
        parts.append(thigh)

        # Shin
        ankle_z = y("ankle_y")
        shin_center = (knee_z + ankle_z) / 2
        shin = create_capsule(
            f"Spyke_Shin_{side_name}",
            0.042, knee_z - ankle_z,
            (hip_x, 0, shin_center), materials["pants_black"],
        )
        parts.append(shin)

        # Foot/Boot
        foot = create_box(
            f"Spyke_Boot_{side_name}",
            (0.05, 0.12, 0.04),
            (hip_x, 0.02, y("foot_height") * 0.5),
            materials["boots_dark"],
        )
        parts.append(foot)

    return parts


# ===========================================================================
# HAIR
# ===========================================================================

def build_hair(materials):
    """Ginger hair — straight and layered, between traps and shoulders."""
    parts = []
    hair_mat = materials["hair_ginger"]
    head_top = y("head_top_y")
    chin_y_val = y("chin_y")

    # Main hair volume (top of head, flowing down)
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.105,
        location=(0, -0.01, head_top - 0.04),
        segments=16, ring_count=12,
    )
    hair_top = bpy.context.active_object
    hair_top.name = "Spyke_Hair_Top"
    hair_top.scale = (1.0, 1.1, 0.85)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    assign_material(hair_top, hair_mat)
    parts.append(hair_top)

    # Hair back — layered, length between traps and shoulders (~shoulder_y level)
    # The hair hangs down to roughly trap level (between neck and shoulders)
    trap_z = y("neck_y") - 0.04
    hair_back_center = (y("head_top_y") - 0.06 + trap_z) / 2
    hair_back_h = y("head_top_y") - 0.06 - trap_z

    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(0, -0.06, hair_back_center),
    )
    hair_back = bpy.context.active_object
    hair_back.name = "Spyke_Hair_Back"
    hair_back.scale = (0.09, 0.04, hair_back_h / 2)
    bpy.ops.object.transform_apply(scale=True)
    mod = hair_back.modifiers.new("Subsurf", 'SUBSURF')
    mod.levels = 2
    bpy.ops.object.shade_smooth()
    assign_material(hair_back, hair_mat)
    parts.append(hair_back)

    # Side hair layers (L and R)
    for side_name, sign in [("Right", 1), ("Left", -1)]:
        bpy.ops.mesh.primitive_cube_add(
            size=1,
            location=(sign * 0.07, -0.03, hair_back_center + 0.02),
        )
        hair_side = bpy.context.active_object
        hair_side.name = f"Spyke_Hair_Side_{side_name}"
        hair_side.scale = (0.035, 0.04, hair_back_h / 2.5)
        bpy.ops.object.transform_apply(scale=True)
        mod = hair_side.modifiers.new("Subsurf", 'SUBSURF')
        mod.levels = 2
        bpy.ops.object.shade_smooth()
        assign_material(hair_side, hair_mat)
        parts.append(hair_side)

    # Bandana — forehead strip only, NOT wrapping around skull
    bandana_z = y("head_top_y") - (y("head_top_y") - chin_y_val) * 0.55
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.09, depth=0.025,
        location=(0, 0, bandana_z),
        rotation=(0, 0, 0),
    )
    bandana = bpy.context.active_object
    bandana.name = "Spyke_Bandana"
    # Only the front strip is visible — scale Y to flatten against forehead
    bandana.scale = (1.0, 0.85, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    assign_material(bandana, materials["bandana_red"])
    parts.append(bandana)

    return parts


# ===========================================================================
# CLOTHING & EQUIPMENT
# ===========================================================================

def build_cloak(materials):
    """White knee-length cloak with crude cut-off sleeves."""
    parts = []
    cloak_mat = materials["cloak_white"]

    # Main cloak body — from shoulders down to knee level
    shoulder_z = y("shoulder_y")
    knee_z = y("knee_y")
    cloak_center = (shoulder_z + knee_z) / 2
    cloak_h = shoulder_z - knee_z

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, cloak_center))
    cloak = bpy.context.active_object
    cloak.name = "Spyke_Cloak_Body"
    cloak.scale = (
        PROPORTIONS["chest_width"] * TOTAL_HEIGHT + 0.02,  # Slightly wider than torso
        0.13 * TOTAL_HEIGHT + 0.01,
        cloak_h / 2,
    )
    bpy.ops.object.transform_apply(scale=True)
    mod = cloak.modifiers.new("Subsurf", 'SUBSURF')
    mod.levels = 1
    bpy.ops.object.shade_smooth()
    assign_material(cloak, cloak_mat)
    parts.append(cloak)

    # Black geometric pattern strip along bottom hem
    hem_z = knee_z + 0.02
    hem = create_box(
        "Spyke_Cloak_Hem_Pattern",
        (PROPORTIONS["chest_width"] * TOTAL_HEIGHT + 0.025, 0.135 * TOTAL_HEIGHT, 0.015),
        (0, 0, hem_z),
        materials["cloak_trim"],
    )
    parts.append(hem)

    # Frayed shoulder edges (visual indicator of crude cut-off)
    for side_name, sign in [("Right", 1), ("Left", -1)]:
        sx = sign * (PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT - 0.01)
        fray = create_box(
            f"Spyke_Cloak_Fray_{side_name}",
            (0.035, 0.06, 0.012),
            (sx, 0, shoulder_z - 0.01),
            cloak_mat,
        )
        parts.append(fray)

    return parts


def build_belt(materials):
    """Red-accented belt at waist."""
    waist_z = y("waist_y")
    bpy.ops.mesh.primitive_cylinder_add(
        radius=PROPORTIONS["waist_width"] * TOTAL_HEIGHT + 0.005,
        depth=0.03,
        location=(0, 0, waist_z),
    )
    belt = bpy.context.active_object
    belt.name = "Spyke_Belt"
    belt.scale = (1.0, 0.7, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    assign_material(belt, materials["belt_red"])
    return [belt]


def build_arm_equipment(materials):
    """
    Asymmetric arm equipment:
    - Character's RIGHT arm (viewer-left): red fingerless glove, hand only
    - Character's LEFT arm (viewer-right): red metallic bracer, hand + forearm to elbow
    """
    parts = []
    r_shoulder_x = PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT
    l_shoulder_x = -PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT

    shoulder_z = y("shoulder_y")
    elbow_z = shoulder_z - ARM["upper_len"] * TOTAL_HEIGHT
    wrist_z = elbow_z - ARM["forearm_len"] * TOTAL_HEIGHT

    # --- CHARACTER'S RIGHT ARM (positive X = viewer-left): fingerless glove ---
    hand_z = wrist_z - ARM["hand_len"] * TOTAL_HEIGHT * 0.5
    glove = create_capsule(
        "Spyke_Glove_Right",
        0.025, ARM["hand_len"] * TOTAL_HEIGHT * 0.8,
        (r_shoulder_x, 0, hand_z),
        materials["glove_red"],
    )
    parts.append(glove)

    # --- CHARACTER'S LEFT ARM (negative X = viewer-right): bracer ---
    # Covers hand + forearm, stops at elbow
    bracer_center = (wrist_z + elbow_z) / 2
    bracer_h = elbow_z - wrist_z + ARM["hand_len"] * TOTAL_HEIGHT
    bracer_bottom = wrist_z - ARM["hand_len"] * TOTAL_HEIGHT * 0.5
    bracer_actual_center = (bracer_bottom + elbow_z) / 2

    bracer = create_capsule(
        "Spyke_Bracer_Left",
        0.034, elbow_z - bracer_bottom,
        (l_shoulder_x, 0, bracer_actual_center),
        materials["bracer_red"],
    )
    parts.append(bracer)

    # Metallic ridge details on bracer
    for i, frac in enumerate([0.25, 0.5, 0.75]):
        ridge_z = bracer_bottom + (elbow_z - bracer_bottom) * frac
        ridge = create_box(
            f"Spyke_Bracer_Ridge_{i}",
            (0.036, 0.036, 0.004),
            (l_shoulder_x, 0, ridge_z),
            materials["bracer_metal"],
        )
        parts.append(ridge)

    return parts


def build_knee_pauldron(materials):
    """
    Asymmetric knee equipment:
    - Character's LEFT knee (viewer-right): large hexagonal metal knee pauldron
    - Character's RIGHT knee (viewer-left): bare
    """
    # Character's LEFT knee = negative X side
    knee_z = y("knee_y")
    hip_x = -PROPORTIONS["hip_width"] * TOTAL_HEIGHT * 0.8

    pauldron = create_hexagon(
        "Spyke_Knee_Pauldron_Left",
        radius=0.06,      # Bigger than the knee itself
        depth=0.025,
        location=(hip_x, 0.04, knee_z),
        material=materials["knee_pad_metal"],
        rotation=(math.pi / 2, 0, 0),
    )
    return [pauldron]


def build_broadsword(materials):
    """
    Massive plasma broadsword in enormous sheath on back.
    Blade is half body height, wide broadsword width.
    Sits diagonally — hilt over RIGHT shoulder, tip toward lower LEFT.
    """
    parts = []

    # Sheath dimensions
    sheath_length = TOTAL_HEIGHT * 0.55  # Half body height + handle
    sheath_width = 0.08                   # Wide enough for broadsword
    sheath_depth = 0.035

    # Position: diagonal on back, hilt over right shoulder
    # Center of sheath roughly at mid-back
    back_y = -0.12  # Behind the body
    center_z = y("shoulder_y") - sheath_length * 0.35

    # Rotation: tilted so hilt is upper-right, tip is lower-left
    tilt_angle = math.radians(25)  # Diagonal tilt

    # --- SHEATH ---
    sheath = create_box(
        "Spyke_Broadsword_Sheath",
        (sheath_width, sheath_depth, sheath_length / 2),
        (0.05, back_y, center_z),
        materials["sheath_grey"],
        rotation=(0, tilt_angle, 0),
    )
    parts.append(sheath)

    # --- HILT (sticks up over right shoulder) ---
    hilt_z = center_z + sheath_length * 0.5
    hilt_x = 0.05 + math.sin(tilt_angle) * sheath_length * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.018,
        depth=0.12,
        location=(hilt_x, back_y + 0.01, hilt_z),
        rotation=(0, tilt_angle, 0),
    )
    hilt = bpy.context.active_object
    hilt.name = "Spyke_Broadsword_Hilt"
    assign_material(hilt, materials["harness_brown"])
    parts.append(hilt)

    # Cross-guard
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(hilt_x - 0.02, back_y + 0.01, hilt_z - 0.06),
    )
    guard = bpy.context.active_object
    guard.name = "Spyke_Broadsword_Guard"
    guard.scale = (0.05, 0.015, 0.008)
    bpy.ops.object.transform_apply(scale=True)
    guard.rotation_euler = (0, tilt_angle, 0)
    assign_material(guard, materials["sword_grey"])
    parts.append(guard)

    return parts


def build_harness(materials):
    """
    Thick brown leather X-harness over the cloak.
    Main strap: right shoulder → diagonal across chest to left waist → back up
    Secondary strap: horizontal stabilizer from sheath to right waist.
    Built with curve objects for clean straps.
    """
    parts = []
    strap_mat = materials["harness_brown"]
    strap_width = 0.02
    strap_depth = 0.008

    shoulder_z = y("shoulder_y")
    waist_z = y("waist_y")
    r_shoulder_x = PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT * 0.7
    l_waist_x = -PROPORTIONS["waist_width"] * TOTAL_HEIGHT * 0.8

    # Main diagonal strap — front: right shoulder to left waist
    # Approximated with an angled box
    strap_center_x = (r_shoulder_x + l_waist_x) / 2
    strap_center_z = (shoulder_z + waist_z) / 2
    dx = l_waist_x - r_shoulder_x
    dz = waist_z - shoulder_z
    strap_len = math.sqrt(dx**2 + dz**2)
    strap_angle = math.atan2(dx, dz)

    front_strap = create_box(
        "Spyke_Harness_Front_Diagonal",
        (strap_width, strap_depth, strap_len / 2),
        (strap_center_x, 0.11, strap_center_z),
        strap_mat,
        rotation=(0, 0, strap_angle),
    )
    parts.append(front_strap)

    # Cross strap — front: left shoulder to right waist
    l_shoulder_x = -PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT * 0.7
    r_waist_x = PROPORTIONS["waist_width"] * TOTAL_HEIGHT * 0.8
    strap_center_x2 = (l_shoulder_x + r_waist_x) / 2
    dx2 = r_waist_x - l_shoulder_x
    strap_angle2 = math.atan2(dx2, dz)

    cross_strap = create_box(
        "Spyke_Harness_Front_Cross",
        (strap_width, strap_depth, strap_len / 2),
        (strap_center_x2, 0.11, strap_center_z),
        strap_mat,
        rotation=(0, 0, strap_angle2),
    )
    parts.append(cross_strap)

    # Back straps (mirrored X pattern on back)
    back_strap1 = create_box(
        "Spyke_Harness_Back_Diagonal",
        (strap_width, strap_depth, strap_len / 2),
        (strap_center_x, -0.11, strap_center_z),
        strap_mat,
        rotation=(0, 0, strap_angle),
    )
    parts.append(back_strap1)

    back_strap2 = create_box(
        "Spyke_Harness_Back_Cross",
        (strap_width, strap_depth, strap_len / 2),
        (strap_center_x2, -0.11, strap_center_z),
        strap_mat,
        rotation=(0, 0, strap_angle2),
    )
    parts.append(back_strap2)

    # Secondary horizontal support strap (stabilizes sheath)
    horiz_strap = create_box(
        "Spyke_Harness_Horizontal",
        (0.15, strap_depth, strap_width / 2),
        (0.05, -0.10, waist_z + 0.04),
        strap_mat,
    )
    parts.append(horiz_strap)

    return parts


def build_katana(materials):
    """
    Master's patterned katana on LEFT hip (viewer-right in front view).
    Sheathed horizontally on belt.
    """
    parts = []
    waist_z = y("waist_y")
    hip_x = -PROPORTIONS["hip_width"] * TOTAL_HEIGHT - 0.06

    # Katana sheath
    sheath = create_box(
        "Spyke_Katana_Sheath",
        (0.015, 0.015, 0.30),
        (hip_x, 0.02, waist_z - 0.02),
        materials["katana_sheath"],
        rotation=(0, math.radians(8), math.radians(-10)),
    )
    parts.append(sheath)

    # Katana handle (tsuka)
    handle = create_box(
        "Spyke_Katana_Handle",
        (0.012, 0.012, 0.08),
        (hip_x + 0.14, 0.02, waist_z - 0.005),
        materials["harness_brown"],
        rotation=(0, math.radians(8), math.radians(-10)),
    )
    parts.append(handle)

    # Tsuba (guard)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.018, depth=0.005,
        location=(hip_x + 0.10, 0.02, waist_z - 0.01),
    )
    tsuba = bpy.context.active_object
    tsuba.name = "Spyke_Katana_Tsuba"
    assign_material(tsuba, materials["sword_grey"])
    parts.append(tsuba)

    return parts


# ===========================================================================
# ARMATURE / RIG
# ===========================================================================

def build_armature():
    """
    Create a full humanoid armature for posing Spyke.
    Bone positions match the body blockout proportions.
    """
    bpy.ops.object.armature_add(location=(0, 0, 0))
    armature_obj = bpy.context.active_object
    armature_obj.name = "Spyke_Armature"
    armature = armature_obj.data
    armature.name = "Spyke_Rig"

    bpy.ops.object.mode_set(mode='EDIT')
    edit_bones = armature.edit_bones

    # Remove default bone
    for bone in edit_bones:
        edit_bones.remove(bone)

    # Helper to add a bone
    def add_bone(name, head, tail, parent_name=None, connect=False):
        bone = edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        if parent_name and parent_name in edit_bones:
            bone.parent = edit_bones[parent_name]
            bone.use_connect = connect
        return bone

    # --- SPINE ---
    add_bone("Root", (0, 0, y("hip_y")), (0, 0, y("hip_y") + 0.05))
    add_bone("Spine", (0, 0, y("hip_y")), (0, 0, y("waist_y")), "Root", connect=True)
    add_bone("Spine.001", (0, 0, y("waist_y")), (0, 0, y("chest_y")), "Spine", connect=True)
    add_bone("Chest", (0, 0, y("chest_y")), (0, 0, y("shoulder_y")), "Spine.001", connect=True)
    add_bone("Neck", (0, 0, y("neck_y")), (0, 0, y("chin_y")), "Chest")
    add_bone("Head", (0, 0, y("chin_y")), (0, 0, y("head_top_y")), "Neck", connect=True)

    # --- ARMS ---
    for side_name, sign in [("R", 1), ("L", -1)]:
        sx = sign * PROPORTIONS["shoulder_width"] * TOTAL_HEIGHT
        sz = y("shoulder_y")
        elbow_z = sz - ARM["upper_len"] * TOTAL_HEIGHT
        wrist_z = elbow_z - ARM["forearm_len"] * TOTAL_HEIGHT
        hand_z = wrist_z - ARM["hand_len"] * TOTAL_HEIGHT

        add_bone(f"Shoulder.{side_name}",
                 (sign * 0.05, 0, y("shoulder_y") - 0.01),
                 (sx, 0, sz), "Chest")
        add_bone(f"UpperArm.{side_name}",
                 (sx, 0, sz),
                 (sx, 0, elbow_z),
                 f"Shoulder.{side_name}", connect=True)
        add_bone(f"Forearm.{side_name}",
                 (sx, 0, elbow_z),
                 (sx, 0, wrist_z),
                 f"UpperArm.{side_name}", connect=True)
        add_bone(f"Hand.{side_name}",
                 (sx, 0, wrist_z),
                 (sx, 0, hand_z),
                 f"Forearm.{side_name}", connect=True)

    # --- LEGS ---
    for side_name, sign in [("R", 1), ("L", -1)]:
        hx = sign * PROPORTIONS["hip_width"] * TOTAL_HEIGHT * 0.8
        hip_z = y("hip_y")
        knee_z = y("knee_y")
        ankle_z = y("ankle_y")
        foot_z = y("foot_height") * 0.3

        add_bone(f"Thigh.{side_name}",
                 (hx, 0, hip_z),
                 (hx, 0, knee_z), "Root")
        add_bone(f"Shin.{side_name}",
                 (hx, 0, knee_z),
                 (hx, 0, ankle_z),
                 f"Thigh.{side_name}", connect=True)
        add_bone(f"Foot.{side_name}",
                 (hx, 0, ankle_z),
                 (hx, 0.08, foot_z),
                 f"Shin.{side_name}", connect=True)

    bpy.ops.object.mode_set(mode='OBJECT')
    return armature_obj


# ===========================================================================
# COLLECTIONS — Organize scene hierarchy
# ===========================================================================

def organize_collections(all_parts, armature):
    """Put everything in organized collections."""
    scene_col = bpy.context.scene.collection

    # Create collections
    col_names = {
        "Spyke_Body": [],
        "Spyke_Hair": [],
        "Spyke_Clothing": [],
        "Spyke_Equipment": [],
        "Spyke_Rig": [],
    }

    for name in col_names:
        col = bpy.data.collections.new(name)
        scene_col.children.link(col)

    # Categorize objects
    for obj in all_parts:
        n = obj.name
        # Unlink from scene collection first
        if obj.name in scene_col.objects:
            scene_col.objects.unlink(obj)

        if "Hair" in n or "Bandana" in n:
            bpy.data.collections["Spyke_Hair"].objects.link(obj)
        elif "Cloak" in n or "Belt" in n:
            bpy.data.collections["Spyke_Clothing"].objects.link(obj)
        elif any(k in n for k in ["Bracer", "Glove", "Knee", "Broadsword",
                                   "Harness", "Katana"]):
            bpy.data.collections["Spyke_Equipment"].objects.link(obj)
        else:
            bpy.data.collections["Spyke_Body"].objects.link(obj)

    # Armature
    if armature.name in scene_col.objects:
        scene_col.objects.unlink(armature)
    bpy.data.collections["Spyke_Rig"].objects.link(armature)


def parent_to_armature(all_parts, armature):
    """Parent all mesh objects to the armature (keep transform)."""
    for obj in all_parts:
        obj.parent = armature
        obj.matrix_parent_inverse = armature.matrix_world.inverted()


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    print("=" * 60)
    print("  GENERATING: Spyke Tinwall — 3D Character Blockout")
    print("=" * 60)

    clear_scene()

    # Create all materials
    print("[1/8] Creating materials...")
    materials = {}
    for name, color in COLORS.items():
        materials[name] = create_material(f"Spyke_{name}", color)

    # Build body
    print("[2/8] Building body blockout...")
    body_parts = build_body(materials)

    # Build hair + bandana
    print("[3/8] Building hair and bandana...")
    hair_parts = build_hair(materials)

    # Build cloak
    print("[4/8] Building cloak...")
    cloak_parts = build_cloak(materials)

    # Build belt
    print("[5/8] Building belt and equipment...")
    belt_parts = build_belt(materials)

    # Build arm equipment (asymmetric)
    arm_equip = build_arm_equipment(materials)

    # Build knee pauldron (asymmetric)
    knee_parts = build_knee_pauldron(materials)

    # Build broadsword + sheath
    print("[6/8] Building broadsword and harness...")
    sword_parts = build_broadsword(materials)
    harness_parts = build_harness(materials)

    # Build katana
    katana_parts = build_katana(materials)

    # Gather all parts
    all_parts = (body_parts + hair_parts + cloak_parts + belt_parts +
                 arm_equip + knee_parts + sword_parts + harness_parts +
                 katana_parts)

    # Build armature
    print("[7/8] Building armature/rig...")
    armature = build_armature()

    # Parent everything to armature
    parent_to_armature(all_parts, armature)

    # Organize into collections
    print("[8/8] Organizing scene...")
    organize_collections(all_parts, armature)

    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')

    # Frame all in viewport
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    print("")
    print("  DONE — Spyke Tinwall blockout generated!")
    print(f"  Total objects: {len(all_parts)} + armature")
    print(f"  Total materials: {len(COLORS)}")
    print("")
    print("  Collections:")
    print("    Spyke_Body      — Base body mesh parts")
    print("    Spyke_Hair      — Hair volumes + bandana")
    print("    Spyke_Clothing  — Cloak, belt")
    print("    Spyke_Equipment — Weapons, bracer, glove, knee pad, harness")
    print("    Spyke_Rig       — Armature for posing")
    print("")
    print("  Next steps:")
    print("    1. Run manga_shader.py to apply toon shading")
    print("    2. Run render_setup.py to configure camera + lighting")
    print("    3. Sculpt/refine blockout meshes into final character")
    print("    4. Weight paint meshes to armature bones")
    print("    5. Use render_poses.py to batch-render consistent images")
    print("=" * 60)


if __name__ == "__main__":
    main()
