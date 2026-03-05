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

// Base outfit description used in every prompt for consistency
const OUTFIT = 'wearing a long white cloak draped over his shoulders, a black sleeveless top with red trim underneath, red fingerless gloves, black pants, silver knee guards, and tall black boots';
const FACE = 'a 21-year-old male anime character with long red hair, red headband, green glowing eyes with dark sclera';

const PROMPTS = [
  {
    label: 'front_standing_v2',
    prompt:
      `A full-body front view of @Image1, ${FACE}, ${OUTFIT}. He is standing in a relaxed neutral pose with his arms at his sides, no weapons, no sword. Clean white background, character reference sheet style, anime art style.`,
  },
  {
    label: 'three_quarter_v2',
    prompt:
      `A full-body 3/4 angle view of @Image1, ${FACE}, ${OUTFIT}. The white cloak flows slightly to the side. Arms relaxed at his sides, no weapons, no sword. Clean white background, character reference sheet, anime art style.`,
  },
  {
    label: 'side_profile_v2',
    prompt:
      `A full-body side profile view of @Image1, ${FACE}, ${OUTFIT}. The white cloak drapes down his back. Standing straight, arms at sides, no weapons, no sword. Clean white background, character reference sheet, anime art style.`,
  },
  {
    label: 'back_view',
    prompt:
      `A full-body back view of @Image1, ${FACE}, ${OUTFIT}. Seen from directly behind, the white cloak is fully visible covering his back with a Greek key pattern along the bottom hem. His long red hair flows over the cloak. Standing straight, no weapons. Clean white background, character reference sheet, anime art style.`,
  },
  {
    label: 'drawing_katana_v6',
    prompt:
      `A full-body 3/4 view of @Image1, a 21-year-old male anime character with long red hair, red headband, bright green eyes, green irises, ${OUTFIT}. He wears the same long sleeveless white cloak with a Greek key pattern along the bottom hem, open at the front, reaching down to his knees. He stands in an iaido ready stance with knees slightly bent. A sheathed katana hangs at his left hip. His left hand holds the sheath, his right hand is reaching for the katana handle, about to grip it and draw. The blade is still fully inside the sheath, not yet drawn. Calm intense expression with bright green eyes. Clean white background, character reference sheet style, anime art style.`,
  },
  {
    label: 'holding_broadsword',
    prompt:
      `A full-body front view of @Image1, ${FACE}, ${OUTFIT}. He is standing confidently holding a large broadsword in one hand, the blade resting against his shoulder. The white cloak drapes around him. Clean white background, anime art style.`,
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
