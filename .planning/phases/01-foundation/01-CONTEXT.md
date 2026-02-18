# Phase 1: Foundation - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

TypeScript pipeline infrastructure with CLI scaffolding, directory conventions, and stage entry points. The pipeline lives in `pipeline/` and reads from existing story directories (`01_bible/`, `03_manga/`) but writes only to `output/`. Each pipeline stage is independently invokable via CLI.

</domain>

<decisions>
## Implementation Decisions

### Project setup
- Package manager: pnpm
- TypeScript config: strict mode (strict: true, no implicit any, null checks)
- Testing: vitest from day 1 — test infrastructure set up in Phase 1
- All work on feature branches, never commit to main

### Claude's Discretion
- Build tooling choice (tsx for dev, tsup for build, or alternatives) — pick what's fastest for this pipeline's needs
- CLI framework selection (commander, yargs, oclif, or custom)
- Directory layout within `pipeline/` (flat vs nested, where config lives)
- Stage scaffolding approach (shared types, inter-stage data contracts)
- How stages discover and read from story directories (config file paths, relative paths, environment variables)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is separation: pipeline code in `pipeline/`, output in `output/`, story content untouched.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-18*
