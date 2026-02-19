/**
 * crop-spyke.ts
 *
 * Crops Spyke reference images into 512x512 letterboxed training images for LoRA dataset.
 *
 * Usage:
 *   tsx pipeline/src/scripts/crop-spyke.ts --dry-run   # Write previews to dataset/spyke/train/10_spyke_plasma_v1/preview/
 *   tsx pipeline/src/scripts/crop-spyke.ts              # Write final crops to dataset/spyke/train/10_spyke_plasma_v1/
 *
 * Run from project root: /Users/dondemetrius/Code/plasma
 *
 * Source image dimensions (verified):
 *   Spyke_Final.png: 2816x1536
 *   ref-sheet-v1.png: 1024x1024
 *   ref-sheet-v2.png: 1024x1024
 *   ref-sheet-v7.png: 1024x1024
 *
 * Crop coordinates are MEDIUM confidence — dry-run output MUST be visually reviewed
 * before generating final dataset images (Plan 02 checkpoint).
 *
 * NOTE: spyke_final_calm is SPECULATIVE. An ~830px gap exists between spyke_final_battle
 * (left:850) and spyke_final_shocked (left:1680). A 5th expression panel ('calm') may
 * exist at x=1260. If the preview shows a blank or duplicate crop, exclude this source
 * during the Plan 02 checkpoint review.
 */

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CropSource {
  id: string;
  src: string;  // repo-relative path from project root
  crop: { left: number; top: number; width: number; height: number };
  flip?: boolean;   // true = this crop is also safe to flip (symmetric subject)
  caption: string;  // caption text for the .txt file (written in Plan 02, documented here)
}

// ---------------------------------------------------------------------------
// CROP_SOURCES — Coordinate table
// All coordinates are MEDIUM confidence. Verify via --dry-run before finalizing.
// ---------------------------------------------------------------------------

const CROP_SOURCES: CropSource[] = [
  // -------------------------------------------------------------------------
  // Spyke_Final.png (2816x1536)
  // Top row: 4 full-body views (poses across width)
  // Bottom row: expression closeups at y=1230
  // -------------------------------------------------------------------------
  {
    id: 'spyke_final_front',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 30, top: 100, width: 640, height: 1120 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, front view, standing neutral, white background',
  },
  {
    id: 'spyke_final_3q',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 720, top: 100, width: 640, height: 1120 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, three quarter angle, standing, white background',
  },
  {
    id: 'spyke_final_side',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 1400, top: 100, width: 640, height: 1120 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, side profile, standing, white background',
  },
  {
    id: 'spyke_final_back',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 2080, top: 100, width: 640, height: 1120 },
    flip: true,
    caption: 'spyke_plasma_v1, full body, back view, white cloak visible, white background',
  },
  {
    id: 'spyke_final_neutral',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 30, top: 1230, width: 380, height: 280 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, neutral expression, white background',
  },
  {
    id: 'spyke_final_angry',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 430, top: 1230, width: 380, height: 280 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, angry expression, white background',
  },
  {
    id: 'spyke_final_battle',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 850, top: 1230, width: 380, height: 280 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, battle focus expression, white background',
  },
  {
    // SPECULATIVE: ~830px gap between battle (left:850) and shocked (left:1680).
    // A 5th expression panel ('calm') may exist at x=1260.
    // Verify via --dry-run preview. Exclude in Plan 02 if no distinct panel present.
    id: 'spyke_final_calm',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 1260, top: 1230, width: 380, height: 280 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, calm expression, white background',
  },
  {
    id: 'spyke_final_shocked',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 1680, top: 1230, width: 380, height: 280 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, shocked expression, white background',
  },

  // -------------------------------------------------------------------------
  // ref-sheet-v1.png (1024x1024) — clean white bg, 4 views across width
  // -------------------------------------------------------------------------
  {
    id: 'v1_front',
    src: 'output/characters/spyke-tinwall/ref-sheet-v1.png',
    crop: { left: 10, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, front view, standing, white background',
  },
  {
    id: 'v1_3q',
    src: 'output/characters/spyke-tinwall/ref-sheet-v1.png',
    crop: { left: 270, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, three quarter angle, standing, white background',
  },
  {
    id: 'v1_side',
    src: 'output/characters/spyke-tinwall/ref-sheet-v1.png',
    crop: { left: 530, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, side profile, standing, white background',
  },
  {
    id: 'v1_back',
    src: 'output/characters/spyke-tinwall/ref-sheet-v1.png',
    // NOTE: left=784 (not 790) — original plan coords exceeded 1024px image width by 6px (790+240=1030).
    // Adjusted left to 784 so right edge = 1024 exactly.
    crop: { left: 784, top: 60, width: 240, height: 900 },
    flip: true,
    caption: 'spyke_plasma_v1, full body, back view, white cloak visible, white background',
  },

  // -------------------------------------------------------------------------
  // ref-sheet-v7.png (1024x1024) — latest, clean
  // -------------------------------------------------------------------------
  {
    id: 'v7_front',
    src: 'output/characters/spyke-tinwall/ref-sheet-v7.png',
    crop: { left: 10, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, front view, standing, white background',
  },
  {
    id: 'v7_3q',
    src: 'output/characters/spyke-tinwall/ref-sheet-v7.png',
    crop: { left: 270, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, three quarter angle, standing, white background',
  },
  {
    id: 'v7_side',
    src: 'output/characters/spyke-tinwall/ref-sheet-v7.png',
    crop: { left: 530, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, side profile, standing, white background',
  },
  {
    id: 'v7_back',
    src: 'output/characters/spyke-tinwall/ref-sheet-v7.png',
    // NOTE: left=784 (not 790) — same bounds fix as v1_back (790+240=1030 > 1024).
    crop: { left: 784, top: 60, width: 240, height: 900 },
    flip: true,
    caption: 'spyke_plasma_v1, full body, back view, white cloak visible, white background',
  },

  // -------------------------------------------------------------------------
  // ref-sheet-v2.png (1024x1024) — secondary clean
  // -------------------------------------------------------------------------
  {
    id: 'v2_front',
    src: 'output/characters/spyke-tinwall/ref-sheet-v2.png',
    crop: { left: 10, top: 60, width: 240, height: 900 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, front view, standing, white background',
  },
  {
    id: 'v2_back',
    src: 'output/characters/spyke-tinwall/ref-sheet-v2.png',
    // NOTE: left=784 (not 790) — same bounds fix as v1_back (790+240=1030 > 1024).
    crop: { left: 784, top: 60, width: 240, height: 900 },
    flip: true,
    caption: 'spyke_plasma_v1, full body, back view, white cloak visible, white background',
  },
];

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

async function processCrop(
  source: CropSource,
  outputPath: string,
): Promise<void> {
  const srcAbsolute = resolve(process.cwd(), source.src);
  await sharp(srcAbsolute)
    .extract(source.crop)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(outputPath);
}

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------

function printSummaryTable(
  results: Array<{ source: CropSource; outputFile: string; status: 'ok' | 'error'; error?: string }>,
  mode: 'dry-run' | 'final',
): void {
  console.log('\n' + '─'.repeat(110));
  console.log(
    'Mode:'.padEnd(10) + mode.toUpperCase(),
  );
  console.log(
    'Output:'.padEnd(10) +
      (mode === 'dry-run'
        ? 'dataset/spyke/train/10_spyke_plasma_v1/preview/'
        : 'dataset/spyke/train/10_spyke_plasma_v1/'),
  );
  console.log('─'.repeat(110));
  console.log(
    'ID'.padEnd(30) +
      'Source File'.padEnd(42) +
      'Output Filename'.padEnd(28) +
      'Flip?'.padEnd(7) +
      'Status',
  );
  console.log('─'.repeat(110));

  let okCount = 0;
  let errCount = 0;

  for (const r of results) {
    const srcFile = r.source.src.split('/').pop() ?? r.source.src;
    const status = r.status === 'ok' ? 'OK' : `ERROR: ${r.error ?? 'unknown'}`;
    const flipEligible = r.source.flip ? 'yes' : 'no';
    console.log(
      r.source.id.padEnd(30) +
        srcFile.padEnd(42) +
        r.outputFile.padEnd(28) +
        flipEligible.padEnd(7) +
        status,
    );
    if (r.status === 'ok') okCount++;
    else errCount++;
  }

  console.log('─'.repeat(110));
  console.log(`Total: ${results.length} crops | OK: ${okCount} | Errors: ${errCount}`);

  if (mode === 'dry-run') {
    console.log('\nNOTE: Coordinates are MEDIUM confidence — visually review all preview images before approving.');
    console.log('NOTE: spyke_final_calm is SPECULATIVE — verify the preview shows a distinct expression panel.');
    console.log('      If blank or duplicate, exclude this crop during the Plan 02 checkpoint review.\n');
  } else {
    console.log('\nFinal crops written. Caption .txt files are generated in Plan 02.\n');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  const mode: 'dry-run' | 'final' = isDryRun ? 'dry-run' : 'final';

  const projectRoot = process.cwd();
  const trainDir = resolve(projectRoot, 'dataset/spyke/train/10_spyke_plasma_v1');
  const previewDir = resolve(trainDir, 'preview');
  const outputDir = isDryRun ? previewDir : trainDir;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  console.log(`\nSpyke crop script — ${mode.toUpperCase()} mode`);
  console.log(`Processing ${CROP_SOURCES.length} crop sources...`);
  console.log(`Output directory: ${outputDir}\n`);

  const results: Array<{
    source: CropSource;
    outputFile: string;
    status: 'ok' | 'error';
    error?: string;
  }> = [];

  for (let i = 0; i < CROP_SOURCES.length; i++) {
    const source = CROP_SOURCES[i];
    const outputFile = isDryRun
      ? `preview_${source.id}.png`
      : `spyke_${String(i + 1).padStart(3, '0')}.png`;
    const outputPath = join(outputDir, outputFile);

    try {
      await processCrop(source, outputPath);
      results.push({ source, outputFile, status: 'ok' });
      process.stdout.write(`  [${String(i + 1).padStart(2)}/${CROP_SOURCES.length}] ${source.id} → ${outputFile}\n`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({ source, outputFile, status: 'error', error: errMsg });
      process.stdout.write(`  [${String(i + 1).padStart(2)}/${CROP_SOURCES.length}] ${source.id} → ERROR: ${errMsg}\n`);
    }
  }

  printSummaryTable(results, mode);

  const errorCount = results.filter(r => r.status === 'error').length;
  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
