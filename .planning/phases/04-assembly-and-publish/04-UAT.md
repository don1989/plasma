---
status: complete
phase: 04-assembly-and-publish
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2026-02-19T09:30:00Z
updated: 2026-02-19T09:50:00Z
---

## Tests

### 1. Overlay CLI help
expected: Running `cd pipeline && pnpm dev -- overlay --help` shows --page and --pages options listed in the help output alongside -c/--chapter.
result: fixed
fix: "Changed `.requiredOption()` to `.option()` on -c/--chapter in all commands + added manual validation in action handlers. --help now renders without requiring -c first."

### 2. Overlay dry-run
expected: Running `cd pipeline && pnpm dev -- overlay -c 1 --dry-run` completes without crashing. It should log something like "No approved images found" or skip pages gracefully — not throw an uncaught exception.
result: fixed
fix: "Stripped lone '--' at argv[2] before program.parse() — pnpm injects it when using `pnpm dev -- subcommand`. Both `pnpm dev -- overlay -c 1 --dry-run` and `pnpm stage:overlay -c 1 --dry-run` now work identically."
verified: "[overlay] Complete: 0 page(s) processed, 28 skipped, 0 error(s)"

### 3. Assemble CLI help
expected: Running `cd pipeline && pnpm stage:assemble --help` shows three options: --format (jpeg/png), --quality (JPEG quality 1-100), and --gutter (pixel gap between panels).
result: pass

### 4. Assemble dry-run
expected: Running `cd pipeline && pnpm stage:assemble -c 1 --dry-run` completes without crashing. It should report no lettered images found or show a dry-run plan — not throw an uncaught exception.
result: pass
note: "Graceful Stage error: 'script.json not found' with hint to run script stage first. Clear prerequisite check, no uncaught exception."

### 5. Script stage produces script.json
expected: Running `pnpm stage:script -c 1` completes without error and produces output/ch-01/script.json with 28 pages.
result: pass
verified: "28 pages with keys [pageNumber, panels, isSplash, isDoubleSpread]. Completed in 47ms."

### 6. Prompt stage produces prompt files
expected: After running `pnpm stage:script -c 1`, running `pnpm stage:prompt -c 1` produces 28 .txt prompt files in output/ch-01/prompts/ — one per page.
result: pass
verified: "28 files (page-01.txt through page-28.txt). Completed in 31ms. Warnings for REGISTRAR and INTERCOM (unknown characters, non-blocking)."

### 7. Overlay output isolation
expected: The overlay stage reads from raw/ and writes only to lettered/. No stage overwrites upstream output.
result: pass
verified: "Code review confirms rawImagePath = chapterPaths.raw (read only), outputPath = chapterPaths.lettered (write target). Passthrough copies raw→lettered without modifying raw/."

## Summary

total: 7
passed: 5
fixed: 2
issues: 0
pending: 0
skipped: 0

## Gaps

None — all issues self-diagnosed and fixed.

## Fix Commits

Pending commit: cli.ts — `.requiredOption()` → `.option()` for all -c/--chapter options + argv[2] '--' strip for pnpm passthrough
