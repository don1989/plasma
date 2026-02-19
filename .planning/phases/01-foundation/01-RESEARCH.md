# Phase 1: Foundation - Research

**Researched:** 2026-02-18
**Domain:** TypeScript pipeline infrastructure, CLI scaffolding, project setup
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Package manager: pnpm
- TypeScript config: strict mode (strict: true, no implicit any, null checks)
- Testing: vitest from day 1 -- test infrastructure set up in Phase 1
- All work on feature branches, never commit to main

### Claude's Discretion
- Build tooling choice (tsx for dev, tsup for build, or alternatives) -- pick what's fastest for this pipeline's needs
- CLI framework selection (commander, yargs, oclif, or custom)
- Directory layout within `pipeline/` (flat vs nested, where config lives)
- Stage scaffolding approach (shared types, inter-stage data contracts)
- How stages discover and read from story directories (config file paths, relative paths, environment variables)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | All pipeline code lives in a separate `pipeline/` directory, decoupled from story content | Project structure pattern with `pipeline/` as standalone TypeScript project with its own package.json |
| INFR-02 | Pipeline is built in TypeScript with Sharp for image processing | TypeScript strict config, Sharp v0.34.5 setup, tsx for dev execution |
| INFR-03 | Pipeline reads from existing story directories (01_bible/, 03_manga/) but never writes to them | Path resolution strategy using relative paths from project root, read-only access pattern with explicit path constants |
| INFR-04 | CLI interface allows running each pipeline stage independently | Commander v14.0.3 with subcommands per stage, pnpm scripts as shortcuts |
| INFR-05 | All work committed to feature branches, never directly to main | Git workflow -- branch naming convention already established in CLAUDE.md |

</phase_requirements>

## Summary

Phase 1 establishes the TypeScript pipeline infrastructure that all subsequent phases build upon. The pipeline lives in `pipeline/` as a standalone TypeScript project managed by pnpm, with Sharp for image processing (used in later phases but installed now as a locked dependency). Each pipeline stage is independently invokable via CLI subcommands using Commander.js. The project uses tsx for zero-config TypeScript execution during development and vitest for testing from day one.

The system is confirmed running Node.js v20.19.5 with pnpm 10.2.0. All key dependencies are verified as compatible with this Node.js version. The pipeline reads from existing story directories (`01_bible/`, `03_manga/`) using relative path resolution from the project root, but writes exclusively to `output/`. Neither `pipeline/` nor `output/` directories exist yet -- this phase creates them from scratch.

**Primary recommendation:** Use Commander.js for CLI (zero dependencies, strong TypeScript support, subcommand pattern maps perfectly to pipeline stages), tsx for development execution, and a flat-ish `pipeline/src/` structure with stage files and shared types.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | ~5.7 | Type checking and language | Locked decision: strict mode. Used for type checking only -- tsx handles execution |
| sharp | 0.34.5 | Image processing (resize, composite, format conversion) | Locked decision from REQUIREMENTS.md. Fastest Node.js image processor, uses libvips. TypeScript types bundled since v0.32.0 |
| commander | 14.0.3 | CLI framework with subcommands | **Recommended (discretion).** Zero dependencies, 282M weekly downloads, built-in TypeScript types, subcommand pattern maps 1:1 to pipeline stages |
| tsx | 4.21.0 | TypeScript execution for development | **Recommended (discretion).** Zero-config, esbuild-powered, handles ESM/CJS seamlessly. Does not type-check (use tsc separately) |
| vitest | 4.0.18 | Testing framework | Locked decision: test infrastructure from day 1. Vite-powered, native TypeScript, fast watch mode |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | ~20.x | Node.js type definitions | Required by Sharp TypeScript types and for fs/path typing |
| @tsconfig/node20 | latest | Base TypeScript config for Node.js 20 | Extend this for sensible defaults, override with strict settings |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander | yargs | Yargs has 16 dependencies vs commander's 0. Yargs has richer validation/middleware but this pipeline needs simple subcommands, not complex parsing |
| commander | custom (process.argv) | Works for 2-3 flags but unmaintainable at 5+ stages with options. Commander provides help generation, error messages, and type safety for free |
| tsx | ts-node | ts-node has ESM compatibility issues on Node.js 20+. tsx handles ESM/CJS seamlessly. tsx uses esbuild (faster) vs ts-node's tsc (slower) |
| tsx | Node.js native TS (--strip-types) | Native TS support is stable on Node.js v25.2+ but system runs v20.19.5. Also, native does not support tsconfig paths, enums, or decorators without extra flags. tsx is the safe choice |
| vitest | jest | Vitest is faster (Vite-powered), native TypeScript support without babel transforms, compatible config format |

**Installation:**
```bash
cd pipeline
pnpm init
pnpm add sharp commander
pnpm add -D typescript tsx vitest @types/node @tsconfig/node20
```

## Architecture Patterns

### Recommended Project Structure

```
plasma/                          # Project root (existing repo)
├── 01_bible/                    # Existing -- canon, read-only
├── 03_manga/                    # Existing -- scripts/prompts, read-only
├── pipeline/                    # NEW -- all pipeline code
│   ├── package.json             # pnpm project with dependencies
│   ├── tsconfig.json            # Strict TypeScript config
│   ├── vitest.config.ts         # Test configuration
│   ├── src/
│   │   ├── cli.ts               # CLI entry point (commander setup)
│   │   ├── stages/              # One file per pipeline stage
│   │   │   ├── script.ts        # Stage: chapter -> manga script
│   │   │   ├── prompt.ts        # Stage: script -> Gemini prompts
│   │   │   ├── generate.ts      # Stage: prompts -> images (manual/API)
│   │   │   ├── overlay.ts       # Stage: images + dialogue -> lettered
│   │   │   └── assemble.ts      # Stage: lettered -> webtoon strip
│   │   ├── types/               # Shared TypeScript types
│   │   │   ├── index.ts         # Re-exports
│   │   │   ├── pipeline.ts      # Pipeline-wide types (StageResult, Chapter, etc.)
│   │   │   └── manga.ts         # Manga domain types (Panel, Page, Dialogue, etc.)
│   │   ├── config/              # Configuration and path resolution
│   │   │   ├── paths.ts         # Path constants and resolution
│   │   │   └── defaults.ts      # Default config values
│   │   └── utils/               # Shared utilities
│   │       └── fs.ts            # File system helpers (read-only checks, etc.)
│   └── tests/
│       ├── stages/              # Stage-specific tests
│       │   └── script.test.ts
│       ├── config/              # Config/path resolution tests
│       │   └── paths.test.ts
│       └── utils/               # Utility tests
│           └── fs.test.ts
└── output/                      # NEW -- pipeline output (gitignored)
    └── ch-01/
        ├── raw/                 # Stage 3 output
        ├── processed/           # Stage 4 output
        ├── lettered/            # Stage 5 output
        └── webtoon/             # Stage 6 output
```

**Rationale:**
- `pipeline/` is a standalone project with its own `package.json` -- decoupled from any future root-level packages
- `src/stages/` has one file per stage -- maps 1:1 to CLI subcommands and makes each stage independently testable
- `src/types/` exports shared contracts that stages use to communicate (inter-stage data shapes)
- `src/config/paths.ts` centralizes all path resolution -- stages never hardcode `../../01_bible/`
- `tests/` mirrors `src/` structure for discoverability
- `output/` lives at project root (not inside `pipeline/`) so pipeline artifacts are peer to story content

### Pattern 1: Subcommand-Per-Stage CLI

**What:** Each pipeline stage is a Commander subcommand. The CLI entry point registers all stages as subcommands with their own options and help text.

**When to use:** Always -- this is the primary interface for running stages.

**Example:**
```typescript
// Source: Commander v14 official docs pattern
// pipeline/src/cli.ts
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
  .action(async (options) => {
    const { runScript } = await import('./stages/script.js');
    await runScript({ chapter: parseInt(options.chapter) });
  });

program
  .command('prompt')
  .description('Generate Gemini art prompts from a manga script')
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .action(async (options) => {
    const { runPrompt } = await import('./stages/prompt.js');
    await runPrompt({ chapter: parseInt(options.chapter) });
  });

// ... more stages

program.parse();
```

### Pattern 2: Centralized Path Resolution

**What:** A single module resolves all paths to story directories and output locations. Stages import path constants rather than constructing paths themselves.

**When to use:** Every time a stage needs to read from `01_bible/`, `03_manga/`, or write to `output/`.

**Example:**
```typescript
// pipeline/src/config/paths.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root is one level up from pipeline/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

export const PATHS = {
  // Source directories (READ-ONLY)
  bible: path.join(PROJECT_ROOT, '01_bible'),
  planning: path.join(PROJECT_ROOT, '02_planning'),
  manga: path.join(PROJECT_ROOT, '03_manga'),
  prompts: path.join(PROJECT_ROOT, '03_manga', 'prompts'),
  characterSheets: path.join(PROJECT_ROOT, '03_manga', 'prompts', 'character-sheets.md'),

  // Output directory (WRITE)
  output: path.join(PROJECT_ROOT, 'output'),

  // Chapter-specific output
  chapterOutput: (chapter: number) => {
    const chNum = String(chapter).padStart(2, '0');
    return {
      root: path.join(PROJECT_ROOT, 'output', `ch-${chNum}`),
      raw: path.join(PROJECT_ROOT, 'output', `ch-${chNum}`, 'raw'),
      processed: path.join(PROJECT_ROOT, 'output', `ch-${chNum}`, 'processed'),
      lettered: path.join(PROJECT_ROOT, 'output', `ch-${chNum}`, 'lettered'),
      webtoon: path.join(PROJECT_ROOT, 'output', `ch-${chNum}`, 'webtoon'),
    };
  },
} as const;
```

### Pattern 3: Stage Function Contract

**What:** Every stage exports a single async function with a typed options object and a typed result. Stages are pure functions: read input paths, process, write to output paths, return a result.

**When to use:** For every stage implementation.

**Example:**
```typescript
// pipeline/src/types/pipeline.ts
export interface StageResult {
  stage: string;
  success: boolean;
  outputFiles: string[];
  errors: string[];
  duration: number;  // milliseconds
}

export interface StageOptions {
  chapter: number;
  verbose?: boolean;
  dryRun?: boolean;
}

// pipeline/src/stages/script.ts
import type { StageOptions, StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';

export async function runScript(options: StageOptions): Promise<StageResult> {
  const startTime = Date.now();
  const outputFiles: string[] = [];
  const errors: string[] = [];

  // Stage implementation here...

  return {
    stage: 'script',
    success: errors.length === 0,
    outputFiles,
    errors,
    duration: Date.now() - startTime,
  };
}
```

### Anti-Patterns to Avoid

- **Hardcoded relative paths in stages:** Never do `../../01_bible/` inside a stage file. Use `PATHS.bible` from config. Paths break when execution context changes.
- **Stages that write to source directories:** The pipeline MUST only write to `output/`. Reading from `01_bible/` and `03_manga/` is fine. Writing to them violates INFR-03.
- **Monolithic CLI file:** Do not put stage logic inside `cli.ts`. The CLI file should only wire subcommands to stage functions. Stage logic lives in `src/stages/`.
- **Skipping type contracts between stages:** Every stage should have typed input/output interfaces in `src/types/`. Without this, stages drift and inter-stage data breaks silently.
- **Building without testing:** Vitest is a locked decision for Phase 1. Do not defer tests. At minimum: path resolution tests, stage function contract tests (does the function exist, accept correct options, return correct shape).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom process.argv parser | Commander v14 | Help text, error messages, type coercion, subcommands -- all solved. Building this by hand is a maintenance tax that grows with every new option |
| TypeScript execution | Custom build-then-run scripts | tsx | Esbuild-powered, handles ESM/CJS, watch mode, zero config. A build step for dev is friction that slows iteration |
| Image processing | Custom Sharp wrappers | Sharp directly | Sharp's API is already clean and chainable. Wrapping it adds indirection without value at this stage. Wrap later if needed |
| Test framework | Custom assertion helpers | vitest | Built-in assertions, snapshots, mocking, coverage, watch mode. Any custom test harness is worse |
| Path resolution | process.cwd() + string concat | path.join() + centralized PATHS module | path.join handles OS differences. Centralized paths prevent path drift across stages |

**Key insight:** This is infrastructure -- every minute spent hand-rolling solved problems is a minute not spent on the actual manga pipeline stages that deliver value. Use battle-tested tools and move to Phase 2.

## Common Pitfalls

### Pitfall 1: ESM Import Extensions

**What goes wrong:** TypeScript files import `from './stages/script'` (no extension). At runtime with tsx, this works. But if you ever compile to JS, Node.js ESM requires explicit `.js` extensions in imports.
**Why it happens:** TypeScript historically allowed extensionless imports. Node.js ESM does not.
**How to avoid:** Always use `.js` extensions in imports even in `.ts` files: `import { runScript } from './stages/script.js'`. TypeScript with `moduleResolution: "NodeNext"` enforces this. tsx handles the resolution correctly.
**Warning signs:** Imports work in dev but fail after `tsc` compilation.

### Pitfall 2: Sharp Native Module Installation

**What goes wrong:** Sharp uses native binaries (libvips). On macOS, `pnpm install` occasionally fails to download the correct prebuilt binary, especially on Apple Silicon.
**Why it happens:** Sharp downloads platform-specific prebuilt binaries. Network issues, architecture mismatches, or package manager caching can interfere.
**How to avoid:** Run `pnpm add sharp` and verify it works immediately with a simple test script: `import sharp from 'sharp'; console.log(sharp.versions);`. If it fails, try `pnpm rebuild sharp`.
**Warning signs:** `Error: Could not load the "sharp" module` at runtime.

### Pitfall 3: pnpm Workspace vs Standalone Package

**What goes wrong:** Developers create a `pnpm-workspace.yaml` at the project root, turning the repo into a monorepo. This adds complexity (hoisting rules, workspace protocols) that a single `pipeline/` package does not need.
**Why it happens:** Tutorials default to monorepo patterns. This project has one package.
**How to avoid:** Do NOT create `pnpm-workspace.yaml`. The `pipeline/` directory has its own `package.json` and is self-contained. Run `pnpm install` from inside `pipeline/`.
**Warning signs:** `ERR_PNPM_ADDING_TO_ROOT` errors, unexpected dependency hoisting.

### Pitfall 4: Forgetting `"type": "module"` in package.json

**What goes wrong:** TypeScript is configured for ESM (`"module": "NodeNext"`) but package.json lacks `"type": "module"`. Node.js treats `.js` files as CommonJS, causing `SyntaxError: Cannot use import statement in a module`.
**Why it happens:** This is a Node.js default behavior -- `.js` files are CJS unless `package.json` says otherwise.
**How to avoid:** Add `"type": "module"` to `pipeline/package.json`. This is mandatory for ESM projects on Node.js.
**Warning signs:** `SyntaxError: Cannot use import statement` or `ReferenceError: require is not defined`.

### Pitfall 5: Writing Output Inside pipeline/

**What goes wrong:** A stage writes generated files to `pipeline/output/` instead of the project-root `output/`. Generated images end up mixed with pipeline source code.
**Why it happens:** Developers default to writing relative to the current module's directory.
**How to avoid:** Use the centralized `PATHS.output` constant which resolves to `<project_root>/output/`. Never construct output paths relative to `__dirname`.
**Warning signs:** Image files appearing inside `pipeline/`, bloated git status.

### Pitfall 6: Not .gitignoring output/

**What goes wrong:** AI-generated PNG files (1-8MB each) get committed to git, bloating the repo.
**Why it happens:** No `.gitignore` rule for `output/`.
**How to avoid:** Add `output/` to the project root `.gitignore` in Phase 1. Pipeline output is generated, not source-controlled.
**Warning signs:** `git status` shows hundreds of MB of PNG files staged.

## Code Examples

Verified patterns from official sources:

### TypeScript Configuration (tsconfig.json)
```json
// Source: Total TypeScript TSConfig Cheat Sheet + @tsconfig/node20
// pipeline/tsconfig.json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "lib": ["es2022"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Package.json
```json
// pipeline/package.json
{
  "name": "plasma-pipeline",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "stage:script": "tsx src/cli.ts script",
    "stage:prompt": "tsx src/cli.ts prompt",
    "stage:generate": "tsx src/cli.ts generate",
    "stage:overlay": "tsx src/cli.ts overlay",
    "stage:assemble": "tsx src/cli.ts assemble"
  },
  "dependencies": {
    "commander": "^14.0.3",
    "sharp": "^0.34.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.21.0",
    "typescript": "~5.7.0",
    "vitest": "^4.0.18"
  }
}
```

### Vitest Configuration
```typescript
// Source: Vitest v4 official docs
// pipeline/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts'],
    },
  },
});
```

### CLI Entry Point with Commander Subcommands
```typescript
// Source: Commander v14 official API
// pipeline/src/cli.ts
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

// Additional stage subcommands follow same pattern...

program.parse();
```

### Stage Stub (Phase 1 Scaffold)
```typescript
// pipeline/src/stages/script.ts
import type { StageOptions, StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { existsSync } from 'node:fs';

export async function runScript(options: StageOptions): Promise<StageResult> {
  const startTime = Date.now();

  // Verify source directory is readable
  if (!existsSync(PATHS.manga)) {
    return {
      stage: 'script',
      success: false,
      outputFiles: [],
      errors: [`Manga directory not found: ${PATHS.manga}`],
      duration: Date.now() - startTime,
    };
  }

  // TODO: Implement in Phase 2
  console.log(`[script] Chapter ${options.chapter} -- stage not yet implemented`);

  return {
    stage: 'script',
    success: true,
    outputFiles: [],
    errors: [],
    duration: Date.now() - startTime,
  };
}
```

### Sharp Text Overlay via SVG Composite
```typescript
// Source: Sharp GitHub issue #1120 + composite API docs
// This pattern is needed for Phase 4 but documented here for reference
import sharp from 'sharp';

async function overlayText(
  imagePath: string,
  text: string,
  outputPath: string,
): Promise<void> {
  const svgText = `
    <svg width="400" height="50">
      <text x="10" y="35" font-size="24" fill="#000"
            font-family="sans-serif">${text}</text>
    </svg>`;

  await sharp(imagePath)
    .composite([{
      input: Buffer.from(svgText),
      gravity: 'northwest',
    }])
    .toFile(outputPath);
}
```

### Path Resolution Test
```typescript
// pipeline/tests/config/paths.test.ts
import { describe, it, expect } from 'vitest';
import { PATHS } from '../../src/config/paths.js';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('PATHS', () => {
  it('resolves bible directory to existing path', () => {
    expect(PATHS.bible).toContain('01_bible');
    expect(existsSync(PATHS.bible)).toBe(true);
  });

  it('resolves manga directory to existing path', () => {
    expect(PATHS.manga).toContain('03_manga');
    expect(existsSync(PATHS.manga)).toBe(true);
  });

  it('output directory is at project root level', () => {
    // output/ should be a sibling of 01_bible/, not inside pipeline/
    const outputParent = path.dirname(PATHS.output);
    const bibleParent = path.dirname(PATHS.bible);
    expect(outputParent).toBe(bibleParent);
  });

  it('generates chapter output paths correctly', () => {
    const ch1 = PATHS.chapterOutput(1);
    expect(ch1.root).toContain('ch-01');
    expect(ch1.raw).toContain(path.join('ch-01', 'raw'));
    expect(ch1.processed).toContain(path.join('ch-01', 'processed'));
    expect(ch1.lettered).toContain(path.join('ch-01', 'lettered'));
    expect(ch1.webtoon).toContain(path.join('ch-01', 'webtoon'));
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node for TypeScript execution | tsx (esbuild-powered) | 2023-2024 | tsx is faster, handles ESM natively, zero config. ts-node has ESM issues on Node 20+ |
| Jest for testing | Vitest | 2022-2023 | Vitest is faster, native TS, Vite-powered. No babel config needed |
| CommonJS modules | ESM with `"type": "module"` | 2022+ | ESM is the standard. Node.js 20 has full ESM support. New projects should default to ESM |
| @types/sharp separate package | Types bundled in sharp | v0.32.0 (2023) | No need for separate @types/sharp -- it is bundled. @types/sharp is deprecated |
| tsc + node for dev | tsx watch mode | 2023+ | No compile step in development. `tsx --watch` re-runs on save |
| commander v9-12 | commander v14 | 2025 | Requires Node.js 20+. Stable API, same patterns apply |

**Deprecated/outdated:**
- **ts-node:** ESM compatibility issues on Node.js 20+. Use tsx instead
- **@types/sharp:** Deprecated since Sharp v0.32.0, types now bundled
- **CommonJS for new projects:** ESM is the standard. Use `"type": "module"` in package.json
- **tsup for this project:** tsup is for bundling libraries for npm publishing. This is an application -- tsc for type checking and tsx for execution is sufficient. tsup would add unnecessary complexity

## Open Questions

1. **Vitest requires Vite >= v6.0.0 and Node >= v20.0.0**
   - What we know: System runs Node v20.19.5, which meets the requirement
   - What's unclear: Whether vitest v4 pulls in vite as a dependency automatically or requires explicit installation
   - Recommendation: Let pnpm resolve this -- vitest includes vite as a dependency. If `pnpm add -D vitest` fails, add vite explicitly

2. **Sharp SVG text rendering font availability**
   - What we know: Sharp uses SVG composite for text overlay, which depends on system fonts or embedded fonts
   - What's unclear: Which manga/comic fonts are available or need to be bundled for Phase 4 dialogue overlay
   - Recommendation: Out of scope for Phase 1. Note it as a Phase 4 concern. Phase 1 only needs Sharp installed and importable

3. **Node.js native TypeScript support vs tsx**
   - What we know: Node.js v25.2+ has stable native TS. System runs v20.19.5 which does NOT have stable native TS
   - What's unclear: Whether to upgrade Node.js to use native TS
   - Recommendation: Use tsx. Node v20 is LTS through April 2026. Upgrading to v25 is unnecessary risk for no gain. tsx works perfectly on v20

## Sources

### Primary (HIGH confidence)
- Sharp v0.34.5 official docs (https://sharp.pixelplumbing.com/) -- version, API, installation, TypeScript support
- Commander v14.0.3 jsDocs (https://www.jsdocs.io/package/commander) -- API signatures, subcommand patterns
- Vitest v4.0.18 official docs (https://vitest.dev/guide/) -- installation, configuration, Node.js requirements
- tsx official docs (https://tsx.is/) -- usage, features, esbuild integration
- Node.js TypeScript docs (https://nodejs.org/api/typescript.html) -- native TS support status, limitations
- Total TypeScript TSConfig Cheat Sheet (https://www.totaltypescript.com/tsconfig-cheat-sheet) -- recommended tsconfig for Node.js apps

### Secondary (MEDIUM confidence)
- npm registry version checks (via `npm view`) -- confirmed latest versions of all packages (2026-02-18)
- System verification: Node.js v20.19.5, pnpm 10.2.0 confirmed via CLI
- Sharp GitHub issue #1120 -- SVG text overlay pattern verified by maintainer

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry, all tools well-established with official docs
- Architecture: HIGH -- project structure follows established TypeScript CLI patterns, commander subcommand approach is documented standard
- Pitfalls: HIGH -- ESM extension issues, Sharp native module, package.json type field are all well-documented common issues

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days -- these are stable, mature tools)
