"""
Batch Render Script — Render Spyke from multiple poses and angles
=================================================================
Run after generate_spyke.py, manga_shader.py, and render_setup.py.

Renders a full character reference sheet (4 views) plus any custom
poses defined in the poses/ directory.

Output goes to: 3d_models/output/spyke/

Usage:
  blender spyke.blend --background --python render_poses.py

  With custom output dir:
  blender spyke.blend --background --python render_poses.py -- --output /path/to/output

  Render specific views only:
  blender spyke.blend --background --python render_poses.py -- --views front,side
"""

import bpy
import os
import sys
import math
from mathutils import Vector, Euler


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# Default output directory (relative to this script)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT = os.path.join(os.path.dirname(SCRIPT_DIR), "output", "spyke")

# Standard reference sheet views
REFERENCE_VIEWS = {
    "front": {
        "camera": "Cam_Front",
        "description": "Front view — facing viewer",
    },
    "three_quarter": {
        "camera": "Cam_ThreeQuarter",
        "description": "3/4 angle — 45 degrees",
    },
    "side": {
        "camera": "Cam_Side",
        "description": "Side profile — 90 degrees",
    },
    "back": {
        "camera": "Cam_Back",
        "description": "Back view — showing broadsword sheath and harness",
    },
    "portrait": {
        "camera": "Cam_Portrait",
        "description": "Close-up portrait — head and shoulders",
    },
    "upper_body": {
        "camera": "Cam_UpperBody",
        "description": "Upper body shot — waist up",
    },
}

# Predefined character poses (bone rotations)
# Each pose is a dict of bone_name → (x_rot, y_rot, z_rot) in degrees
POSES = {
    "neutral": {
        "description": "T-pose / neutral standing — default armature position",
        "bones": {},  # No rotations — default pose
    },
    "standing_relaxed": {
        "description": "Relaxed standing — arms at sides, slight weight shift",
        "bones": {
            "UpperArm.R": (-70, 0, 10),
            "UpperArm.L": (-70, 0, -10),
            "Forearm.R": (-15, 0, 0),
            "Forearm.L": (-15, 0, 0),
            "Thigh.R": (-3, 0, -3),
            "Thigh.L": (3, 0, 3),
            "Spine": (0, 0, 0),
            "Neck": (0, 0, 0),
            "Head": (-5, 0, 0),  # Slight downward gaze — cold expression
        },
    },
    "battle_ready": {
        "description": "Battle stance — weight low, hand near katana",
        "bones": {
            "Spine": (5, 0, -5),
            "Chest": (0, 0, 5),
            "UpperArm.R": (-45, -20, 15),    # Right arm reaching back
            "Forearm.R": (-30, 0, 0),
            "UpperArm.L": (-60, 10, -15),    # Left arm near katana
            "Forearm.L": (-45, 0, 0),
            "Thigh.R": (-15, 0, -8),
            "Shin.R": (20, 0, 0),
            "Thigh.L": (10, 0, 8),
            "Shin.L": (15, 0, 0),
            "Head": (-8, 0, 5),  # Looking forward, cold gaze
        },
    },
    "drawing_katana": {
        "description": "Iaijutsu stance — about to draw the katana",
        "bones": {
            "Spine": (8, 0, -10),
            "Chest": (0, 0, 10),
            "UpperArm.R": (-50, -15, 20),
            "Forearm.R": (-20, 0, 0),
            "UpperArm.L": (-80, 30, -20),   # Left hand gripping katana
            "Forearm.L": (-70, -20, 0),
            "Hand.L": (0, 0, -30),
            "Thigh.R": (-20, 0, -10),
            "Shin.R": (30, 0, 0),
            "Thigh.L": (5, 0, 5),
            "Head": (-5, 0, -5),
        },
    },
    "walking": {
        "description": "Mid-stride walking pose",
        "bones": {
            "Thigh.R": (-25, 0, 0),
            "Shin.R": (15, 0, 0),
            "Thigh.L": (20, 0, 0),
            "Shin.L": (5, 0, 0),
            "UpperArm.R": (-55, 0, 10),
            "Forearm.R": (-10, 0, 0),
            "UpperArm.L": (-80, 0, -10),
            "Forearm.L": (-20, 0, 0),
            "Spine": (2, 0, -3),
            "Head": (-5, 0, 3),
        },
    },
}


# ===========================================================================
# POSING
# ===========================================================================

def reset_armature_pose(armature_obj):
    """Reset all bone rotations to rest pose."""
    if armature_obj.type != 'ARMATURE':
        return

    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode='POSE')

    for bone in armature_obj.pose.bones:
        bone.rotation_euler = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)

    bpy.ops.object.mode_set(mode='OBJECT')


def apply_pose(armature_obj, pose_data):
    """Apply bone rotations from a pose definition."""
    reset_armature_pose(armature_obj)

    if not pose_data.get("bones"):
        return  # Neutral pose — just reset

    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode='POSE')

    for bone_name, rotation in pose_data["bones"].items():
        if bone_name in armature_obj.pose.bones:
            bone = armature_obj.pose.bones[bone_name]
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = Euler((
                math.radians(rotation[0]),
                math.radians(rotation[1]),
                math.radians(rotation[2]),
            ), 'XYZ')

    bpy.ops.object.mode_set(mode='OBJECT')


# ===========================================================================
# RENDERING
# ===========================================================================

def render_view(camera_name, output_path):
    """Render the scene from a specific camera to a file."""
    cam = bpy.data.objects.get(camera_name)
    if not cam:
        print(f"  WARNING: Camera '{camera_name}' not found, skipping")
        return False

    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    return True


def render_reference_sheet(output_dir, views=None, pose_name="neutral"):
    """
    Render a full reference sheet — multiple camera angles of the same pose.

    Args:
        output_dir: Directory to save renders
        views: List of view names to render (None = all)
        pose_name: Which pose to apply
    """
    os.makedirs(output_dir, exist_ok=True)

    # Find armature
    armature = bpy.data.objects.get("Spyke_Armature")
    if not armature:
        print("ERROR: Spyke_Armature not found in scene")
        return

    # Apply pose
    pose_data = POSES.get(pose_name, POSES["neutral"])
    print(f"\n  Pose: {pose_name} — {pose_data['description']}")
    apply_pose(armature, pose_data)

    # Determine which views to render
    if views:
        view_list = {k: v for k, v in REFERENCE_VIEWS.items() if k in views}
    else:
        view_list = REFERENCE_VIEWS

    # Render each view
    rendered = 0
    for view_name, view_config in view_list.items():
        filename = f"spyke_{pose_name}_{view_name}.png"
        filepath = os.path.join(output_dir, filename)

        print(f"  Rendering: {view_name} → {filename}")
        success = render_view(view_config["camera"], filepath)
        if success:
            rendered += 1

    return rendered


def render_all_poses(output_dir, views=None):
    """Render all predefined poses from all camera angles."""
    total = 0
    for pose_name in POSES:
        pose_dir = os.path.join(output_dir, pose_name)
        count = render_reference_sheet(pose_dir, views=views, pose_name=pose_name)
        total += count
    return total


# ===========================================================================
# CLI ARGUMENT PARSING
# ===========================================================================

def parse_args():
    """Parse command-line arguments passed after '--'."""
    args = {
        "output": DEFAULT_OUTPUT,
        "views": None,
        "poses": None,
        "all_poses": False,
    }

    if "--" in sys.argv:
        argv = sys.argv[sys.argv.index("--") + 1:]
        i = 0
        while i < len(argv):
            if argv[i] == "--output" and i + 1 < len(argv):
                args["output"] = argv[i + 1]
                i += 2
            elif argv[i] == "--views" and i + 1 < len(argv):
                args["views"] = argv[i + 1].split(",")
                i += 2
            elif argv[i] == "--poses" and i + 1 < len(argv):
                args["poses"] = argv[i + 1].split(",")
                i += 2
            elif argv[i] == "--all":
                args["all_poses"] = True
                i += 1
            else:
                i += 1

    return args


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    print("=" * 50)
    print("  BATCH RENDER — Spyke Tinwall")
    print("=" * 50)

    args = parse_args()
    output_dir = args["output"]
    os.makedirs(output_dir, exist_ok=True)

    print(f"  Output: {output_dir}")

    if args["all_poses"]:
        total = render_all_poses(output_dir, views=args["views"])
    elif args["poses"]:
        total = 0
        for pose_name in args["poses"]:
            if pose_name in POSES:
                pose_dir = os.path.join(output_dir, pose_name)
                count = render_reference_sheet(pose_dir, views=args["views"],
                                               pose_name=pose_name)
                total += count
            else:
                print(f"  WARNING: Unknown pose '{pose_name}', available: {list(POSES.keys())}")
    else:
        # Default: render reference sheet with neutral pose
        total = render_reference_sheet(output_dir, views=args["views"])

    print(f"\n  Complete — {total} images rendered to {output_dir}")
    print("=" * 50)


if __name__ == "__main__":
    main()
