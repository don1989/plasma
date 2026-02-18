# Stack Research

**Domain:** AI-powered manga production pipeline (Webtoon-format digital comics)
**Researched:** 2026-02-18
**Confidence:** MEDIUM — Core tools verified (Pillow 11.2.1 confirmed installed, Python 3.11.9 confirmed). Gemini API capabilities based on training data + official model naming observed in repo. WebSearch/WebFetch unavailable during this research session; flag Gemini API specifics for validation.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.11+ | Pipeline scripting language | Already present on system (pyenv 3.11.9). Universally used for image manipulation, AI SDK calls, and file I/O. No JS ecosystem has mature equivalents for all pipeline stages. |
| Pillow | 11.2.1 | Image loading, compositing, text overlay, resizing, format conversion | Confirmed installed. Industry standard for Python image manipulation. Handles PNG/JPG I/O, ImageDraw for overlaying speech bubbles and SFX text, and vertical assembly via paste(). No real competitor for this use case in Python. |
| google-generativeai | latest (>=0.8) | Gemini API client for image generation prompting and (future) API workflow | Google's official Python SDK for Gemini. Required for programmatic access. Manual copy-paste workflow works now; SDK provides the path to full automation. Named "Nano Banana" in existing repo prompts — this is the Gemini image generation model. |
| Click | 8.x | CLI interface for pipeline scripts | Simple, decorator-based CLI with zero boilerplate. Makes pipeline stages scriptable and chainable (e.g., `python pipeline.py generate --chapter 1 --pages 1-15`). Typer is an alternative but Click has wider adoption and no Pydantic dependency. |
| Jinja2 | 3.x | Prompt template rendering | Already battle-tested for templating. Use to stamp character reference data, scene context, and style guide into per-panel prompts without string concatenation. Critical for maintainability — prompts for 48-page chapters will not survive manual string building. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | 1.26+ | Array operations for image manipulation | When Pillow operations are too slow for batch processing or when pixel-level manipulation is needed for effects (e.g., halftone screen tones). Already installed (confirmed via Pillow required-by). |
| fonttools | 4.x | Working with manga/comic fonts (TTF/OTF) | When selecting and embedding fonts for dialogue balloons and SFX text. Needed to verify font metrics before using in ImageFont. |
| PyYAML | 6.x | Pipeline configuration files | Store per-chapter config (style constants, character reference URLs, output paths) in YAML. More readable than JSON for humans editing pipeline config. |
| pypdf | 4.x / 5.x | PDF output assembly (optional) | If the pipeline needs to export PDF alongside WebP/PNG Webtoon strips. Skip if target is digital-only Webtoon. |
| tqdm | 4.x | Progress bars for batch image operations | For the assembly stage where 48 panels are being processed per chapter. Essential for knowing if a long batch job is running or hung. |
| python-dotenv | 1.x | API key management | Store `GEMINI_API_KEY` in `.env`. Never hardcode secrets. Required from Day 1, not after. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pyenv | Python version management | Already in use on the system (3.11.9). Pin the version in `.python-version` at project root. |
| venv / virtualenv | Isolated Python environment | Create a dedicated venv for the pipeline. Avoids conflicts with system Pillow (11.2.1 is global — create pipeline-specific venv to pin explicitly). |
| Makefile | Pipeline step automation | `make prompts`, `make generate`, `make assemble` as shortcuts for the multi-stage pipeline. More portable than shell scripts for this use case. |
| VS Code + Python extension | Primary editor | Existing workflow. Add `.vscode/settings.json` to enforce black + pylint. |
| black | Code formatting | Zero-config formatter. Pipeline scripts will be worked on intermittently — consistent formatting removes friction. |

---

## Installation

```bash
# Create venv
python3.11 -m venv .venv
source .venv/bin/activate

# Core
pip install Pillow==11.2.1 google-generativeai click Jinja2

# Supporting
pip install numpy fonttools PyYAML tqdm python-dotenv

# Dev
pip install black pylint

# Pin dependencies
pip freeze > requirements.txt
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pillow | OpenCV (cv2) | OpenCV is better for real-time video or complex computer vision. For static image composition (manga panels), Pillow's API is cleaner and better documented. OpenCV IS already installed (via torchvision dependency) — use it as a Pillow supplement for specific effects if needed, not as primary. |
| google-generativeai | Vertex AI Python SDK | Use Vertex AI SDK if you need Imagen 3 (higher-quality, more controllable image gen via Google Cloud). Requires a GCP project and billing. Start with google-generativeai for Gemini; migrate to Vertex if quality ceiling is hit. |
| Click | Typer | Typer adds Pydantic and type annotation magic. Good for complex apps; overkill for a pipeline with 5-6 commands. Click's simplicity wins here. |
| Jinja2 | Python f-strings | F-strings work for simple prompts. Once prompts have 10+ variables with conditionals (per-panel style overrides, character presence flags), Jinja2 templates are non-negotiable. Build with Jinja2 from the start. |
| PyYAML | TOML / JSON | TOML is increasingly standard (Python 3.11+ has `tomllib` built-in). Use TOML instead of YAML if you prefer — both work. JSON is harder for humans to write and lacks comments. |
| python-dotenv | OS environment variables | python-dotenv lets the team run the pipeline from any directory without environment setup ceremonies. Use it. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Wand (ImageMagick Python binding) | Requires ImageMagick system installation; adds a C dependency that breaks on macOS version updates and CI. Pillow does everything needed here without native deps. | Pillow |
| Stable Diffusion / ComfyUI | The project constraint is Gemini. Adding a local diffusion pipeline introduces massive complexity (GPU required, model management, LoRA training for character consistency) and contradicts the established workflow. This is a separate research question if Gemini quality is insufficient. | Gemini (as specified) |
| PIL (not Pillow) | The original PIL is dead and unmaintained since 2011. The import `from PIL import Image` works because Pillow uses the same namespace — but install Pillow, not PIL. | Pillow (same import, actively maintained) |
| requests (for Gemini API) | Raw HTTP calls to Gemini are fragile and lose automatic retry, auth handling, and SDK updates. | google-generativeai |
| Canva / Photoshop / manual tools for assembly | Not scriptable. The value of this pipeline is repeatability — if chapter 8 needs rerunning, manual tools require starting over. Everything that can be coded, must be coded. | Pillow + Python |
| FPDF / ReportLab for output | These libraries output print-ready PDFs, not Webtoon-format vertical image strips. Webtoon format is PNG or WebP images at specific dimensions (800px wide standard for Webtoon LINE). | Pillow for image output |

---

## Stack Patterns by Variant

**If API access is not yet approved (manual workflow):**
- Use Pillow + Click for stages 1 (script → prompts), 4 (assembly), and 5 (dialogue overlay)
- Stage 3 (image generation) remains manual copy-paste into Gemini
- The CLI should accept a directory of downloaded images as input for assembly
- Design the API integration as a drop-in replacement, not a rewrite

**If API access is live:**
- Use `google-generativeai` SDK with Gemini 2.0 Flash or Flash Experimental for image generation
- Add rate limiting (tqdm + sleep) — Gemini free tier has strict RPM limits
- Store generated images locally before overlay to allow rerunning stages independently

**If character consistency is still unsatisfactory after prompt engineering:**
- Investigate Gemini's image-to-image or reference image features (if available in the API version)
- Do NOT add Stable Diffusion as a fallback without a full research spike — it is a different project
- Flag this as the primary technical risk requiring a dedicated research milestone

**If Webtoon LINE publishing is the target:**
- Output: 800px wide, PNG format, max 3MB per strip
- Long vertical strip (up to ~15,000px tall) OR per-episode files split at logical chapter breaks
- Use Pillow to enforce these constraints at output time

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Pillow 11.2.1 | Python 3.11.9 | Confirmed installed together on this machine. |
| google-generativeai >=0.8 | Python 3.9+ | Works with Python 3.11. Verify latest version at install time — this SDK has been updated frequently as Gemini models evolve. |
| numpy 1.26+ | Pillow 11.x | Compatible. NumPy 2.x may have breaking changes with some older image libs; 1.26.x is the safe stable choice if pinning. |
| Click 8.x | Python 3.11 | Stable. No known conflicts. |
| Jinja2 3.x | Python 3.11 | Stable. Markupsafe dependency resolves automatically. |

---

## Gemini Image Generation — Current State

**MEDIUM confidence — verify at implementation time against official docs.**

The repo uses "Nano Banana" as the model reference, which is consistent with Google's Gemini experimental image generation models. As of research date:

- **Gemini 2.0 Flash Experimental** — supports native image generation output (not just description). Available via API. This is the most likely model in use.
- **Imagen 3** — higher quality, available via Vertex AI (not the standard Gemini API). Requires GCP project.
- **API access** — Gemini image generation has had waitlist/limited access periods. The project currently uses manual copy-paste, which suggests API access may not yet be confirmed. Validate API access status before building automated stages.

**Implication for pipeline design:** Build all stages as independently runnable. The image generation stage should be a folder of input prompts → folder of output images, whether that folder is populated by API or by hand.

---

## Pipeline-Specific Architecture Note

The pipeline has 5 discrete stages. Build each as a standalone Python script with a CLI entry point, not as a monolithic system:

```
pipeline/
├── 01_script.py      # chapter text → panel-by-panel manga script
├── 02_prompts.py     # manga script → Gemini-optimized image prompts
├── 03_generate.py    # prompts → images (API or manual folder input)
├── 04_overlay.py     # images + dialogue data → panels with text
├── 05_assemble.py    # panels → vertical Webtoon strip
├── templates/
│   ├── prompt_base.j2        # Jinja2 base style template
│   └── character_refs.yaml   # character visual constants
├── fonts/
│   └── [manga fonts]         # comic/anime-style TTF fonts
├── config.yaml               # chapter-level config
└── requirements.txt
```

This staging means:
- Any stage can be rerun independently without rerunning upstream stages
- Manual image generation fits naturally into Stage 3 (drop images into folder, run Stage 4)
- Chapter 2, 3, ... follow the exact same flow as Chapter 1

---

## Sources

- Pillow 11.2.1 — confirmed installed on system (`pip show pillow` output)
- Python 3.11.9 — confirmed via pyenv on system
- "Nano Banana" model reference — observed in `/Users/dondemetrius/Code/plasma/03_manga/prompts/character-sheets.md` and `pages-01-to-15.md`
- Existing prompt structure — read from `/Users/dondemetrius/Code/plasma/03_manga/prompts/`
- Pipeline stage requirements — derived from `/Users/dondemetrius/Code/plasma/.planning/PROJECT.md`
- google-generativeai SDK existence — training data (MEDIUM confidence; verify version at install)
- Gemini 2.0 Flash Experimental image generation — training data (MEDIUM confidence; verify API access status)
- NumPy, torchvision, diffusers — confirmed installed (visible in Pillow required-by output)

---
*Stack research for: AI-powered manga production pipeline (Webtoon format)*
*Researched: 2026-02-18*
