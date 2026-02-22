"""
Manga Toon Shader Setup
========================
Run after generate_spyke.py to convert all materials to manga-style
cel-shaded materials with hard shadow edges and flat color bands.

Uses EEVEE's Shader to RGB node for clean toon shading.
Works with Blender 3.x and 4.x.

Usage:
  1. Open the .blend file with Spyke generated
  2. Run this script in Blender's scripting tab
  Or: blender spyke.blend --background --python manga_shader.py
"""

import bpy


# ---------------------------------------------------------------------------
# TOON SHADER CONFIG
# ---------------------------------------------------------------------------

# Number of shading bands (2 = light/shadow, 3 = light/mid/shadow)
SHADE_BANDS = 2

# Shadow darkness (0 = black shadow, 1 = no shadow). Lower = more contrast.
SHADOW_INTENSITY = 0.55

# Highlight threshold on the color ramp (higher = smaller lit area)
HIGHLIGHT_THRESHOLD = 0.45

# Rim light intensity (0 = off). Adds manga-style edge highlighting.
RIM_LIGHT_STRENGTH = 0.3

# Specular highlight for metallic materials
METALLIC_SPEC_STRENGTH = 0.6

# Materials that should have metallic toon shading
METALLIC_MATERIALS = {
    "Spyke_bracer_red", "Spyke_bracer_metal", "Spyke_sword_grey",
    "Spyke_sheath_grey", "Spyke_knee_pad_metal",
}


def convert_to_toon_shader(material, metallic=False):
    """
    Replace a material's node tree with a manga-style toon shader.

    Node graph:
        Principled BSDF → Shader to RGB → ColorRamp (hard steps) → Mix
                                                                      ↓
        Fresnel → ColorRamp (rim) → Mix → Material Output
    """
    if not material.use_nodes:
        material.use_nodes = True

    nodes = material.node_tree.nodes
    links = material.node_tree.links

    # Get the base color from existing Principled BSDF before clearing
    base_color = (0.5, 0.5, 0.5, 1.0)
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            base_color = tuple(node.inputs['Base Color'].default_value)
            break

    # Clear all nodes
    for node in nodes:
        nodes.remove(node)

    # ---- DIFFUSE BSDF (simpler than Principled for toon) ----
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.location = (-400, 200)
    diffuse.inputs['Color'].default_value = base_color
    diffuse.inputs['Roughness'].default_value = 1.0

    # ---- SHADER TO RGB (EEVEE only — converts shading to color data) ----
    shader_to_rgb = nodes.new('ShaderNodeShaderToRGB')
    shader_to_rgb.location = (-200, 200)
    links.new(diffuse.outputs['BSDF'], shader_to_rgb.inputs['Shader'])

    # ---- MAIN COLOR RAMP (hard shadow steps) ----
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.location = (0, 200)
    ramp.color_ramp.interpolation = 'CONSTANT'

    # Remove extra stops, set up 2-band toon
    while len(ramp.color_ramp.elements) > 2:
        ramp.color_ramp.elements.remove(ramp.color_ramp.elements[-1])

    # Shadow color (darker version of base color)
    shadow_r = base_color[0] * SHADOW_INTENSITY
    shadow_g = base_color[1] * SHADOW_INTENSITY
    shadow_b = base_color[2] * SHADOW_INTENSITY

    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (shadow_r, shadow_g, shadow_b, 1.0)
    ramp.color_ramp.elements[1].position = HIGHLIGHT_THRESHOLD
    ramp.color_ramp.elements[1].color = base_color

    links.new(shader_to_rgb.outputs['Color'], ramp.inputs['Fac'])

    # ---- RIM LIGHT (Fresnel-based edge glow) ----
    fresnel = nodes.new('ShaderNodeFresnel')
    fresnel.location = (-200, -100)
    fresnel.inputs['IOR'].default_value = 1.45

    rim_ramp = nodes.new('ShaderNodeValToRGB')
    rim_ramp.location = (0, -100)
    rim_ramp.color_ramp.interpolation = 'CONSTANT'
    rim_ramp.color_ramp.elements[0].position = 0.0
    rim_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    rim_ramp.color_ramp.elements[1].position = 0.7
    rim_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(fresnel.outputs['Fac'], rim_ramp.inputs['Fac'])

    # ---- MIX: base toon + rim light ----
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.location = (250, 100)
    mix.blend_type = 'ADD'
    mix.inputs['Factor'].default_value = RIM_LIGHT_STRENGTH
    links.new(ramp.outputs['Color'], mix.inputs[6])       # A
    links.new(rim_ramp.outputs['Color'], mix.inputs[7])    # B

    # ---- METALLIC SPECULAR (optional) ----
    if metallic:
        # Glossy for specular highlight
        glossy = nodes.new('ShaderNodeBsdfGlossy')
        glossy.location = (-400, -300)
        glossy.inputs['Color'].default_value = (1, 1, 1, 1)
        glossy.inputs['Roughness'].default_value = 0.3

        spec_s2rgb = nodes.new('ShaderNodeShaderToRGB')
        spec_s2rgb.location = (-200, -300)
        links.new(glossy.outputs['BSDF'], spec_s2rgb.inputs['Shader'])

        spec_ramp = nodes.new('ShaderNodeValToRGB')
        spec_ramp.location = (0, -300)
        spec_ramp.color_ramp.interpolation = 'CONSTANT'
        spec_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        spec_ramp.color_ramp.elements[1].position = 0.85
        spec_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        links.new(spec_s2rgb.outputs['Color'], spec_ramp.inputs['Fac'])

        # Add specular to the mix
        spec_mix = nodes.new('ShaderNodeMix')
        spec_mix.data_type = 'RGBA'
        spec_mix.location = (450, 100)
        spec_mix.blend_type = 'ADD'
        spec_mix.inputs['Factor'].default_value = METALLIC_SPEC_STRENGTH
        links.new(mix.outputs[2], spec_mix.inputs[6])
        links.new(spec_ramp.outputs['Color'], spec_mix.inputs[7])

        final_color_output = spec_mix.outputs[2]
    else:
        final_color_output = mix.outputs[2]

    # ---- OUTPUT ----
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (650, 100)

    # Connect through an Emission shader to bypass EEVEE lighting
    # (we already computed lighting via Shader to RGB)
    emission = nodes.new('ShaderNodeEmission')
    emission.location = (450, 200) if not metallic else (650, 200)
    links.new(final_color_output, emission.inputs['Color'])
    emission.inputs['Strength'].default_value = 1.0

    links.new(emission.outputs['Emission'], output.inputs['Surface'])

    return material


def apply_toon_to_all():
    """Convert all Spyke materials to toon shading."""
    converted = 0
    for mat in bpy.data.materials:
        if not mat.name.startswith("Spyke_"):
            continue

        is_metallic = mat.name in METALLIC_MATERIALS
        convert_to_toon_shader(mat, metallic=is_metallic)
        converted += 1
        tag = " [METALLIC]" if is_metallic else ""
        print(f"  Converted: {mat.name}{tag}")

    return converted


def setup_eevee_for_toon():
    """Configure EEVEE render settings optimized for toon shading."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if bpy.app.version >= (4, 0, 0) else 'BLENDER_EEVEE'

    # Shadows
    if hasattr(scene.eevee, 'shadow_cascade_size'):
        scene.eevee.shadow_cascade_size = '2048'
    if hasattr(scene.eevee, 'shadow_cube_size'):
        scene.eevee.shadow_cube_size = '1024'

    # Color management — flat/linear for manga look
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'

    print("  EEVEE configured for toon rendering")


def main():
    print("=" * 50)
    print("  APPLYING MANGA TOON SHADERS")
    print("=" * 50)

    setup_eevee_for_toon()

    count = apply_toon_to_all()

    print(f"\n  Done — {count} materials converted to toon shading")
    print("  Render engine: EEVEE (required for Shader to RGB)")
    print("=" * 50)


if __name__ == "__main__":
    main()
