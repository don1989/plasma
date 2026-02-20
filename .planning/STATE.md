# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.
**Current focus:** v2.0 — Phase 8: Spyke LoRA Training

## Current Position

Phase: 8 — Spyke LoRA Training
Plan: 2 of 3 (08-02 complete — 1840-step training run done, 10 checkpoints produced, step 1400 is loss minimum)
Status: In Progress (2/3 plans done: 08-01 env setup + 08-02 full training run complete)
Last activity: 2026-02-20 — 08-02 complete: 1840-step training run finished, 10 safetensors checkpoints at 72MB each, loss U-curve minimum at step 1400 (avr_loss=0.0717)

Progress: [#########_] ~88% (v2.0 Phase 8 in progress — 08-02 done, 08-03 checkpoint selection next)

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 9.8 min (skewed by 67-min 05-03 download-heavy plan)
- Total execution time: 1.95 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 1 | 4 min | 4 min |
| 2. Scripts/Characters | 4 | 28 min | 7.0 min |
| 3. Image Generation | 3 | 15 min | 5.0 min |
| 4. Assembly & Publish | 2 | 7 min | 3.5 min |
| 5. Environment Validation | 4 | 93 min | 23.3 min |
| 6. Spyke Dataset Prep | 1 | 3 min | 3.0 min |
| 7. ComfyUI + Express | 3 | 16 min | 5.3 min |
| 8. Spyke LoRA Training | 2 | 159 min | 79.5 min |

**Recent Trend:**
- Last 5 plans: 07-01 (3 min — Express scaffold), 07-02 (5 min — WebSocket client + job dispatch), 07-03 (8 min — generate.ts CLI wiring)
- Trend: Stable at 3-5 min for integration plans

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Pipeline is TypeScript (not Python as research assumed) with Sharp for image processing
- [Init]: All pipeline code lives in `pipeline/` directory, decoupled from story content
- [Init]: Text in panels is always programmatic overlay — never baked into AI-generated art
- [Init]: Manual Gemini workflow (copy-paste) is a first-class path; API automation is upgrade, not prerequisite
- [01-01]: Commander v14 for CLI (zero deps, native TS types, subcommand-per-stage pattern)
- [01-01]: assertSourceDir throws on missing dirs (fail fast with descriptive errors)
- [01-01]: output/ at project root as sibling to 01_bible/, not inside pipeline/
- [01-01]: pnpm.onlyBuiltDependencies for Sharp/esbuild native build approval
- [02-01]: z.string() for shotType (not enum) — scripts have compound types like "Wide (Action)"
- [02-01]: Warning-level panel count check instead of hard rejection — action montages break 4-7 range
- [02-01]: Zod v4 .check() API with input field for custom refinement issues
- [02-01]: Schema + z.infer type co-export pattern for all schema files
- [02-02]: 28 page headings in chapter-01-script.md (not 29) — double-page spread 25-26 has single heading
- [02-02]: MDAST paragraph child walking for field extraction — remark merges consecutive lines into single paragraph
- [02-02]: Dialogue list items split on Strong field labels to separate dialogue from trailing SFX/Notes
- [02-02]: Off-panel speech is type 'speech' — off-panel is position modifier, not dialogue type
- [02-03]: Removed CharacterRegistry type alias, replaced by CharacterRegistry class with richer functionality
- [02-03]: CLI ref-sheet uses string concatenation (not Nunjucks) for immediate utility before template engine
- [02-03]: Character fingerprints sourced verbatim from tested prompts in 03_manga/prompts/
- [02-04]: Establishing shot detection limited to page 1 Wide shots + pages with establishing/panorama keywords
- [02-04]: Narrator excluded from character extraction -- narration boxes have no visual character to fingerprint
- [02-04]: Character fingerprints deduplicated by id per panel -- prevents duplicates from name+alias matches
- [02-04]: Layout description uses count-based text (vertical layout for 2-3, layout for 4+) matching hand-written style
- [03-01]: readdirSync for nextVersion scan -- synchronous is fine for small directories, avoids async complexity
- [03-01]: generation-log.json filename for manifest -- descriptive, avoids collision with other chapter metadata
- [03-01]: getApprovedEntry returns latest by timestamp when multiple approved -- supports re-approval workflow
- [03-02]: mode defaults to 'manual' when omitted -- manual is the first-class workflow path
- [03-02]: importImage copies (never moves) source files -- user's original is always preserved
- [03-02]: approveImage enforces single-approved-per-page -- approving v2 automatically unapproves v1
- [03-02]: JPEG extension normalized to jpg in filenames -- consistency with common convention
- [03-03]: Dry-run checked before API key validation so --dry-run works without a configured key
- [03-03]: loadEnvFile inline helper avoids dotenv dependency for minimal .env parsing
- [03-03]: vi.hoisted() pattern for vitest mocks that need constructor-safe references
- [04-01]: SVG-to-Buffer balloon rendering — Sharp composites SVG buffers directly, no temp files needed
- [04-01]: Zone-based balloon placement divides image height by panel count, alternates left-right
- [04-01]: Thought bubbles use dashed-stroke ellipse (not trailing circles) for v1 simplicity
- [04-01]: Passthrough mode copies raw to lettered when page has no dialogue/SFX — maintains stage chain
- [04-01]: OverlayOptions interface separate from StageOptions for page/pages filtering
- [v2.0 Roadmap]: ComfyUI install outside repo at ~/tools/ComfyUI — sidecar pattern, not embedded dependency
- [v2.0 Roadmap]: Phase 10 (ControlNet) depends on Phase 7 (Express service) and Phase 5 (OpenPose model) — can run in parallel with Phase 8/9
- [v2.0 Roadmap]: GEN-04 split across Phase 7 (template + slot definition) and Phase 9 (LoRA wired into slot after training)
- [v2.0 Roadmap]: Reproducibility defined as visually consistent same-character same-pose, not pixel-identical — MPS non-determinism is a hardware fact
- [05-01]: PyTorch 2.5.1 installed from cpu index URL (arm64 MPS wheel) — NOT nightly; 2.5.1 stable is confirmed working, nightly introduces breakage risk
- [05-01]: ComfyUI-Manager cloned before first launch — Manager is detected at startup, not dynamically loaded
- [05-01]: models/controlnet/ created in plan 01 so plan 03 curl only needs to drop the file
- [05-02]: Do not use requirements_macos_arm64.txt — references torch==2.8.0.* nightly (broken, GitHub issue #3281); manual pip install is correct path
- [05-02]: accelerate mixed_precision must be 'no' — fp16 triggers ValueError on MPS (PyTorch AMP autocast does not support mps+fp16)
- [05-02]: write_basic_config() sets use_cpu: true by default; manual YAML override needed to enforce use_cpu: false per spec
- [05-02]: Omit bitsandbytes, xformers, triton from kohya_ss install — CUDA/Linux-only, incompatible with Apple Silicon
- [05-03]: AnythingXL_inkBase.safetensors accepted as equivalent substitute for anything-v5-PrtRE.safetensors — same SD 1.5 architecture, ComfyUI accepts any filename, no hardcoded path in pipeline
- [05-03]: control_v11p_sd15_openpose.pth is 1.3 GiB on macOS (1378 MB base-10 / 1024 = 1.35 GiB binary) — correct download size, not truncated
- [05-03]: Plan 04 benchmark workflow must reference AnythingXL_inkBase by actual filename, not plan-spec anything-v5-PrtRE filename
- [05-04]: INFRA-04 benchmark result: 15s for 512x512 20-step euler_ancestral — 8x under 120s threshold; Phase 7 job timeout should be ~90s with comfortable headroom
- [05-04]: /system_stats is the correct ComfyUI health check endpoint (not /health, which does not exist); MPS detection via response.devices[0].type === "mps"
- [05-04]: Phase 5 gate PASS on all five INFRA criteria — Phases 6 and 7 are unblocked
- [Phase 06]: Standalone crop script uses manual process.argv (not Commander) for single --dry-run flag — zero dep overhead
- [Phase 06]: crop-spyke.ts dry-run writes to preview/ subdir — protects final output, allows safe inspection
- [Phase 06]: ref-sheet _back crop left coord corrected from 790 to 784 (1024px image; 790+240=1030 out of bounds)
- [Phase 06]: spyke_final_calm crop is SPECULATIVE — must be visually confirmed or excluded at Plan 02 review checkpoint
- [07-01]: Zod v4 ZodError uses .issues not .errors — updated router.ts error extraction with optional chaining
- [07-01]: POST /jobs returns 202 immediately; fire-and-forget setImmediate stub for Plan 02 WebSocket dispatch
- [07-01]: SAVE_NODE_ID = '7' in txt2img-lora.json (SaveImage node) — needed by comfyui-client.ts in Plan 02
- [07-01]: mps: true hardcoded in /health response — confirmed by Phase 5 benchmark (MPS active on this machine)
- [07-02]: slotFill() called with lowercase keys — plan spec used uppercase which silently no-ops all token replacements
- [07-02]: lora_name hardcoded to empty string in Phase 7 — Phase 9 wires real LoRA name into this slot
- [07-02]: chapter/page added as optional fields to jobRequestSchema — Plan 03 CLI will populate these
- [07-02]: End-to-end verified: POST /jobs -> WS open -> 20-step generation -> ch01_p001_v1.png (544KB) at output/ch-01/raw/comfyui/
- [07-03]: No default generate mode — --comfyui, --api, or --manual must be explicit; bare -c 1 exits with clear error
- [07-03]: Version counter scans both raw/ and raw/comfyui/ — max() ensures no filename collision on approve-and-copy promote
- [07-03]: JSON.stringify(s).slice(1,-1) in slotFill for all string tokens — handles newlines, em-dashes, control chars that break raw JSON template injection
- [07-03]: approve-and-copy is lazy post-approve check: approveImage() sets flag, then generate.ts loads manifest, detects source=comfyui, copies file
- [07-03]: argv stripping extended to handle '--' at argv[3] for pnpm stage:* scripts (was only argv[2] for pnpm dev)
- [08-01]: sd-scripts submodule was empty on this machine — git submodule update --init --recursive from ~/tools/kohya_ss is required before any training command
- [08-01]: Missing Python deps (imagesize, rich, sentencepiece, altair, lion-pytorch, schedulefree, pytorch-optimizer, prodigy-plus-schedule-free, prodigyopt) must be pip-installed into kohya_ss venv; requirements.txt alone is insufficient on Apple Silicon
- [08-01]: flip_aug excluded from dataset TOML by design — Spyke's costume asymmetry makes horizontal flip destructive to character consistency
- [08-01]: Full training command flags locked and validated by smoke test: --no_half_vae --mixed_precision=no --optimizer_type=AdamW --network_dim=32 --network_alpha=16
- [08-01]: Smoke test pattern: always run --max_train_steps=5 before full run to validate environment in 30-90s vs 70+ minutes
- [08-02]: TOML num_repeats=10 + folder prefix 10_ are ADDITIVE — resulted in 20 repeats/epoch (1840 steps not 920). For future runs: use folder prefix OR TOML repeat, not both.
- [08-02]: Loss U-curve pattern: 0.0786 (step 1000) → 0.0717 (step 1400 minimum) → 0.0855 (step 1840). Step 1400 is lowest-loss checkpoint, likely sweet spot before overfitting.
- [08-02]: 10 checkpoint files generated (steps 200–1800 every 200 + final at 1840), all 72MB each.

### Pending Todos

None.

### Blockers/Concerns

- Gemini API image generation access status is unknown — IGEN-02 code is complete but untested with real API key (requires Cloud Billing setup)
- Phase 5 gate cleared — ComfyUI running, MPS confirmed, health check works (Phase 7 unblocked)
- Phase 6 gates Phase 8 — dataset minimum (15-20 images) must be met before any training is attempted; skipping this is the highest-probability failure mode
- Phase 8: 08-02 training complete (1840 steps, 10 checkpoints) — 08-03 checkpoint selection is next; step 1400 is primary candidate (lowest loss)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 08-02-PLAN.md (1840-step training run, 10 checkpoints produced, step 1400 is loss minimum — LORA-01 + LORA-02 satisfied).
Resume file: .planning/phases/08-spyke-lora-training/08-03-PLAN.md (checkpoint selection — test step 1400 first in ComfyUI, deploy best to loras/)
