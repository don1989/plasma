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
 *   Spyke_Final.png:   2816x1536 — 4 body views (front, 3q, side, back) + expression row at y≈1220
 *   Spyke_Younger.png: 2816x1536 — 4 body views (front neutral, action/combat, side, back), Age: 21
 *
 * Expression row order in Spyke_Final.png (confirmed from dry-run review):
 *   Neutral (Cold) → Angry (Snarling) → Battle-focused → Rare Smirk → Shocked → Inner Pain
 *   → [detail callouts: Red Bandana, Plasma Sword Glow, etc. — do NOT crop these]
 *
 * Crop coordinates are MEDIUM confidence — dry-run output MUST be visually reviewed
 * before generating final dataset images (Plan 02 checkpoint).
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
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
  // Spyke_Final.png (2816x1536) — canonical final design, Age: 21
  // Top row: 4 full-body poses (front, 3q, side, back)
  // Bottom row: expression faces starting at y≈1220
  // Expression order: Neutral → Angry → Battle-focused → Rare Smirk → Shocked → Inner Pain
  //                   → [detail callouts — do NOT crop past Inner Pain]
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
  // Expression row — coordinates verified from preview review (panel map derived from dry-run 2)
  // Panel widths are non-uniform (~220-300px). Each crop starts at panel boundary.
  // Order confirmed: Neutral → Angry → Battle-focused → Rare Smirk → Shocked → Inner Pain
  //                  → [detail callouts: Red Bandana, Plasma Sword Glow — do NOT crop past Inner Pain]
  {
    id: 'spyke_final_neutral',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 10, top: 1220, width: 280, height: 290 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, neutral expression, white background',
  },
  {
    // 2nd expression panel — "Angry (Snarling)" — starts at x≈310
    id: 'spyke_final_angry',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 310, top: 1220, width: 220, height: 290 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, angry expression, white background',
  },
  {
    // 3rd expression panel — "Battle-focused" — starts at x≈545
    id: 'spyke_final_battle',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 545, top: 1220, width: 210, height: 290 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, battle focus expression, white background',
  },
  {
    // 4th expression panel — "Rare Smirk" — starts at x≈770
    id: 'spyke_final_smirk',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 770, top: 1220, width: 210, height: 290 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, smirk expression, white background',
  },
  {
    // 5th expression panel — "Shocked" — starts at x≈1000
    id: 'spyke_final_shocked',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 1000, top: 1220, width: 230, height: 290 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, shocked expression, white background',
  },
  {
    // 6th expression panel — "Inner Pain" — starts at x≈1250
    id: 'spyke_final_inner_pain',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 1250, top: 1220, width: 220, height: 290 },
    flip: true,
    caption: 'spyke_plasma_v1, closeup face, pained expression, white background',
  },
  {
    // Detail callout — "Red Bandana" — starts at x≈1570 (after inner pain panel)
    // Accessory detail shot: trains the model on Spyke's distinctive red bandana
    id: 'spyke_final_red_bandana',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Final.png',
    crop: { left: 1570, top: 1220, width: 280, height: 290 },
    flip: false,
    caption: 'spyke_plasma_v1, closeup head, red bandana detail, white background',
  },

  // -------------------------------------------------------------------------
  // Spyke_Younger.png (2816x1536) — canonical art, Age: 21
  // Different poses from Spyke_Final: includes action/combat pose (pose 2)
  // Preferred over AI-generated ref-sheets for body view diversity
  // -------------------------------------------------------------------------
  {
    id: 'younger_front',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Younger.png',
    crop: { left: 30, top: 100, width: 640, height: 1100 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, front view, standing, white background',
  },
  {
    // Action/combat pose — sword raised, 3/4 angle
    id: 'younger_action',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Younger.png',
    crop: { left: 720, top: 100, width: 640, height: 1100 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, three quarter angle, combat stance, sword raised, white background',
  },
  {
    id: 'younger_side',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Younger.png',
    crop: { left: 1400, top: 100, width: 640, height: 1100 },
    flip: false,
    caption: 'spyke_plasma_v1, full body, side profile, white background',
  },
  {
    id: 'younger_back',
    src: '03_manga/concept/characters/spyke_tinwall/Spyke_Younger.png',
    crop: { left: 2080, top: 100, width: 640, height: 1100 },
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
// Captions + flip augmentation
// ---------------------------------------------------------------------------

async function writeCaptionsAndFlips(trainDir: string): Promise<void> {
  console.log('\nSpyke crop script — CAPTIONS mode');
  console.log(`Writing captions + flips to: ${trainDir}\n`);

  let captionCount = 0;
  let flipCount = 0;

  for (let i = 0; i < CROP_SOURCES.length; i++) {
    const source = CROP_SOURCES[i]!;
    const stem = `spyke_${String(i + 1).padStart(3, '0')}`;
    const pngPath = join(trainDir, `${stem}.png`);
    const txtPath = join(trainDir, `${stem}.txt`);

    // Write caption for original
    await writeFile(txtPath, source.caption, 'utf8');
    captionCount++;
    process.stdout.write(`  ${stem}.txt\n`);

    // Generate flipped copy + caption
    if (source.flip) {
      const flipPng = join(trainDir, `${stem}_flip.png`);
      const flipTxt = join(trainDir, `${stem}_flip.txt`);
      await sharp(pngPath).flop().png().toFile(flipPng);
      await writeFile(flipTxt, `${source.caption}, mirrored`, 'utf8');
      captionCount++;
      flipCount++;
      process.stdout.write(`  ${stem}_flip.png + ${stem}_flip.txt\n`);
    }
  }

  console.log(`\nDone. ${captionCount} caption files written, ${flipCount} flipped copies generated.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  const isCaptions = process.argv.includes('--captions');

  const projectRoot = process.cwd();
  const trainDir = resolve(projectRoot, 'dataset/spyke/train/10_spyke_plasma_v1');

  if (isCaptions) {
    await writeCaptionsAndFlips(trainDir);
    return;
  }

  const mode: 'dry-run' | 'final' = isDryRun ? 'dry-run' : 'final';
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
    const source = CROP_SOURCES[i]!;
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
