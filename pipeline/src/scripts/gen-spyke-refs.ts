/**
 * Generate Spyke Tinwall reference images without his sword.
 * Uses the existing fal.ai Kling client with the character sheet as reference.
 *
 * Usage: npx tsx pipeline/src/scripts/gen-spyke-refs.ts
 */

import path from 'node:path';
import { configureFal, generatePanelWithReference, downloadAndSave } from '../generation/kling-client.js';
import { loadEnvFile } from '../utils/env.js';
import { PATHS } from '../config/paths.js';

// Load .env manually (no dotenv dependency)
const env = loadEnvFile(path.join(PATHS.pipelineRoot, '.env'));
process.env['FAL_KEY'] = env['FAL_KEY'];

const REPO_ROOT = path.resolve(PATHS.pipelineRoot, '..');
const SPYKE_REF = path.join(REPO_ROOT, '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png');
const OUTPUT_DIR = path.join(REPO_ROOT, '03_manga/concept/characters/spyke_tinwall/references');

// Bible-accurate descriptions
const FACE = 'a 21-year-old male anime character with spiky ginger hair reaching his traps, green eyes, wearing a red bandana headband';
const OUTFIT = 'wearing a white knee-length sleeveless cloak with a decorative pattern along the bottom hem and a dojo emblem on the back, open at the front, over a black short-sleeved t-shirt with red trim and red accent markings. His left arm has a red fingerless glove and a red bracer on the forearm. His right hand has an armoured full-fingered dark glove with no bracer, just the glove. Red-accented belt, black pants, a single silver metal knee pauldron on his left knee only, bare right knee with no armor, tall dark grey boots. No shoulder strap, no cross-body strap, no sword on his back';

const PROMPTS = [
  {
    label: 'front_standing_v6',
    prompt:
      `A full-body front view of @Image1, ${FACE}, ${OUTFIT}. He is standing in a relaxed neutral pose with his arms at his sides. Clean white background, character reference sheet style, anime art style.`,
  },
  {
    label: 'three_quarter_v3',
    prompt:
      `A full-body 3/4 angle view of @Image1, ${FACE}, ${OUTFIT}. The white cloak flows slightly to the side. Arms relaxed at his sides, no weapons. Clean white background, character reference sheet, anime art style.`,
  },
  {
    label: 'side_profile_v3',
    prompt:
      `A full-body side profile view of @Image1, ${FACE}, ${OUTFIT}. The white cloak drapes down his back. Standing straight, arms at sides, no weapons. Clean white background, character reference sheet, anime art style.`,
  },
  {
    label: 'back_view_v2',
    prompt:
      `A full-body back view of @Image1, ${FACE}, ${OUTFIT}. Seen from directly behind, the white cloak is fully visible covering his back with a dojo emblem and a decorative pattern along the bottom hem. His ginger hair flows over the cloak. Standing straight, no weapons. Clean white background, character reference sheet, anime art style.`,
  },
  {
    label: 'katana_draw_stance',
    prompt:
      `A full-body 3/4 view of @Image1, ${FACE} with bright green irises, ${OUTFIT}. He wears the same white knee-length sleeveless cloak with a decorative pattern along the bottom hem. He stands in an iaido battojutsu ready stance, knees slightly bent, body low. A sheathed patterned katana hangs at his left hip. His left hand grips the scabbard, his right hand hovers over the katana handle, about to draw. The blade is completely sheathed, not drawn. Calm determined expression with green eyes. Clean white background, character reference sheet style, anime art style.`,
  },
  {
    label: 'plasma_blade_active',
    prompt:
      `A full-body front view of @Image1, ${FACE} with bright green irises, ${OUTFIT}. He wears the same white knee-length sleeveless cloak with a decorative pattern along the bottom hem. He holds a small metal hilt in his right hand. From the hilt, a glowing energy blade is projected like a lightsaber, bright blue-white plasma energy forming a broadsword-shaped blade of light. The blade glows intensely. Confident battle stance. Clean white background, anime art style.`,
  },
];

async function main() {
  configureFal();

  console.log(`Reference image: ${SPYKE_REF}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Generating ${PROMPTS.length} reference images...\n`);

  for (const { label, prompt } of PROMPTS) {
    console.log(`Generating: ${label}...`);
    try {
      const result = await generatePanelWithReference({
        prompt,
        referenceImage: SPYKE_REF,
        aspectRatio: '3:4',
        count: 1,
      });

      if (result.imageUrls.length > 0) {
        const outputPath = path.join(OUTPUT_DIR, `spyke_${label}.png`);
        await downloadAndSave(result.imageUrls[0]!, outputPath);
        console.log(`  Saved: ${outputPath}`);
      } else {
        console.log(`  No images returned for ${label}`);
      }
    } catch (err) {
      const e = err as any;
      console.error(`  Failed: ${e.message}`);
      if (e.body) console.error(`  Body: ${JSON.stringify(e.body)}`);
      if (e.status) console.error(`  Status: ${e.status}`);
    }
  }

  console.log('\nDone!');
}

main();
