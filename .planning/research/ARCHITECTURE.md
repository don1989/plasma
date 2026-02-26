# Architecture Research: Blender 3D Rendering Pipeline Integration

**Domain:** Blender 3D rendering integrated into an existing TypeScript manga production pipeline
**Researched:** 2026-02-25
**Confidence:** HIGH — based on direct inspection of all existing source files. No external verification needed for the integration architecture; the TypeScript pipeline code and Python Blender scripts are fully readable.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MANGA PIPELINE (v3.0)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  STAGE 1          STAGE 2          STAGE 3 (MODIFIED)                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────────────┐   │
│  │  script  │───▶│  prompt  │───▶│            generate              │   │
│  │ (no chg) │    │ (no chg) │    │  mode: blender | manual | api    │   │
│  └──────────┘    └──────────┘    └─────────────┬────────────────────┘   │
│                                                 │                        │
│                             ┌───────────────────┘                        │
│                             │  output/ch-NN/raw/chNN_pNNN_vN.png         │
│                             ▼                                            │
│  STAGE 4          STAGE 5                                                │
│  ┌──────────┐    ┌──────────┐                                           │
│  │  overlay │───▶│ assemble │───▶ output/ch-NN/webtoon/                 │
│  │ (no chg) │    │ (no chg) │                                           │
│  └──────────┘    └──────────┘                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                        BLENDER SUBSYSTEM (NEW)                           │
│                                                                          │
│  ┌──────────────┐   ┌─────────────────┐   ┌────────────────────────┐   │
│  │ pose-map.ts  │   │  blender-        │   │  render_panel.py       │   │
│  │ (new)        │   │  runner.ts (new) │   │  (new Blender script)  │   │
│  │              │   │                 │   │                        │   │
│  │ script.json  │   │  child_process  │   │  • applies pose        │   │
│  │ shotType +   │──▶│  .execFile()    │──▶│  • selects camera      │   │
│  │ action       │   │  blender --bg   │   │  • renders to PNG      │   │
│  │ → pose key   │   │  --python       │   │  • writes to raw/      │   │
│  │ → camera key │   │  render_panel.py│   │                        │   │
│  └──────────────┘   └─────────────────┘   └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Status |
|-----------|---------------|--------|
| `pipeline/src/stages/script.ts` | Parse Markdown chapter → `script.json` with `shotType` and `action` fields per panel | Unchanged |
| `pipeline/src/stages/prompt.ts` | Generate AI art prompts from `script.json` | Unchanged — not used for Blender panels, but keep for background-only panels |
| `pipeline/src/stages/generate.ts` | Orchestrate image generation; add `mode === 'blender'` branch | Modified (additive) |
| `pipeline/src/blender/pose-map.ts` | Map `Panel.shotType` + `Panel.action` → `{pose, camera}` tuple for Blender | New |
| `pipeline/src/blender/blender-runner.ts` | Spawn Blender headless process via `child_process.execFile()`, pass render args, poll for output file | New |
| `pipeline/src/blender/types.ts` | TypeScript types: `BlenderRenderRequest`, `BlenderRenderResult`, `PoseMapEntry` | New |
| `3d_models/render/render_panel.py` | Single-panel Blender render script — accepts pose + camera + output path as CLI args, renders one PNG | New |
| `3d_models/render/render_poses.py` | Existing batch render script — unchanged, used for reference sheet generation | Unchanged |
| `pipeline/src/stages/overlay.ts` | Composite speech balloons and SFX onto raw renders | Unchanged |
| `pipeline/src/stages/assemble.ts` | Stack lettered panels into Webtoon vertical strip | Unchanged |
| `pipeline/src/generation/manifest.ts` | Track every generation attempt and approval state | Modified (additive — new `source: 'blender'` value) |
| `pipeline/src/types/generation.ts` | `GenerationLogEntry` type | Modified (additive — add `source: 'blender'` and `blenderPose`, `blenderCamera` fields) |

---

## Data Flow: Script to Webtoon

### Complete Data Flow

```
03_manga/chapter-01-script.md
    │
    │  pnpm stage:script -c 1
    ▼
output/ch-01/script.json
    │  Chapter.pages[].panels[].shotType  (e.g. "MEDIUM-WIDE")
    │  Chapter.pages[].panels[].action    (e.g. "Spyke sprints along walkway")
    │
    │  pnpm stage:generate -- --blender -c 1 --page 3
    ▼
pipeline/src/stages/generate.ts  [mode === 'blender']
    │
    │  reads script.json for page 3
    │  reads panel.shotType + panel.action
    │
    ▼
pipeline/src/blender/pose-map.ts
    │  mapPanelToBlenderArgs(panel) → { pose: 'walking', camera: 'Cam_Front' }
    │
    │  Mapping logic (defined in a static lookup table):
    │  shotType 'WIDE'              → camera: 'Cam_Front',      pose: 'standing_relaxed'
    │  shotType 'MEDIUM-WIDE'       → camera: 'Cam_Front',      pose: 'walking' (if action contains 'sprint/run/walk')
    │  shotType 'MEDIUM'            → camera: 'Cam_UpperBody',  pose: 'standing_relaxed'
    │  shotType 'CLOSE-UP'          → camera: 'Cam_Portrait',   pose: 'standing_relaxed'
    │  shotType '3/4'               → camera: 'Cam_ThreeQuarter', pose: 'standing_relaxed'
    │  action contains 'battle'     → pose: 'battle_ready'
    │  action contains 'katana'     → pose: 'drawing_katana'
    │
    ▼
pipeline/src/blender/blender-runner.ts
    │  const blenderPath = process.env.BLENDER_PATH ?? '/Applications/Blender.app/Contents/MacOS/blender'
    │  const blendFile  = '3d_models/output/spyke/spyke.blend'
    │  const outputPath = 'output/ch-01/raw/ch01_p003_v1.png'
    │
    │  child_process.execFile(blenderPath, [
    │    blendFile,
    │    '--background',
    │    '--python', '3d_models/render/render_panel.py',
    │    '--',
    │    '--pose',   'walking',
    │    '--camera', 'Cam_Front',
    │    '--output', outputPath,
    │  ])
    │
    ▼
3d_models/render/render_panel.py  (Blender Python, runs inside Blender process)
    │  1. parse CLI args after '--'
    │  2. find Spyke_Armature in scene
    │  3. apply_pose(armature, POSES[pose])     (reuse from render_poses.py)
    │  4. bpy.context.scene.camera = bpy.data.objects[camera]
    │  5. bpy.context.scene.render.filepath = output_path
    │  6. bpy.ops.render.render(write_still=True)
    │  7. exit(0)
    │
    │  Output: output/ch-01/raw/ch01_p003_v1.png  (800×1200 PNG, RGBA)
    │
    ▼
pipeline/src/stages/generate.ts
    │  verifies output file exists
    │  adds entry to generation-log.json:
    │    { source: 'blender', blenderPose: 'walking', blenderCamera: 'Cam_Front', approved: false }
    │
    │  pnpm stage:generate -- --approve ch01_p003_v1.png -c 1
    ▼
output/ch-01/raw/ch01_p003_v1.png  (approved)

    │  pnpm stage:overlay -c 1
    ▼
overlay.ts reads manifest, finds approved entry,
loads raw/ch01_p003_v1.png, composites dialogue balloons → lettered/ch01_p003_v1.png

    │  pnpm stage:assemble -c 1
    ▼
output/ch-01/webtoon/strip-001.jpg
```

### Key Insight: Overlay and Assemble Are Unmodified

The overlay stage reads `raw/{imageFile}` where `imageFile` comes from the generation manifest. It does not care how the image was produced — Gemini, ComfyUI, or Blender. As long as the Blender render lands at `output/ch-NN/raw/chNN_pNNN_vN.png` and has an approved manifest entry, overlay and assemble work with zero changes.

---

## New Components

### 1. `pipeline/src/blender/pose-map.ts`

Maps panel metadata to Blender render parameters. This is the translation layer between the TypeScript script model and the Blender Python world.

```typescript
// pipeline/src/blender/pose-map.ts

export interface BlenderPanelArgs {
  pose: string;      // One of the POSES keys in render_poses.py
  camera: string;    // One of the Cam_* names in render_setup.py
}

const SHOT_TYPE_TO_CAMERA: Record<string, string> = {
  'WIDE':         'Cam_Front',
  'MEDIUM-WIDE':  'Cam_Front',
  'MEDIUM':       'Cam_UpperBody',
  'CLOSE-UP':     'Cam_Portrait',
  'PORTRAIT':     'Cam_Portrait',
  '3/4':          'Cam_ThreeQuarter',
  'SIDE':         'Cam_Side',
};

const ACTION_TO_POSE: Array<{ keywords: string[]; pose: string }> = [
  { keywords: ['sprint', 'run', 'walk', 'stride'], pose: 'walking' },
  { keywords: ['battle', 'fight', 'stance', 'combat'], pose: 'battle_ready' },
  { keywords: ['katana', 'draw', 'iaijutsu', 'unsheathe'], pose: 'drawing_katana' },
  // Default: standing_relaxed
];

export function mapPanelToBlenderArgs(panel: Panel): BlenderPanelArgs {
  const camera = SHOT_TYPE_TO_CAMERA[panel.shotType.toUpperCase()] ?? 'Cam_Front';

  const lowerAction = panel.action.toLowerCase();
  let pose = 'standing_relaxed';
  for (const rule of ACTION_TO_POSE) {
    if (rule.keywords.some(kw => lowerAction.includes(kw))) {
      pose = rule.pose;
      break;
    }
  }

  return { pose, camera };
}
```

**Important:** The pose and camera key lists here must stay in sync with `POSES` and `REFERENCE_VIEWS` in `render_poses.py`. When new poses are added to the Python side, add them here. This is the only coupling point between TypeScript and Python code.

### 2. `pipeline/src/blender/blender-runner.ts`

Spawns Blender as a child process and waits for the output file.

```typescript
// pipeline/src/blender/blender-runner.ts

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface BlenderRenderRequest {
  blendFile: string;    // absolute path to spyke.blend
  renderScript: string; // absolute path to render_panel.py
  pose: string;
  camera: string;
  outputPath: string;   // absolute path for the output PNG
}

export interface BlenderRenderResult {
  outputPath: string;
  durationMs: number;
}

export async function renderWithBlender(
  req: BlenderRenderRequest
): Promise<BlenderRenderResult> {
  const blenderBin = process.env['BLENDER_PATH'] ?? '/Applications/Blender.app/Contents/MacOS/blender';
  const startTime = Date.now();

  const args = [
    req.blendFile,
    '--background',
    '--python', req.renderScript,
    '--',
    '--pose',   req.pose,
    '--camera', req.camera,
    '--output', req.outputPath,
  ];

  try {
    const { stdout, stderr } = await execFileAsync(blenderBin, args, {
      timeout: 120_000,  // 2 minutes max for a single frame on M1 Pro
    });

    if (process.env['BLENDER_VERBOSE']) {
      console.log('[blender] stdout:', stdout.slice(-500));
      if (stderr) console.warn('[blender] stderr:', stderr.slice(-200));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Blender render failed: ${msg}`);
  }

  if (!existsSync(req.outputPath)) {
    throw new Error(`Blender exited cleanly but output not found at: ${req.outputPath}`);
  }

  return { outputPath: req.outputPath, durationMs: Date.now() - startTime };
}
```

**Why `execFile` over `spawn`:** The render is synchronous per panel. There is no streaming output needed. `execFile` with `await` is the simplest model — wait for Blender to exit, check the file exists, continue. EEVEE renders for a single frame on M1 Pro take approximately 3-15 seconds depending on scene complexity.

### 3. `3d_models/render/render_panel.py`

New single-panel render script. Reuses `apply_pose()` and `POSES` from `render_poses.py` but renders exactly one frame to a caller-specified path.

```python
# 3d_models/render/render_panel.py
"""
Single-panel render script — render one pose + camera to a specific output path.
Called by the TypeScript pipeline via blender-runner.ts.

Usage (always via blender-runner.ts, not direct):
  blender spyke.blend --background --python render_panel.py -- \
    --pose walking --camera Cam_Front --output /path/to/ch01_p003_v1.png
"""

import bpy
import os
import sys
import math
from mathutils import Euler

# Reuse POSES from render_poses.py
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from render_poses import POSES, apply_pose

def parse_args():
    args = { 'pose': 'standing_relaxed', 'camera': 'Cam_Front', 'output': None }
    if '--' in sys.argv:
        argv = sys.argv[sys.argv.index('--') + 1:]
        i = 0
        while i < len(argv):
            if argv[i] == '--pose'   and i + 1 < len(argv): args['pose']   = argv[i+1]; i += 2
            elif argv[i] == '--camera' and i + 1 < len(argv): args['camera'] = argv[i+1]; i += 2
            elif argv[i] == '--output' and i + 1 < len(argv): args['output'] = argv[i+1]; i += 2
            else: i += 1
    return args

def main():
    args = parse_args()
    if not args['output']:
        print('ERROR: --output is required')
        sys.exit(1)

    # Apply pose to armature
    armature = bpy.data.objects.get('Spyke_Armature')
    if not armature:
        print('ERROR: Spyke_Armature not found in scene')
        sys.exit(1)

    pose_data = POSES.get(args['pose'], POSES['standing_relaxed'])
    apply_pose(armature, pose_data)

    # Set camera
    cam = bpy.data.objects.get(args['camera'])
    if not cam:
        print(f"ERROR: Camera '{args['camera']}' not found")
        sys.exit(1)
    bpy.context.scene.camera = cam

    # Set output path
    os.makedirs(os.path.dirname(args['output']), exist_ok=True)
    bpy.context.scene.render.filepath = args['output']

    # Render single frame
    bpy.ops.render.render(write_still=True)
    print(f'Rendered: {args["output"]}')

if __name__ == '__main__':
    main()
```

---

## Modified Components

### `pipeline/src/stages/generate.ts`

Add `mode === 'blender'` branch. The existing `manual`, `api`, and `comfyui` branches are untouched.

```typescript
// New branch in runGenerate(), alongside existing 'manual' | 'api' | 'comfyui' branches:

if (mode === 'blender') {
  // 1. Read script.json to get panel metadata (shotType, action)
  const scriptPath = path.join(chapterPaths.root, 'script.json');
  const chapter: Chapter = JSON.parse(await readFile(scriptPath, 'utf-8'));

  // 2. Filter pages if --page or --pages specified
  const pagesToRender = options.pages
    ? chapter.pages.filter(p => options.pages!.includes(p.pageNumber))
    : options.page != null
      ? chapter.pages.filter(p => p.pageNumber === options.page)
      : chapter.pages;

  const blendFile = path.resolve(PATHS.blendFile);   // new path constant
  const renderScript = path.resolve(PATHS.renderPanelScript);

  for (const page of pagesToRender) {
    const { pose, camera } = mapPanelToBlenderArgs(page.panels[0]!);
    const version = nextVersion(chapterPaths.raw, options.chapter, page.pageNumber);
    const filename = panelImageFilename(options.chapter, page.pageNumber, version);
    const outputPath = path.join(chapterPaths.raw, filename);

    console.log(`[generate] Blender render: page ${page.pageNumber} pose=${pose} camera=${camera}`);

    const result = await renderWithBlender({ blendFile, renderScript, pose, camera, outputPath });

    const entry: GenerationLogEntry = {
      imageFile: filename,
      promptFile: '',          // no prompt file for Blender renders
      promptHash: '',
      model: 'blender-eevee',
      source: 'blender',
      blenderPose: pose,
      blenderCamera: camera,
      timestamp: new Date().toISOString(),
      version,
      approved: false,
    };
    await addEntry(chapterPaths.root, manifest, entry);
    outputFiles.push(outputPath);

    console.log(`[generate] Rendered in ${result.durationMs}ms → ${filename}`);
  }
}
```

**What does NOT change:** The manifest format (`generation-log.json`) is extended with two optional fields (`blenderPose`, `blenderCamera`), both absent in Gemini/ComfyUI entries. The overlay stage reads `entry.imageFile` and `entry.approved` only — it ignores all other fields. No overlay changes required.

### `pipeline/src/types/generation.ts`

Add two optional fields and extend the `source` union:

```typescript
export interface GenerationLogEntry {
  // ... existing fields unchanged ...
  source?: 'gemini' | 'comfyui' | 'blender';  // extend union
  blenderPose?: string;    // e.g. 'walking'
  blenderCamera?: string;  // e.g. 'Cam_Front'
}
```

### `pipeline/src/config/paths.ts`

Add two new paths:

```typescript
export const PATHS = {
  // ... existing paths unchanged ...

  /** Blender .blend scene file for Spyke. */
  blendFile: path.join(PROJECT_ROOT, '3d_models', 'output', 'spyke', 'spyke.blend'),

  /** Single-panel render script (called by blender-runner.ts). */
  renderPanelScript: path.join(PROJECT_ROOT, '3d_models', 'render', 'render_panel.py'),
} as const;
```

### `pipeline/src/cli.ts`

Add `--blender` flag to the `generate` command and handle mode selection:

```typescript
program
  .command('generate')
  // ... existing options ...
  .option('--blender', 'Blender 3D render mode — renders panels from spyke.blend')
  .action(async (options) => {
    // extend mode detection:
    const mode = options.blender ? 'blender'
               : options.comfyui ? 'comfyui'
               : options.api     ? 'api'
               : 'manual';
    // ...
  });
```

---

## Directory Structure After Integration

```
plasma/
├── pipeline/
│   └── src/
│       ├── blender/                    # NEW directory
│       │   ├── blender-runner.ts       # NEW — child process wrapper
│       │   ├── pose-map.ts             # NEW — shotType+action → pose+camera
│       │   └── types.ts                # NEW — BlenderRenderRequest, etc.
│       ├── stages/
│       │   └── generate.ts             # MODIFIED — new 'blender' mode branch
│       ├── types/
│       │   └── generation.ts           # MODIFIED — source union + 2 optional fields
│       └── config/
│           └── paths.ts                # MODIFIED — 2 new path constants
└── 3d_models/
    ├── render/
    │   ├── render_poses.py             # UNCHANGED
    │   └── render_panel.py             # NEW — single-panel render, called by TS pipeline
    ├── output/
    │   └── spyke/
    │       └── spyke.blend             # Built by build_spyke.py — pipeline reads this
    └── ...                             # Everything else unchanged
```

---

## Architectural Patterns

### Pattern 1: Child Process Boundary (TypeScript → Python)

**What:** TypeScript never imports or calls Python directly. The boundary is always `child_process.execFile(blender, [...args])`. All communication is via CLI arguments (in) and filesystem (out). No stdout parsing for result data — the output file existing is the success signal.

**When to use:** Any time a TypeScript process needs to invoke Blender. Never attempt to manage Blender state across invocations — each render is a fresh headless Blender instance loading the `.blend` file from scratch.

**Why this works:** Blender's `--background` mode is designed for exactly this use case. The `.blend` file is the serialized state. Opening it in headless mode, running a Python script, and exiting is the documented pattern for pipeline automation.

**Trade-off:** Each panel render incurs the Blender startup overhead (~1-2s on M1 Pro) plus EEVEE render time (~3-10s per panel). For 28 panels in Chapter 1, expect 2-5 minutes total. This is acceptable and far faster than LoRA inference inconsistency debugging.

### Pattern 2: Pose Map as Code (Not Configuration File)

**What:** The `shotType → camera` and `action keyword → pose` mapping lives in TypeScript source (`pose-map.ts`), not a YAML/JSON config file.

**Why:** The mapping is code logic (keyword matching with fallbacks), not pure data. It will evolve as the panel script conventions solidify. Keeping it in TypeScript means it's type-checked, easily testable, and in the same diff as any related changes. A YAML config would be loaded at runtime with no type safety.

**Trade-off:** Adding a new pose requires touching both `render_poses.py` (to define the bone rotations) and `pose-map.ts` (to create the routing rule). This coupling is explicit and acceptable — pose-map.ts is the documented synchronization point.

### Pattern 3: Blender as Stateless Renderer

**What:** The `.blend` file is built once by `build_spyke.py` and saved to `3d_models/output/spyke/spyke.blend`. Every render invocation opens this file fresh, applies a pose, renders, exits. The `.blend` file is never mutated by the pipeline.

**Why:** This makes the render step idempotent. Re-rendering page 3 with the same pose always produces the same output. If the `.blend` file is updated (model refinement, shader changes), all pages can be re-rendered in a batch without tracking state.

**Implication:** The `.blend` file must be committed or regenerated before running the pipeline. It is the build artifact of `build_spyke.py`. Treat it like a compiled binary — generated, not hand-edited (except for manual refinement passes via Blender UI, after which `build_spyke.py` is not rerun).

---

## Anti-Patterns

### Anti-Pattern 1: Parsing Blender Stdout for Results

**What people do:** Run Blender, parse stdout for filenames or success messages, use that to determine output path.

**Why it's wrong:** Blender's stdout is not a stable API. Print statements in Python scripts, Blender info messages, and library output all mix in stdout. Parsing it is fragile. Blender also writes to stderr for warnings that are not errors.

**Do this instead:** Pass `--output /absolute/path/to/output.png` as a CLI arg. After `execFile` resolves, check `existsSync(outputPath)`. File present = success. File absent = failure. This is robust across Blender versions.

### Anti-Pattern 2: One Blender Process Per Chapter (Persistent Session)

**What people do:** Start one Blender process, communicate with it via stdin pipe, send "render page 1, render page 2..." commands, then exit.

**Why it's wrong:** Blender is not designed as a persistent server. The Python API runs inside Blender's own event loop. There is no stable stdin command protocol. Attempting to implement one is complex, fragile, and version-sensitive.

**Do this instead:** One `execFile` per panel. The startup overhead per render (~1-2 seconds) is worth the simplicity. If render time becomes a bottleneck, use `Promise.all()` with multiple concurrent Blender processes — Blender is safe to run concurrently since each instance gets its own process space. On M1 Pro with 16GB unified memory, 2-3 concurrent renders are feasible.

### Anti-Pattern 3: Hard-Coding Pose Names as Strings in generate.ts

**What people do:** Write `pose: 'walking'` or `camera: 'Cam_Front'` directly in generate.ts stage code.

**Why it's wrong:** When pose names change in `render_poses.py`, generate.ts breaks silently at runtime. The pose map is the wrong place to discover a bug.

**Do this instead:** All pose and camera names are defined in `pose-map.ts` as constants or a typed enum. `blender-runner.ts` passes them through without inspection. If a pose key doesn't exist in Blender, `render_panel.py` exits with a non-zero code and prints a clear error, which `execFile` surfaces as a thrown Error.

---

## Integration Points

### External Boundaries

| Boundary | Communication Method | Contract |
|----------|---------------------|----------|
| TypeScript → Blender | `child_process.execFile` with CLI args | Args: `--pose`, `--camera`, `--output` (all strings). Returns: 0 on success, non-zero on failure. Output file at `--output` path. |
| Blender Python → render_poses.py | Python `import` (same process) | `POSES` dict and `apply_pose()` function. Both must stay importable. |
| generate.ts → overlay.ts | Filesystem + manifest | Approved PNG at `raw/chNN_pNNN_vN.png`. Entry in `generation-log.json` with `approved: true`. |
| generate.ts → pose-map.ts | TypeScript function call | `mapPanelToBlenderArgs(panel: Panel): BlenderPanelArgs`. Input is the `Panel` type from `manga.ts`. |

### Internal Boundaries (Existing, Verified)

| Boundary | How It Works | Notes for Blender Integration |
|----------|-------------|------------------------------|
| overlay.ts reads raw/ | `getApprovedEntry(manifest, pageNumber)` → `entry.imageFile` → `path.join(chapterPaths.raw, imageFile)` | Blender renders land at `raw/chNN_pNNN_vN.png` — same location, same naming convention. No change. |
| assemble.ts reads lettered/ | Scans `lettered/` for PNG files sorted by name | Blender → overlay → lettered/ path is identical to Gemini → overlay → lettered/ path. No change. |
| manifest entry approval | `pnpm stage:generate -- --approve chNN_pNNN_vN.png -c N` | Same approve command works for Blender renders. Approve logic in generate.ts reads `entry.source` but does not branch on it for the approval action. |

---

## File Naming Convention Alignment

The existing convention `chNN_pNNN_vN.png` is used without modification:

```
ch01_p003_v1.png   → Chapter 1, Page 3, Version 1 (Blender render)
ch01_p003_v2.png   → Chapter 1, Page 3, Version 2 (re-render with different pose)
```

`panelImageFilename(chapter, page, version)` and `nextVersion()` in `pipeline/src/generation/naming.ts` are used unchanged. The Blender runner calls `nextVersion(chapterPaths.raw, chapter, pageNum)` the same way the Gemini and ComfyUI modes do.

**Important:** The output is 800×1200 PNG with RGBA transparency (as configured in `render_setup.py`). The overlay stage (`overlayPage()`) uses Sharp to load the raw image — Sharp handles RGBA PNGs correctly. The assemble stage uses Sharp to stack images — RGBA input is flattened to white background during JPEG assembly. No format changes needed.

---

## Build Order

Build order is determined by dependency: each item below depends on those above it being testable.

### Phase 1: Blender Python — `render_panel.py`

Build `3d_models/render/render_panel.py` first. It has no TypeScript dependencies.

**Deliverable:** `blender spyke.blend --background --python render_panel.py -- --pose walking --camera Cam_Front --output /tmp/test.png` produces a PNG.

**Prerequisite:** `spyke.blend` must exist. Run `build_spyke.py` first if it has not been run since Phase 9. This is a one-time model build step — after the `.blend` is saved, the render pipeline operates on it.

**Verification:** Open `/tmp/test.png` — should show Spyke in walking pose, cel-shaded, with Freestyle outlines, 800×1200.

### Phase 2: TypeScript Types — `blender/types.ts`

Define `BlenderRenderRequest` and `BlenderRenderResult` interfaces. No logic, no dependencies. This unblocks parallel development of the runner and the pose-map.

### Phase 3: Pose Map — `blender/pose-map.ts`

Build `pose-map.ts` with the shot type and action keyword mapping table.

**Unit-testable without Blender:** Given a Panel with `shotType: 'MEDIUM'`, assert `mapPanelToBlenderArgs(panel).camera === 'Cam_UpperBody'`.

**Dependency:** `render_panel.py` Phase 1 (to know what pose names and camera names are valid). Verify the keys in `pose-map.ts` match the keys in `POSES` and `REFERENCE_VIEWS` in `render_poses.py`.

### Phase 4: Blender Runner — `blender/blender-runner.ts`

Build `blender-runner.ts` with `renderWithBlender()`.

**Integration test:** Call `renderWithBlender()` with known pose/camera/output args. Verify file is created and has non-zero size.

**Dependency:** Phase 1 (render_panel.py must work). Phase 2 (types). `BLENDER_PATH` env var must be set or default `/Applications/Blender.app/Contents/MacOS/blender` must be valid.

### Phase 5: generate.ts Mode Branch

Add `mode === 'blender'` to `generate.ts`. Wire in pose-map and runner.

**Dependency:** Phases 1-4. Also requires `script.json` to exist for the chapter (run `pnpm stage:script -c 1` first).

**End-to-end test:** `pnpm stage:generate -- --blender -c 1 --page 3` produces `output/ch-01/raw/ch01_p003_v1.png` and adds an entry to `generation-log.json` with `source: 'blender'`.

### Phase 6: Approve → Overlay → Assemble (Existing Commands, No Changes)

With a Blender render approved in the manifest, run:

```bash
pnpm stage:generate -- --approve ch01_p003_v1.png -c 1
pnpm stage:overlay -c 1 --page 3
pnpm stage:assemble -c 1
```

**Expected result:** The Blender render passes through the existing overlay and assemble stages unchanged. The Webtoon strip is assembled from a mix of approved Blender renders and any remaining Gemini/ComfyUI images.

---

## Environment Configuration

One new environment variable is needed:

```bash
# pipeline/.env  (add to existing file)
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/blender
```

Optional — defaults to the macOS standard install path. On a different machine, override this to the correct Blender 5.0.1 binary path.

No service, no port, no server. Blender is invoked as a CLI tool. This is simpler than the ComfyUI Express service — there is no persistent process to manage.

---

## Scaling Considerations

This is a single-developer local pipeline, not a service. Scaling concerns are render throughput only.

| Scale | Approach |
|-------|----------|
| 1-5 panels per session | Serial renders, `for` loop in generate.ts. Default. |
| Full chapter (28 panels) | Serial is fine — ~5-10 min total on M1 Pro. No changes needed. |
| Multiple characters (future) | Each character gets a separate `.blend` file and `render_<character>.py`. `blender-runner.ts` accepts `blendFile` as a parameter (already designed this way). |
| Concurrent renders (future, if needed) | Replace `for` loop with `Promise.all()` batches of 2-3 concurrent renders. M1 Pro can handle 2-3 Blender EEVEE renders simultaneously within 16GB unified memory. Each frame uses ~1-2GB at 800×1200. |

---

## Sources

- Direct inspection: `pipeline/src/stages/generate.ts` — existing mode branching, manifest integration, naming conventions
- Direct inspection: `pipeline/src/stages/overlay.ts` — how it reads manifest, uses `raw/` directory, is agnostic to generation source
- Direct inspection: `pipeline/src/types/generation.ts` — `GenerationLogEntry`, `source` field, extension pattern
- Direct inspection: `pipeline/src/config/paths.ts` — `chapterOutput()`, `raw`, directory layout
- Direct inspection: `pipeline/src/generation/naming.ts` — `panelImageFilename()`, `nextVersion()`, filename regex
- Direct inspection: `pipeline/src/generation/manifest.ts` — `addEntry()`, `getApprovedEntry()` — overlay only reads `approved` and `imageFile`
- Direct inspection: `3d_models/render/render_poses.py` — `POSES` dict, `apply_pose()`, `render_view()`, CLI arg parsing pattern
- Direct inspection: `3d_models/common/render_setup.py` — camera names (`Cam_Front`, etc.), render resolution 800×1200, RGBA output
- Direct inspection: `3d_models/build_spyke.py` — output path `3d_models/output/spyke/spyke.blend`
- Direct inspection: `pipeline/src/cli.ts` — mode flag pattern, Commander.js option structure
- Blender `--background` headless mode with `--python` script: HIGH confidence — documented Blender feature, stable across 3.x and 4.x, consistent with 5.0.1
- `child_process.execFile` for synchronous subprocess invocation: HIGH confidence — Node.js stdlib, stable API

---

*Architecture research for: Blender 3D rendering integration into TypeScript manga pipeline*
*Researched: 2026-02-25*
