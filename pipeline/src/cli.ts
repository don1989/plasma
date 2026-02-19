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
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
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
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
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
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .option('--manual', 'Manual workflow: display prompts for copy-paste')
  .option('--api', 'Automated workflow: call Gemini API directly')
  .option('--import <path>', 'Import a downloaded image (use with --page)')
  .option('--page <number>', 'Page number (used with --import)')
  .option('--pages <range>', 'Page range to display/generate (e.g., "1-5" or "3,7,12")')
  .option('--model <name>', 'Gemini model override')
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

    const { runGenerate } = await import('./stages/generate.js');
    const result = await runGenerate({
      chapter: parseInt(options.chapter),
      mode,
      importPath: options.import,
      page: options.page ? parseInt(options.page) : undefined,
      pages,
      model: options.model,
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
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    const { runOverlay } = await import('./stages/overlay.js');
    const result = await runOverlay({
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
  .command('assemble')
  .description('Assemble lettered panels into Webtoon vertical strips')
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    const { runAssemble } = await import('./stages/assemble.js');
    const result = await runAssemble({
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

program.parse();
