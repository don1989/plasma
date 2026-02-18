# Requirements: Plasma Manga Pipeline

**Defined:** 2026-02-18
**Core Value:** A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scripting

- [ ] **SCRP-01**: Pipeline can convert a prose story chapter into a structured panel-by-panel manga script following manga-script.md rules
- [ ] **SCRP-02**: Generated scripts include shot types, panel composition notes, dialogue, and SFX per panel
- [ ] **SCRP-03**: Script validation checks panel counts (4-7 per page), pacing rules, and required shot types

### Prompt Engineering

- [ ] **PRMT-01**: Pipeline generates Gemini-optimized art prompts from manga scripts, one prompt per page
- [ ] **PRMT-02**: Every prompt embeds the full character visual description inline (prompt fingerprint system)
- [ ] **PRMT-03**: Style guide prefix is locked verbatim and included in every prompt automatically
- [ ] **PRMT-04**: Jinja2-style template library manages character blocks, style prefix, and setting descriptions
- [ ] **PRMT-05**: Templates can be updated in one place and propagate to all generated prompts

### Image Generation

- [ ] **IGEN-01**: Pipeline supports manual Gemini workflow (copy-paste prompts, organize downloaded images)
- [ ] **IGEN-02**: Pipeline supports automated Gemini API workflow via @google/generative-ai SDK
- [ ] **IGEN-03**: Panel images follow naming convention: ch01_p003_v1.png (chapter, page, version)
- [ ] **IGEN-04**: Prompt-to-image tracking records which prompt produced which approved image

### Character Consistency

- [ ] **CHAR-01**: Locked prompt fingerprint exists for each character — tested and validated description block
- [ ] **CHAR-02**: Per-panel QC checklist compares generated panels against character reference sheets
- [ ] **CHAR-03**: New character introduction workflow generates reference sheets before chapter prompts
- [ ] **CHAR-04**: Character reference data stored in structured format (YAML/JSON) for template injection

### Dialogue & Text

- [ ] **TEXT-01**: Programmatic dialogue overlay renders speech balloons and text onto panel images using Sharp
- [ ] **TEXT-02**: Dialogue data extracted from scripts into structured format (JSON) for overlay processing

### Assembly & Output

- [ ] **ASSM-01**: Pipeline assembles panels into vertical-scroll Webtoon strips (800px wide)
- [ ] **ASSM-02**: Output is Webtoon Canvas-compatible (JPG/PNG at correct dimensions)
- [ ] **ASSM-03**: Splash pages and double-spreads handled with appropriate aspect ratio assembly
- [ ] **ASSM-04**: Intermediate artifacts preserved at each stage (raw/, processed/, lettered/, webtoon/)

### Infrastructure

- [ ] **INFR-01**: All pipeline code lives in a separate `pipeline/` directory, decoupled from story content
- [ ] **INFR-02**: Pipeline is built in TypeScript with Sharp for image processing
- [ ] **INFR-03**: Pipeline reads from existing story directories (01_bible/, 03_manga/) but never writes to them
- [ ] **INFR-04**: CLI interface allows running each pipeline stage independently
- [ ] **INFR-05**: All work committed to feature branches, never directly to main

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Generation

- **ADVG-01**: Reference image injection alongside text prompts for character consistency (if Gemini API supports)
- **ADVG-02**: Automated visual continuity checking (diff panels against reference sheets)
- **ADVG-03**: Color normalization pass across all panels in a chapter

### Scaling

- **SCAL-01**: Batch prompt generation for entire chapters in one pass
- **SCAL-02**: Script generation for multiple chapters in sequence
- **SCAL-03**: Pipeline runner that orchestrates all stages for a chapter end-to-end

### Text & Lettering

- **LETR-01**: SFX visual design system with curated manga lettering fonts
- **LETR-02**: Dialogue balloon placement map specified per-panel in scripts
- **LETR-03**: Multiple balloon styles (speech, thought, shout, whisper, narration)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Game development | Separate future project |
| Story writing / chapter creation | Chapters written separately, pipeline only converts |
| Print-ready formatting | Digital-first (Webtoon vertical scroll only) |
| Hiring/managing human artists | AI generation only |
| Animation / motion manga | Static panels only |
| Custom AI model training | Too complex for project scale; prompt engineering approach instead |
| Custom Webtoon reader UI | Upload to Webtoon Canvas for distribution |
| AI-rendered text in images | Garbled/unreliable — always programmatic overlay |
| Modifying existing story files | Pipeline reads from 01_bible/, 03_manga/ but never writes to them |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCRP-01 | Phase 2 | Pending |
| SCRP-02 | Phase 2 | Pending |
| SCRP-03 | Phase 2 | Pending |
| PRMT-01 | Phase 2 | Pending |
| PRMT-02 | Phase 2 | Pending |
| PRMT-03 | Phase 2 | Pending |
| PRMT-04 | Phase 2 | Pending |
| PRMT-05 | Phase 2 | Pending |
| IGEN-01 | Phase 3 | Pending |
| IGEN-02 | Phase 3 | Pending |
| IGEN-03 | Phase 3 | Pending |
| IGEN-04 | Phase 3 | Pending |
| CHAR-01 | Phase 2 | Pending |
| CHAR-02 | Phase 2 | Pending |
| CHAR-03 | Phase 2 | Pending |
| CHAR-04 | Phase 2 | Pending |
| TEXT-01 | Phase 4 | Pending |
| TEXT-02 | Phase 4 | Pending |
| ASSM-01 | Phase 4 | Pending |
| ASSM-02 | Phase 4 | Pending |
| ASSM-03 | Phase 4 | Pending |
| ASSM-04 | Phase 4 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation — all 27 requirements mapped*
