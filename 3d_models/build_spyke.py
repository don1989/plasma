"""
Master Build Script — Generate Spyke + Apply Shaders + Setup Render
====================================================================
One-shot script that runs the full pipeline:
  1. Generate Spyke's 3D blockout model
  2. Apply manga toon shaders
  3. Set up cameras, lighting, and freestyle outlines
  4. Save the .blend file

Usage (headless):
  blender --background --python 3d_models/build_spyke.py

Usage (with UI — opens Blender with the model ready):
  blender --python 3d_models/build_spyke.py

After running, use render_poses.py to batch-render:
  blender 3d_models/output/spyke/spyke.blend --background --python 3d_models/render/render_poses.py -- --all
"""

import bpy
import os
import sys
import time
import traceback

# Add script directories to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "characters", "spyke"))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "common"))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "render"))

# Import pipeline modules
import generate_spyke
import manga_shader
import render_setup


def main():
    print("\n" + "=" * 60)
    print("  PLASMA 3D PIPELINE — Full Build: Spyke Tinwall")
    print("=" * 60)

    # Blender version check
    version = bpy.app.version_string
    print(f"\n  Blender version: {version}")
    if not version.startswith("5."):
        print(f"  WARNING: Expected Blender 5.x but found {version}")

    print()

    # Pipeline steps
    steps = [
        ("Generating character blockout", generate_spyke.main),
        ("Applying manga toon shaders", manga_shader.main),
        ("Setting up render pipeline", render_setup.main),
    ]

    total_start = time.time()

    for step_name, step_fn in steps:
        print(f"\n>>> {step_name}...")
        t0 = time.time()
        try:
            step_fn()
        except Exception as e:
            print(f"\nFATAL: '{step_name}' failed: {e}")
            traceback.print_exc()
            sys.exit(1)
        elapsed = time.time() - t0
        print(f"<<< {step_name} complete ({elapsed:.1f}s)")

    # Save step (also wrapped in fail-fast)
    output_dir = os.path.join(SCRIPT_DIR, "output", "spyke")
    os.makedirs(output_dir, exist_ok=True)
    blend_path = os.path.join(output_dir, "spyke.blend")

    step_name = "Saving .blend file"
    print(f"\n>>> {step_name}...")
    t0 = time.time()
    try:
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    except Exception as e:
        print(f"\nFATAL: '{step_name}' failed: {e}")
        traceback.print_exc()
        sys.exit(1)
    elapsed = time.time() - t0
    print(f"<<< {step_name} complete ({elapsed:.1f}s)")

    total_elapsed = time.time() - total_start

    print("\n" + "=" * 60)
    print("  BUILD COMPLETE")
    print(f"  Total time: {total_elapsed:.1f}s")
    print("=" * 60)
    print(f"""
  Saved: {blend_path}

  To render reference sheet:
    blender {blend_path} --background --python {os.path.join(SCRIPT_DIR, 'render', 'render_poses.py')}

  To render all poses:
    blender {blend_path} --background --python {os.path.join(SCRIPT_DIR, 'render', 'render_poses.py')} -- --all

  To open and refine in Blender:
    blender {blend_path}

  Workflow:
    1. Open in Blender, sculpt/refine blockout meshes
    2. Weight paint meshes to armature bones
    3. Use render_poses.py to export consistent manga panels
    4. Feed renders into pipeline/ for Webtoon assembly
""")


if __name__ == "__main__":
    main()
