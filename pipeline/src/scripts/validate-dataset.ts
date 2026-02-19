/**
 * validate-dataset.ts
 *
 * Validates the Spyke LoRA training dataset against all DATA-01 through DATA-04 requirements.
 * Run before Phase 8 (LoRA training) to catch errors early.
 *
 * Usage:
 *   tsx pipeline/src/scripts/validate-dataset.ts
 *
 * Exit code 0 = PASS, exit code 1 = FAIL
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TRAIN_DIR = 'dataset/spyke/train/10_spyke_plasma_v1';
const REG_DIR = 'dataset/spyke/reg/1_anime_character';
const TRIGGER_WORD = 'spyke_plasma_v1';
const TRAIN_ORIG_MIN = 15;
const TRAIN_ORIG_MAX = 30;
const REG_MIN = 100;
const REG_MAX = 200;
const DIM_SAMPLE = 5;
const EXPECTED_DIM = 512;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CheckResult {
  label: string;
  pass: boolean;
  detail: string;
  errors: string[];
  warnings: string[];
}

function check(
  label: string,
  pass: boolean,
  detail: string,
  errors: string[] = [],
  warnings: string[] = [],
): CheckResult {
  return { label, pass, detail, errors, warnings };
}

function printResult(r: CheckResult): void {
  const status = r.pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${r.label.padEnd(50)} ${status} ${r.detail}`);
  for (const e of r.errors) console.log(`       \x1b[31m✗ ${e}\x1b[0m`);
  for (const w of r.warnings) console.log(`       \x1b[33m⚠ ${w}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkDirectories(): CheckResult[] {
  const results: CheckResult[] = [];
  for (const dir of [TRAIN_DIR, REG_DIR]) {
    const exists = existsSync(path.resolve(dir));
    results.push(check(
      `Directory: ${dir}`,
      exists,
      exists ? 'exists' : 'MISSING',
    ));
  }
  return results;
}

function checkData01(trainDir: string): CheckResult {
  const originals = readdirSync(trainDir)
    .filter(f => f.endsWith('.png') && !f.includes('_flip'));
  const count = originals.length;
  const pass = count >= TRAIN_ORIG_MIN && count <= TRAIN_ORIG_MAX;
  return check(
    'DATA-01: Training originals',
    pass,
    `${count} images (expected ${TRAIN_ORIG_MIN}–${TRAIN_ORIG_MAX})`,
    pass ? [] : [`Got ${count}, need ${TRAIN_ORIG_MIN}–${TRAIN_ORIG_MAX}`],
  );
}

function checkData02(trainDir: string): [CheckResult, CheckResult, CheckResult] {
  const pngs = readdirSync(trainDir).filter(f => f.endsWith('.png'));
  const total = pngs.length;

  const missingCaptions: string[] = [];
  const badTrigger: string[] = [];
  const badFormat: string[] = [];

  for (const png of pngs) {
    const stem = png.replace(/\.png$/, '');
    const txtPath = path.resolve(trainDir, `${stem}.txt`);

    if (!existsSync(txtPath)) {
      missingCaptions.push(png);
      continue;
    }

    const content = readFileSync(txtPath, 'utf8').trim();
    if (!content.startsWith(TRIGGER_WORD)) {
      badTrigger.push(`${stem}.txt`);
    }
    const tokens = content.split(',').map(t => t.trim()).filter(Boolean);
    if (tokens.length < 4) {
      badFormat.push(`${stem}.txt (${tokens.length} tokens)`);
    }
  }

  const paired = total - missingCaptions.length;
  return [
    check(
      'DATA-02: Caption pairing',
      missingCaptions.length === 0,
      `${paired}/${total} images have captions`,
      missingCaptions.map(f => `Missing caption for ${f}`),
    ),
    check(
      'DATA-02: Trigger word',
      badTrigger.length === 0,
      `All ${paired} captions start with ${TRIGGER_WORD}`,
      badTrigger.map(f => `${f} missing trigger word`),
    ),
    check(
      'DATA-02: Caption format (4+ tokens)',
      badFormat.length === 0,
      `All captions have 4+ comma-separated fields`,
      badFormat.map(f => `${f} has too few tokens`),
    ),
  ];
}

function checkData03(regDir: string): [CheckResult, CheckResult] {
  const pngs = readdirSync(regDir).filter(f => f.endsWith('.png'));
  const txts = readdirSync(regDir).filter(f => f.endsWith('.txt'));
  const count = pngs.length;
  const pass = count >= REG_MIN && count <= REG_MAX;

  return [
    check(
      'DATA-03: Reg image count',
      pass,
      `${count} images (expected ${REG_MIN}–${REG_MAX})`,
      pass ? [] : [`Got ${count}, need ${REG_MIN}–${REG_MAX}`],
    ),
    check(
      'DATA-03: No captions in reg dir',
      txts.length === 0,
      txts.length === 0 ? '0 .txt files' : `${txts.length} .txt files found (should be 0)`,
      [],
      txts.length > 0 ? txts.map(f => `Unexpected caption file: ${f}`) : [],
    ),
  ];
}

function checkData04(trainDir: string): CheckResult {
  const flips = readdirSync(trainDir).filter(f => f.endsWith('_flip.png'));
  const pass = flips.length > 0;
  return check(
    'DATA-04: Flip augmentation images',
    pass,
    `${flips.length} flip images`,
    pass ? [] : ['No _flip.png files found in train dir'],
  );
}

async function checkDimensions(dir: string, label: string, sample: number): Promise<CheckResult> {
  const pngs = readdirSync(path.resolve(dir))
    .filter(f => f.endsWith('.png'))
    .slice(0, sample);

  const wrong: string[] = [];
  for (const f of pngs) {
    const meta = await sharp(path.resolve(dir, f)).metadata();
    if (meta.width !== EXPECTED_DIM || meta.height !== EXPECTED_DIM) {
      wrong.push(`${f}: ${meta.width}x${meta.height}`);
    }
  }

  return check(
    `DIMENSIONS: ${label} (${pngs.length} sampled)`,
    wrong.length === 0,
    wrong.length === 0 ? `All ${EXPECTED_DIM}x${EXPECTED_DIM}` : `${wrong.length} wrong size`,
    wrong,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n=== Spyke Dataset Validation ===\n');

  const allResults: CheckResult[] = [];

  // Directory existence (fail fast)
  const dirChecks = checkDirectories();
  for (const r of dirChecks) {
    printResult(r);
    allResults.push(r);
  }
  if (dirChecks.some(r => !r.pass)) {
    console.log('\n\x1b[31mResult: FAIL — directories missing, cannot continue\x1b[0m\n');
    process.exit(1);
  }

  const trainDir = path.resolve(TRAIN_DIR);
  const regDir = path.resolve(REG_DIR);

  // DATA checks
  const checks: CheckResult[] = [
    checkData01(trainDir),
    ...checkData02(trainDir),
    ...checkData03(regDir),
    checkData04(trainDir),
    await checkDimensions(TRAIN_DIR, 'Training sample', DIM_SAMPLE),
    await checkDimensions(REG_DIR, 'Reg sample', DIM_SAMPLE),
  ];

  for (const r of checks) {
    printResult(r);
    allResults.push(r);
  }

  // Summary
  const failures = allResults.filter(r => !r.pass);
  const warnings = allResults.flatMap(r => r.warnings);

  console.log('\n' + '='.repeat(50));
  if (failures.length === 0) {
    console.log(`\x1b[32mResult: PASS\x1b[0m (0 errors, ${warnings.length} warnings)\n`);
  } else {
    console.log(`\x1b[31mResult: FAIL\x1b[0m (${failures.length} errors, ${warnings.length} warnings)\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
