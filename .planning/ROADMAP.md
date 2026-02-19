# Roadmap: Plasma Manga Pipeline

## Overview

Build a repeatable TypeScript pipeline that transforms Plasma story chapters into publish-ready Webtoon manga pages. The pipeline is built stage by stage in the order data flows through it: infrastructure first, then scripting and prompt generation, then image workflow, then assembly and output. Chapter 1 is the proving ground — when it produces a publishable Webtoon episode, the pipeline is valid for every subsequent chapter.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - TypeScript pipeline infrastructure, CLI, and directory conventions
- [ ] **Phase 2: Scripts, Characters, and Prompts** - Manga script generation, character fingerprint system, and Jinja2-style prompt templates
- [ ] **Phase 3: Image Generation Workflow** - Manual and API Gemini workflows with naming conventions and prompt-to-image tracking
- [ ] **Phase 4: Assembly and Publish** - Dialogue overlay, vertical Webtoon strip assembly, and Canvas-ready output

## Phase Details

### Phase 1: Foundation
**Goal**: A working TypeScript pipeline project exists with CLI, stage scaffolding, and read-only access to story directories
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. Running `pipeline/` TypeScript code from CLI produces output without errors
  2. Each pipeline stage can be invoked independently via CLI flags (e.g., `npm run stage:script`)
  3. Pipeline reads from `01_bible/` and `03_manga/` but writes only to `output/`
  4. All work exists on a feature branch, never committed to main
**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md — Pipeline project setup with CLI, stage stubs, types, path resolution, and tests

### Phase 2: Scripts, Characters, and Prompts
**Goal**: Any Plasma chapter can be converted to a panel-by-panel manga script with validated prompts that lock character visuals verbatim
**Depends on**: Phase 1
**Requirements**: SCRP-01, SCRP-02, SCRP-03, CHAR-01, CHAR-02, CHAR-03, CHAR-04, PRMT-01, PRMT-02, PRMT-03, PRMT-04, PRMT-05
**Success Criteria** (what must be TRUE):
  1. Pipeline converts a prose chapter into a structured script with shot types, panel composition, dialogue, and SFX per panel
  2. Generated script is validated against manga-script.md rules (4-7 panels/page, required shot types) and reports violations
  3. Each character has a locked prompt fingerprint in structured YAML/JSON that the template system injects verbatim into every prompt
  4. Running the prompt generator for a chapter produces one Gemini-optimized prompt per page with style guide prefix and character blocks embedded — no manual copy-pasting of character descriptions required
  5. Updating a character fingerprint in one place propagates to all prompts on the next generation run
**Plans:** 5 plans

Plans:
- [x] 02-01-PLAN.md — Install dependencies, expand types, create Zod validation schemas
- [x] 02-02-PLAN.md — Build markdown script parser and wire into script stage
- [x] 02-03-PLAN.md — Create character YAML fingerprints, registry, and CLI subcommand
- [x] 02-04-PLAN.md — Build Nunjucks template engine and prompt generator stage
- [ ] 02-05-PLAN.md — Build per-panel QC checklist for character verification

### Phase 3: Image Generation Workflow
**Goal**: Prompts flow to Gemini (manually or via API) and resulting images are organized with full traceability from prompt to approved file
**Depends on**: Phase 2
**Requirements**: IGEN-01, IGEN-02, IGEN-03, IGEN-04
**Success Criteria** (what must be TRUE):
  1. Copy-pasting a generated prompt into Gemini web UI and saving the result produces a file named `ch01_p003_v1.png` in the correct output directory
  2. Automated Gemini API workflow generates images into `output/ch-NN/raw/` by running a single CLI command
  3. A prompt-to-image log records which exact prompt produced which approved image file for every panel
**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — Generation types, panel image naming convention, and manifest module (TDD)
- [ ] 03-02-PLAN.md — Manual Gemini workflow with image import, CLI expansion, and manifest tracking
- [ ] 03-03-PLAN.md — Automated Gemini API workflow with @google/genai SDK and rate limiting

### Phase 4: Assembly and Publish
**Goal**: Approved raw panel images become a complete, Webtoon Canvas-ready episode with programmatic dialogue, SFX, and vertical-scroll assembly
**Depends on**: Phase 3
**Requirements**: TEXT-01, TEXT-02, ASSM-01, ASSM-02, ASSM-03, ASSM-04
**Success Criteria** (what must be TRUE):
  1. Running the dialogue overlay stage produces lettered panel images with readable speech balloons — no dialogue was baked into the AI-generated art
  2. Running the assembler produces a vertical-scroll Webtoon strip at 800px wide, Webtoon Canvas-compatible (JPG/PNG at correct dimensions)
  3. Splash pages and double-spreads are assembled with correct aspect ratios — not treated as standard panels
  4. Intermediate artifacts exist in separate directories (`raw/`, `processed/`, `lettered/`, `webtoon/`) and no stage overwrites upstream output
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-02-18 |
| 2. Scripts, Characters, and Prompts | 4/5 | In Progress | - |
| 3. Image Generation Workflow | 0/3 | Not started | - |
| 4. Assembly and Publish | 0/TBD | Not started | - |
