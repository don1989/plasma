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
    print("=" * 60 + "\n")

    # Step 1: Generate character
    print(">>> STEP 1: Generating character blockout...\n")
    generate_spyke.main()

    # Step 2: Apply toon shaders
    print("\n>>> STEP 2: Applying manga toon shaders...\n")
    manga_shader.main()

    # Step 3: Set up render pipeline
    print("\n>>> STEP 3: Setting up render pipeline...\n")
    render_setup.main()

    # Step 4: Save .blend file
    output_dir = os.path.join(SCRIPT_DIR, "output", "spyke")
    os.makedirs(output_dir, exist_ok=True)
    blend_path = os.path.join(output_dir, "spyke.blend")

    print(f"\n>>> STEP 4: Saving to {blend_path}...")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    print("\n" + "=" * 60)
    print("  BUILD COMPLETE")
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
