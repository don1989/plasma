import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';

import { PATHS } from './config/paths.js';

const program = new Command();

program
  .name('plasma-pipeline')
  .description('Manga production pipeline for Plasma')
  .version('0.1.0');

program
  .command('script')
  .description('Convert a story chapter into a manga script')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    if (!options.chapter) {
      console.error("error: required option '-c, --chapter <number>' not specified");
      process.exit(1);
    }
    const { runScript } = await import('./stages/script.js');
    const result = await runScript({
      chapter: parseInt(options.chapter),
      verbose: options.verbose,
      dryRun: options.dryRun,
    });
    if (!result.success) {
      console.error('Stage failed:', result.errors);
      process.exit(1);
    }
    console.log(`Completed in ${result.duration}ms. Files: ${result.outputFiles.length}`);
  });

program
  .command('prompt')
  .description('Generate Gemini art prompts from a manga script')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    if (!options.chapter) {
      console.error("error: required option '-c, --chapter <number>' not specified");
      process.exit(1);
    }
    const { runPrompt } = await import('./stages/prompt.js');
    const result = await runPrompt({
      chapter: parseInt(options.chapter),
      verbose: options.verbose,
      dryRun: options.dryRun,
    });
    if (!result.success) {
      console.error('Stage failed:', result.errors);
      process.exit(1);
    }
    console.log(`Completed in ${result.duration}ms. Files: ${result.outputFiles.length}`);
  });

program
  .command('generate')
  .description('Generate panel images using Gemini AI')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--manual', 'Manual workflow: display prompts for copy-paste')
  .option('--api', 'Automated workflow: call Gemini API directly')
  .option('--import <path>', 'Import a downloaded image (use with --page)')
  .option('--page <number>', 'Page number (used with --import)')
  .option('--pages <range>', 'Page range to display/generate (e.g., "1-5" or "3,7,12")')
  .option('--model <name>', 'Gemini model override')
  .option('--reference <path>', 'Character reference image for visual consistency (use with --api)')
  .option('--approve <file>', 'Mark an image version as approved (e.g., ch01_p003_v1.png)')
  .option('--notes <text>', 'Notes for this generation (stored in manifest)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    // Parse --pages range: support "1-5" (range) and "3,7,12" (comma-separated)
    let pages: number[] | undefined;
    if (options.pages) {
      const raw = options.pages as string;
      if (raw.includes('-')) {
        const [startStr, endStr] = raw.split('-');
        const start = parseInt(startStr!);
        const end = parseInt(endStr!);
        if (isNaN(start) || isNaN(end) || start > end) {
          console.error(`Invalid page range: ${raw}`);
          process.exit(1);
        }
        pages = [];
        for (let i = start; i <= end; i++) pages.push(i);
      } else {
        pages = raw.split(',').map((s) => {
          const n = parseInt(s.trim());
          if (isNaN(n)) {
            console.error(`Invalid page number: ${s}`);
            process.exit(1);
          }
          return n;
        });
      }
    }

    // Determine mode: --api overrides, otherwise default to 'manual'
    const mode: 'manual' | 'api' = options.api ? 'api' : 'manual';

    if (!options.chapter) {
      console.error("error: required option '-c, --chapter <number>' not specified");
      process.exit(1);
    }

    // Validate: --import requires --page
    if (options.import && !options.page) {
      console.error('Error: --import requires --page. Specify which page this image belongs to.');
      process.exit(1);
    }

    // Validate: --import file must exist
    if (options.import) {
      const { existsSync } = await import('node:fs');
      if (!existsSync(options.import)) {
        console.error(`Error: Import file not found: ${options.import}`);
        process.exit(1);
      }
    }

    // Validate: --reference file must exist
    if (options.reference) {
      const { existsSync } = await import('node:fs');
      if (!existsSync(options.reference)) {
        console.error(`Error: Reference file not found: ${options.reference}`);
        process.exit(1);
      }
    }

    const { runGenerate } = await import('./stages/generate.js');
    const result = await runGenerate({
      chapter: parseInt(options.chapter),
      mode,
      importPath: options.import,
      page: options.page ? parseInt(options.page) : undefined,
      pages,
      model: options.model,
      referencePath: options.reference,
      approve: options.approve,
      notes: options.notes,
      verbose: options.verbose,
      dryRun: options.dryRun,
    });
    if (!result.success) {
      console.error('Stage failed:', result.errors);
      process.exit(1);
    }
    console.log(`Completed in ${result.duration}ms. Files: ${result.outputFiles.length}`);
  });

program
  .command('overlay')
  .description('Overlay dialogue text onto panel images')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--page <number>', 'Overlay a single page')
  .option('--pages <range>', 'Page range to overlay (e.g., "1-5" or "3,7,12")')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    if (!options.chapter) {
      console.error("error: required option '-c, --chapter <number>' not specified");
      process.exit(1);
    }
    // Parse --pages range: support "1-5" (range) and "3,7,12" (comma-separated)
    let pages: number[] | undefined;
    if (options.pages) {
      const raw = options.pages as string;
      if (raw.includes('-')) {
        const [startStr, endStr] = raw.split('-');
        const start = parseInt(startStr!);
        const end = parseInt(endStr!);
        if (isNaN(start) || isNaN(end) || start > end) {
          console.error(`Invalid page range: ${raw}`);
          process.exit(1);
        }
        pages = [];
        for (let i = start; i <= end; i++) pages.push(i);
      } else {
        pages = raw.split(',').map((s) => {
          const n = parseInt(s.trim());
          if (isNaN(n)) {
            console.error(`Invalid page number: ${s}`);
            process.exit(1);
          }
          return n;
        });
      }
    }

    const { runOverlay } = await import('./stages/overlay.js');
    const result = await runOverlay({
      chapter: parseInt(options.chapter),
      page: options.page ? parseInt(options.page) : undefined,
      pages,
      verbose: options.verbose,
      dryRun: options.dryRun,
    });
    if (!result.success) {
      console.error('Stage failed:', result.errors);
      process.exit(1);
    }
    console.log(`Completed in ${result.duration}ms. Files: ${result.outputFiles.length}`);
  });

program
  .command('assemble')
  .description('Assemble lettered panels into Webtoon vertical strips')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--format <type>', 'Output format (jpeg or png)', 'jpeg')
  .option('--quality <number>', 'JPEG quality 1-100 (default: 90)', '90')
  .option('--gutter <number>', 'Gutter height in pixels (default: 10)', '10')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    if (!options.chapter) {
      console.error("error: required option '-c, --chapter <number>' not specified");
      process.exit(1);
    }
    // Validate format
    const format = options.format as string;
    if (format !== 'jpeg' && format !== 'png') {
      console.error(`Invalid format: ${format}. Must be 'jpeg' or 'png'.`);
      process.exit(1);
    }

    // Parse and validate quality
    const quality = parseInt(options.quality);
    if (isNaN(quality) || quality < 1 || quality > 100) {
      console.error(`Invalid quality: ${options.quality}. Must be 1-100.`);
      process.exit(1);
    }

    // Parse and validate gutter
    const gutter = parseInt(options.gutter);
    if (isNaN(gutter) || gutter < 0) {
      console.error(`Invalid gutter: ${options.gutter}. Must be >= 0.`);
      process.exit(1);
    }

    const { runAssemble } = await import('./stages/assemble.js');
    const result = await runAssemble({
      chapter: parseInt(options.chapter),
      verbose: options.verbose,
      dryRun: options.dryRun,
      configOverride: {
        format: format as 'jpeg' | 'png',
        jpegQuality: quality,
        gutterHeight: gutter,
      },
    });
    if (!result.success) {
      console.error('Stage failed:', result.errors);
      process.exit(1);
    }
    console.log(`Completed in ${result.duration}ms. Files: ${result.outputFiles.length}`);
  });

// ---------------------------------------------------------------------------
// Character subcommands (lightweight CLI utilities, not pipeline stages)
// ---------------------------------------------------------------------------

const character = program
  .command('character')
  .description('Character fingerprint utilities');

character
  .command('list')
  .description('List all registered characters')
  .action(async () => {
    const { loadCharacterRegistry } = await import('./characters/registry.js');
    const registry = await loadCharacterRegistry();
    const characters = registry.getAll();

    if (characters.length === 0) {
      console.log('No characters found.');
      return;
    }

    console.log(`\nCharacters (${characters.length}):\n`);
    for (const char of characters) {
      const fp = char.fingerprint.trim();
      const preview = fp.length > 50 ? fp.slice(0, 50) + '...' : fp;
      console.log(`  ${char.id}`);
      console.log(`    Name:      ${char.name}`);
      console.log(`    Aliases:   ${char.aliases.length}`);
      console.log(`    Fingerprint: ${preview}`);
      console.log('');
    }
  });

character
  .command('add')
  .description('Scaffold a new character YAML file')
  .argument('<name>', 'Character display name')
  .action(async (name: string) => {
    const { scaffoldCharacterYaml } = await import('./characters/registry.js');
    const filePath = await scaffoldCharacterYaml(name);
    console.log(`Created: ${filePath}`);
    console.log('Remember to fill in the fingerprint field with the tested visual description.');
  });

character
  .command('ref-sheet')
  .description('Output a complete reference sheet prompt for a character')
  .argument('<name>', 'Character name or alias')
  .action(async (name: string) => {
    const { loadCharacterRegistry } = await import('./characters/registry.js');
    const registry = await loadCharacterRegistry();

    const refPrompt = registry.getReferenceSheetPrompt(name);
    if (!refPrompt) {
      console.error(`Character "${name}" has no reference_sheet_prompt field.`);
      process.exit(1);
    }

    // Read style prefix from style-guide.yaml
    const styleRaw = readFileSync(PATHS.styleGuide, 'utf-8');
    const styleData = parseYaml(styleRaw) as { style_prefix?: string };
    const stylePrefix = styleData.style_prefix ?? '';

    // Assemble the full prompt
    const fullPrompt = `${stylePrefix}

${refPrompt.trim()}

Layout:
Main Row: Four full-body views: Front View, 3/4 Angle View, Side Profile View, Back View.`;

    console.log(fullPrompt);
  });

character
  .command('generate-ref')
  .description('Generate a reference sheet image via Gemini API (supports reference image input)')
  .argument('<name>', 'Character name or alias')
  .option('--reference <path>', 'Path to an existing image to use as visual reference')
  .option('--model <name>', 'Gemini model override')
  .option('--version <number>', 'Output version number (default: auto-increment)', '0')
  .action(async (name: string, options) => {
    const { loadCharacterRegistry } = await import('./characters/registry.js');
    const { validateApiKey, generateImage, generateImageWithReference, saveGeneratedImage } =
      await import('./generation/gemini-client.js');
    const { existsSync, readdirSync } = await import('node:fs');
    const { mkdir } = await import('node:fs/promises');
    const path = await import('node:path');

    // Load API key — read .env if not already in environment
    const { loadEnvFile } = await import('./utils/env.js');
    const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
    const apiKey = validateApiKey(process.env['GEMINI_API_KEY'] ?? env['GEMINI_API_KEY']);

    // Load registry and get ref sheet prompt
    const registry = await loadCharacterRegistry();
    if (!registry.has(name)) {
      console.error(`Character "${name}" not found.`);
      process.exit(1);
    }
    const char = registry.get(name)!;
    const refPrompt = registry.getReferenceSheetPrompt(name);
    if (!refPrompt) {
      console.error(`Character "${name}" has no reference_sheet_prompt field.`);
      process.exit(1);
    }

    // Build full prompt (no style prefix for ref sheets — they have their own framing)
    const fullPrompt = `${refPrompt.trim()}

Layout:
Main Row: Four full-body views: Front View, 3/4 Angle View, Side Profile View, Back View.`;

    // Validate reference image if provided
    if (options.reference && !existsSync(options.reference)) {
      console.error(`Reference image not found: ${options.reference}`);
      process.exit(1);
    }

    // Determine output version
    const outDir = PATHS.characterOutput(char.id);
    await mkdir(outDir, { recursive: true });
    let version = parseInt(options.version);
    if (version === 0) {
      const existing = existsSync(outDir)
        ? readdirSync(outDir).filter((f) => f.startsWith('ref-sheet-v')).length
        : 0;
      version = existing + 1;
    }
    const outPath = path.join(outDir, `ref-sheet-v${version}.png`);

    console.log(`Generating reference sheet for ${char.name} (v${version})...`);
    if (options.reference) console.log(`Using reference image: ${options.reference}`);

    const result = options.reference
      ? await generateImageWithReference({
          prompt: fullPrompt,
          referenceImagePath: options.reference,
          model: options.model,
          apiKey,
        })
      : await generateImage({ prompt: fullPrompt, model: options.model, apiKey });

    await saveGeneratedImage(result, outPath);
    console.log(`Saved: ${outPath}`);
  });

// Strip a lone '--' at argv[2] that pnpm injects when using `pnpm dev -- <subcommand> args`.
// This lets `pnpm dev -- overlay -c 1` work identically to `pnpm stage:overlay -c 1`.
const argv = process.argv[2] === '--' ? [...process.argv.slice(0, 2), ...process.argv.slice(3)] : process.argv;
program.parse(argv);
