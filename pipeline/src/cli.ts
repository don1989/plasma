import { Command } from 'commander';

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
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => {
    const { runGenerate } = await import('./stages/generate.js');
    const result = await runGenerate({
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

program.parse();
