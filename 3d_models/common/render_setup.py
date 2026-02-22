"""
Manga Render Setup — Camera, Lighting, and Freestyle Outlines
==============================================================
Run after generate_spyke.py and manga_shader.py to set up the
complete render pipeline for consistent manga-style output.

Sets up:
  - Key light + fill light (2-light manga setup)
  - Camera at standard distances for full-body and portrait shots
  - Freestyle line rendering for clean manga outlines
  - Render resolution matching Webtoon format (800px wide)

Usage:
  blender spyke.blend --background --python render_setup.py
"""

import bpy
import math
from mathutils import Vector


# ---------------------------------------------------------------------------
# RENDER CONFIG
# ---------------------------------------------------------------------------

# Webtoon output format
RENDER_WIDTH = 800
RENDER_HEIGHT = 1200   # Tall format for full-body shots
RENDER_SAMPLES = 64    # EEVEE samples (fast)

# Camera distances
CAMERA_FULL_BODY_DISTANCE = 3.5    # Full body shot
CAMERA_UPPER_BODY_DISTANCE = 2.0   # Upper body / waist-up
CAMERA_PORTRAIT_DISTANCE = 1.2     # Head and shoulders

# Character center height (roughly chest level)
CHARACTER_CENTER_Z = 1.0

# Freestyle outline settings
OUTLINE_THICKNESS = 2.0       # Line width in pixels
OUTLINE_COLOR = (0.0, 0.0, 0.0)  # Black outlines
CREASE_ANGLE = 134            # Degrees — detect sharp edges for outlines

# Background
BG_COLOR = (1.0, 1.0, 1.0, 1.0)  # White background (manga standard)


# ===========================================================================
# LIGHTING
# ===========================================================================

def setup_lighting():
    """
    Set up 2-light manga lighting.
    - Key light: Strong directional from upper-right-front
    - Fill light: Soft from left to reduce harsh shadows
    """
    # Remove existing lights
    for obj in bpy.data.objects:
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj, do_unlink=True)

    # --- KEY LIGHT ---
    bpy.ops.object.light_add(
        type='SUN',
        location=(3, 2, 5),
    )
    key_light = bpy.context.active_object
    key_light.name = "Manga_Key_Light"
    key_light.data.energy = 3.0
    key_light.data.angle = math.radians(15)  # Slightly soft edge
    # Aim at character center
    direction = Vector((0, 0, CHARACTER_CENTER_Z)) - key_light.location
    key_light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    # --- FILL LIGHT ---
    bpy.ops.object.light_add(
        type='SUN',
        location=(-3, 1, 3),
    )
    fill_light = bpy.context.active_object
    fill_light.name = "Manga_Fill_Light"
    fill_light.data.energy = 0.8
    fill_light.data.angle = math.radians(45)  # Very soft
    direction = Vector((0, 0, CHARACTER_CENTER_Z)) - fill_light.location
    fill_light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    print("  Lighting: Key (sun, 3.0) + Fill (sun, 0.8)")
    return key_light, fill_light


# ===========================================================================
# CAMERAS
# ===========================================================================

def create_camera(name, distance, height_offset=0, angle_deg=0):
    """
    Create a camera aimed at the character.

    Args:
        name: Camera object name
        distance: Distance from character center
        height_offset: Vertical offset from character center
        angle_deg: Horizontal rotation around character (0 = front)
    """
    angle_rad = math.radians(angle_deg)
    x = math.sin(angle_rad) * distance
    y_pos = -math.cos(angle_rad) * distance  # Negative Y = in front
    z = CHARACTER_CENTER_Z + height_offset

    bpy.ops.object.camera_add(location=(x, y_pos, z))
    cam = bpy.context.active_object
    cam.name = name

    # Aim at character center
    direction = Vector((0, 0, CHARACTER_CENTER_Z)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    # Lens settings
    cam.data.lens = 85  # Portrait lens — minimal distortion
    cam.data.clip_start = 0.1
    cam.data.clip_end = 100

    return cam


def setup_cameras():
    """Create the standard camera set for character reference sheets."""
    # Remove existing cameras
    for obj in bpy.data.objects:
        if obj.type == 'CAMERA':
            bpy.data.objects.remove(obj, do_unlink=True)

    cameras = {}

    # Front view (0°)
    cameras["front"] = create_camera(
        "Cam_Front", CAMERA_FULL_BODY_DISTANCE, height_offset=0, angle_deg=0
    )

    # 3/4 angle view (45°)
    cameras["three_quarter"] = create_camera(
        "Cam_ThreeQuarter", CAMERA_FULL_BODY_DISTANCE, height_offset=0, angle_deg=45
    )

    # Side profile (90°)
    cameras["side"] = create_camera(
        "Cam_Side", CAMERA_FULL_BODY_DISTANCE, height_offset=0, angle_deg=90
    )

    # Back view (180°)
    cameras["back"] = create_camera(
        "Cam_Back", CAMERA_FULL_BODY_DISTANCE, height_offset=0, angle_deg=180
    )

    # Portrait / close-up (front)
    cameras["portrait"] = create_camera(
        "Cam_Portrait", CAMERA_PORTRAIT_DISTANCE, height_offset=0.5, angle_deg=0
    )

    # Upper body (front)
    cameras["upper_body"] = create_camera(
        "Cam_UpperBody", CAMERA_UPPER_BODY_DISTANCE, height_offset=0.2, angle_deg=0
    )

    # Set front camera as active
    bpy.context.scene.camera = cameras["front"]

    print(f"  Cameras: {len(cameras)} created (front, 3/4, side, back, portrait, upper_body)")
    return cameras


# ===========================================================================
# FREESTYLE OUTLINES
# ===========================================================================

def setup_freestyle():
    """
    Configure Freestyle line rendering for manga outlines.
    Freestyle draws clean vector-quality outlines over the 3D render.
    """
    scene = bpy.context.scene
    view_layer = bpy.context.view_layer

    # Enable Freestyle
    view_layer.use_freestyle = True

    # Configure Freestyle settings
    freestyle = view_layer.freestyle_settings
    freestyle.crease_angle = math.radians(CREASE_ANGLE)

    # Clear existing linesets
    while len(freestyle.linesets) > 0:
        freestyle.linesets.remove(freestyle.linesets[0])

    # --- MAIN OUTLINE LINESET ---
    lineset = freestyle.linesets.new("Manga_Outlines")
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_crease = True
    lineset.select_edge_mark = False
    lineset.select_external_contour = True
    lineset.select_material_boundary = True
    lineset.select_suggestive_contour = False
    lineset.select_ridge_valley = False

    # Line style
    style = lineset.linestyle
    style.name = "Manga_Line_Style"
    style.color = OUTLINE_COLOR
    style.thickness = OUTLINE_THICKNESS
    style.caps = 'ROUND'

    # Thickness modifiers — thicker outlines for outer silhouette
    # Add a "Along Stroke" modifier for slight thickness variation
    mod = style.thickness_modifiers.new("Taper", 'ALONG_STROKE')
    mod.blend = 'MULTIPLY'
    mod.influence = 0.3
    # Make lines slightly thinner at tips
    mod.mapping = 'CURVE'

    print(f"  Freestyle: enabled, thickness={OUTLINE_THICKNESS}px, crease={CREASE_ANGLE}°")


# ===========================================================================
# RENDER SETTINGS
# ===========================================================================

def setup_render_settings():
    """Configure render output for manga production."""
    scene = bpy.context.scene
    render = scene.render

    # Resolution
    render.resolution_x = RENDER_WIDTH
    render.resolution_y = RENDER_HEIGHT
    render.resolution_percentage = 100

    # Output format
    render.image_settings.file_format = 'PNG'
    render.image_settings.color_mode = 'RGBA'
    render.image_settings.compression = 15

    # Film / background
    render.film_transparent = True  # Transparent background for compositing

    # EEVEE samples
    scene.eevee.taa_render_samples = RENDER_SAMPLES

    # World background (white for preview, transparent for final)
    world = bpy.data.worlds.get("World")
    if not world:
        world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = BG_COLOR
        bg_node.inputs['Strength'].default_value = 1.0

    print(f"  Render: {RENDER_WIDTH}x{RENDER_HEIGHT}, PNG RGBA, {RENDER_SAMPLES} samples")
    print(f"  Background: transparent (white world for preview)")


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    print("=" * 50)
    print("  SETTING UP MANGA RENDER PIPELINE")
    print("=" * 50)

    setup_lighting()
    setup_cameras()
    setup_freestyle()
    setup_render_settings()

    print("\n  Render pipeline ready!")
    print("  Active camera: Cam_Front")
    print("  Cameras available: Front, ThreeQuarter, Side, Back, Portrait, UpperBody")
    print("  Use render_poses.py for batch rendering")
    print("=" * 50)


if __name__ == "__main__":
    main()
