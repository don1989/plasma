#!/usr/bin/env python3
"""
Validate Blender test render output for manga pipeline quality.
Run with standard Python (not Blender): python3 validate_render.py [image_path]

Checks:
  1. Correct dimensions (800x1200)
  2. Has transparent background (alpha channel)
  3. Has non-transparent content (character rendered)
  4. Has dark outlines (Freestyle)
  5. Has shade bands (toon shading)

Exit code: 0 = all pass, 1 = any fail
"""

import sys
import os

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("ERROR: Pillow and numpy required. Install: pip3 install Pillow numpy")
    sys.exit(1)


# ---------------------------------------------------------------------------
# THRESHOLDS
# ---------------------------------------------------------------------------

EXPECTED_WIDTH = 800
EXPECTED_HEIGHT = 1200
MIN_TRANSPARENT_PERCENT = 10.0   # Background must be >10% transparent
MIN_OPAQUE_PERCENT = 5.0         # Character must cover >5% of image
OUTLINE_BRIGHTNESS_THRESHOLD = 30  # Pixels darker than this = outlines
MIN_OUTLINE_PERCENT = 0.5        # At least 0.5% of opaque pixels are outlines
MIN_SHADE_BAND_STD_DEV = 20.0    # Brightness std dev across opaque pixels


# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------

def validate_render(image_path):
    """
    Validate a render image against 5 quality checks.

    Args:
        image_path: Path to the PNG image file.

    Returns:
        dict of check_name (str) -> passed (bool)
    """
    results = {}

    # Load image
    img = Image.open(image_path)
    arr = np.array(img)

    width, height = img.size
    has_alpha = arr.shape[2] == 4 if len(arr.shape) == 3 else False

    # -----------------------------------------------------------------------
    # Check 1: Dimensions
    # -----------------------------------------------------------------------
    results["dimensions"] = (width == EXPECTED_WIDTH and height == EXPECTED_HEIGHT)

    if not has_alpha:
        # Without alpha channel, checks 2-4 cannot be evaluated properly
        results["transparency"] = False
        results["content"] = False
        results["outlines"] = False
        results["shade_bands"] = False
        return results

    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    total_pixels = alpha.size

    # -----------------------------------------------------------------------
    # Check 2: Transparent background (>10% transparent pixels)
    # -----------------------------------------------------------------------
    transparent_count = np.sum(alpha < 10)
    transparent_percent = 100.0 * transparent_count / total_pixels
    results["transparency"] = (transparent_percent > MIN_TRANSPARENT_PERCENT)

    # -----------------------------------------------------------------------
    # Check 3: Content exists (>5% opaque pixels)
    # -----------------------------------------------------------------------
    opaque_mask = alpha > 245
    opaque_count = np.sum(opaque_mask)
    opaque_percent = 100.0 * opaque_count / total_pixels
    results["content"] = (opaque_percent > MIN_OPAQUE_PERCENT)

    # -----------------------------------------------------------------------
    # Check 4: Freestyle outlines (near-black pixels among opaque)
    # -----------------------------------------------------------------------
    if opaque_count > 0:
        brightness = np.mean(rgb.astype(np.float64), axis=2)
        opaque_brightness = brightness[opaque_mask]

        dark_count = np.sum(opaque_brightness < OUTLINE_BRIGHTNESS_THRESHOLD)
        dark_percent = 100.0 * dark_count / opaque_count
        results["outlines"] = (dark_percent > MIN_OUTLINE_PERCENT)

        # -------------------------------------------------------------------
        # Check 5: Shade bands (brightness std dev > 20)
        # -------------------------------------------------------------------
        std_dev = float(np.std(opaque_brightness))
        results["shade_bands"] = (std_dev > MIN_SHADE_BAND_STD_DEV)
    else:
        results["outlines"] = False
        results["shade_bands"] = False

    return results


def print_results(results, image_path):
    """Print check results in a clear format."""
    print("=" * 56)
    print(f"  RENDER VALIDATION: {os.path.basename(image_path)}")
    print("=" * 56)

    check_names = {
        "dimensions": f"Dimensions ({EXPECTED_WIDTH}x{EXPECTED_HEIGHT})",
        "transparency": f"Transparent background (>{MIN_TRANSPARENT_PERCENT}%)",
        "content": f"Character content (>{MIN_OPAQUE_PERCENT}% opaque)",
        "outlines": f"Freestyle outlines (dark pixels <{OUTLINE_BRIGHTNESS_THRESHOLD})",
        "shade_bands": f"Toon shade bands (std dev >{MIN_SHADE_BAND_STD_DEV})",
    }

    all_pass = True
    for key in ["dimensions", "transparency", "content", "outlines", "shade_bands"]:
        passed = results.get(key, False)
        status = "PASS" if passed else "FAIL"
        label = check_names.get(key, key)
        print(f"  [{status}] {label}")
        if not passed:
            all_pass = False

    print("=" * 56)
    if all_pass:
        print("  RESULT: ALL CHECKS PASSED")
    else:
        failed = [k for k, v in results.items() if not v]
        print(f"  RESULT: {len(failed)} CHECK(S) FAILED: {', '.join(failed)}")
    print("=" * 56)

    return all_pass


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Default image path
    default_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "output", "spyke", "test_render", "spyke_neutral_front.png"
    )

    image_path = sys.argv[1] if len(sys.argv) > 1 else default_path

    if not os.path.exists(image_path):
        print(f"ERROR: Image not found: {image_path}")
        sys.exit(1)

    results = validate_render(image_path)
    all_pass = print_results(results, image_path)

    sys.exit(0 if all_pass else 1)
