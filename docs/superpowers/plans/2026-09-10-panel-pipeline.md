# Panel-Based Page Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate chapter pages one panel at a time, compose them into a manga page grid whose panel sizes carry the pacing, and letter dialogue into known panel rectangles.

**Architecture:** A per-chapter `pages.json` plan (built from `script.json` + character registry) is the single source of truth. A row-flow layout engine assigns each panel a slot rectangle from its shot type. New stages `plan → panels → review/approve → compose → letter` read and write that plan; the existing script parser, character registry, Muse client, balloon/SFX renderers and assembly stage are reused.

**Tech Stack:** TypeScript (NodeNext, strict), Commander CLI, Sharp (compositing + Pango text), Zod (plan schema), vitest. Runway Muse via the existing `generateImage` in `src/generation/kling-client.ts`.

**Spec:** `docs/superpowers/specs/2026-09-10-panel-pipeline-design.md`

**Working directory for every command:** `/Users/dondemetrius/Code/plasma/pipeline`. Run tests with `pnpm vitest run <path>`. Typecheck with `pnpm typecheck`. Commit from the repo root on the current feature branch; never commit to `main`.

**Hard rule:** No stage in this plan calls a paid API during tests. Task 7 injects the generator. Nothing in this plan runs `panels` against Runway; that is the user's call after Phase 1 is reviewed.

---

## File map

| File | Responsibility |
|---|---|
| `src/types/page-plan.ts` | Plan types + Zod schema + `AspectRatio` union |
| `src/planning/shot-rules.ts` | shot type → aspect ratio; speaker-side assignment; emphasis pick |
| `src/layout/row-flow.ts` | row-flow layout → slot rectangles |
| `src/planning/page-plan.ts` | build plan from script + registry; merge with existing; load/save |
| `src/planning/panel-prompt.ts` | per-panel prompt text |
| `src/stages/plan.ts` | `plan` stage |
| `src/layout/compose.ts` | cover-fit panels into slots → page PNG buffer |
| `src/stages/compose.ts` | `compose` stage |
| `src/stages/panel-generate.ts` | `panels` stage (generator injected) |
| `src/stages/review.ts` | contact sheet + approve helper |
| `src/overlay/placement.ts` | balloon placement inside a slot |
| `src/overlay/fonts.ts` | bundled font lookup |
| `src/stages/letter.ts` | `letter` stage |
| `src/cli.ts` | new commands |
| `data/fonts/ComicNeue-Bold.otf` | bundled OFL comic font |
| `tests/planning/*.test.ts`, `tests/layout/*.test.ts`, `tests/overlay/placement.test.ts`, `tests/stages/*.test.ts` | tests |

---

### Task 1: Page plan types and schema

**Files:**
- Create: `src/types/page-plan.ts`
- Test: `tests/planning/page-plan-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/planning/page-plan-schema.test.ts
import { describe, it, expect } from 'vitest';
import { PagePlanSchema, ChapterPlanSchema } from '../../src/types/page-plan.js';

describe('page plan schema', () => {
  it('accepts a minimal valid page plan', () => {
    const page = {
      pageNumber: 3,
      isSplash: false,
      layout: { canvas: { w: 1600, h: 2264 }, slots: [{ panelNumber: 1, x: 60, y: 60, w: 1480, h: 900 }] },
      panels: [{
        panelNumber: 1,
        shotType: 'Medium',
        aspectRatio: '3:4',
        characterIds: ['spyke-tinwall'],
        speakerSides: { SPYKE: 'left' },
        dialogue: [{ character: 'SPYKE', line: 'Don\'t touch me.', type: 'speech' }],
        sfx: '',
        prompt: 'Spyke turns.',
        promptHash: 'abc',
        versions: [],
        approvedVersion: null,
      }],
    };
    expect(PagePlanSchema.parse(page).panels[0]!.approvedVersion).toBeNull();
  });

  it('rejects an unknown aspect ratio', () => {
    const bad = { pageNumber: 1, isSplash: false, layout: { canvas: { w: 1, h: 1 }, slots: [] },
      panels: [{ panelNumber: 1, shotType: 'Wide', aspectRatio: '5:7', characterIds: [], speakerSides: {},
        dialogue: [], sfx: '', prompt: 'x', promptHash: 'h', versions: [], approvedVersion: null }] };
    expect(() => PagePlanSchema.parse(bad)).toThrow();
  });

  it('wraps pages in a chapter plan', () => {
    const chapter = { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [] };
    expect(ChapterPlanSchema.parse(chapter).pages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/planning/page-plan-schema.test.ts`
Expected: FAIL — cannot find module `../../src/types/page-plan.js`

- [ ] **Step 3: Write the types**

```ts
// src/types/page-plan.ts
/**
 * Page plan: the single source of truth for panel-based page production.
 * Built from script.json by the plan stage; read by panels, review, compose, letter.
 */
import { z } from 'zod';

export const ASPECT_RATIOS = ['16:9', '4:3', '3:4', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const DialogueLineSchema = z.object({
  character: z.string(),
  line: z.string(),
  type: z.enum(['speech', 'thought', 'narration']),
});

export const PanelVersionSchema = z.object({
  version: z.number().int().positive(),
  /** Path relative to the chapter output root, e.g. raw/runway-muse/ch01_p03_pn2_v1.png */
  file: z.string(),
  model: z.string(),
  requestId: z.string(),
  timestamp: z.string(),
  notes: z.string().default(''),
});

export const SlotRectSchema = z.object({
  panelNumber: z.number().int().positive(),
  x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(),
});

export const PanelPlanSchema = z.object({
  panelNumber: z.number().int().positive(),
  shotType: z.string(),
  aspectRatio: z.enum(ASPECT_RATIOS),
  characterIds: z.array(z.string()),
  speakerSides: z.record(z.enum(['left', 'right'])),
  dialogue: z.array(DialogueLineSchema),
  sfx: z.string(),
  prompt: z.string(),
  /** sha1 of prompt; approvals reset when it changes. */
  promptHash: z.string(),
  versions: z.array(PanelVersionSchema),
  approvedVersion: z.number().int().positive().nullable(),
  /** Manual nudges per dialogue index, in page pixels. */
  balloonOverrides: z.record(z.object({ dx: z.number(), dy: z.number() })).optional(),
});

export const PagePlanSchema = z.object({
  pageNumber: z.number().int().positive(),
  isSplash: z.boolean(),
  layout: z.object({
    canvas: z.object({ w: z.number().positive(), h: z.number().positive() }),
    slots: z.array(SlotRectSchema),
  }),
  panels: z.array(PanelPlanSchema),
});

export const ChapterPlanSchema = z.object({
  chapterNumber: z.number().int().positive(),
  canvas: z.object({ w: z.number().positive(), h: z.number().positive() }),
  pages: z.array(PagePlanSchema),
});

export type DialogueLinePlan = z.infer<typeof DialogueLineSchema>;
export type PanelVersion = z.infer<typeof PanelVersionSchema>;
export type SlotRect = z.infer<typeof SlotRectSchema>;
export type PanelPlan = z.infer<typeof PanelPlanSchema>;
export type PagePlan = z.infer<typeof PagePlanSchema>;
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;

/** Manga B5 trim at 1600 wide. */
export const DEFAULT_CANVAS = { w: 1600, h: 2264 } as const;
export const PAGE_MARGIN = 60;
export const PAGE_GUTTER = 24;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/planning/page-plan-schema.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/types/page-plan.ts pipeline/tests/planning/page-plan-schema.test.ts
git commit -m "feat(plan): page plan types and schema"
```

---

### Task 2: Shot rules — aspect ratio, speaker sides, emphasis

**Files:**
- Create: `src/planning/shot-rules.ts`
- Test: `tests/planning/shot-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/planning/shot-rules.test.ts
import { describe, it, expect } from 'vitest';
import { aspectForShot, assignSpeakerSides, pickEmphasisPanel } from '../../src/planning/shot-rules.js';

describe('aspectForShot', () => {
  it('maps shot types', () => {
    expect(aspectForShot('Wide')).toBe('16:9');
    expect(aspectForShot('Medium-Wide')).toBe('4:3');
    expect(aspectForShot('Medium')).toBe('3:4');
    expect(aspectForShot('Close-up')).toBe('1:1');
    expect(aspectForShot('Extreme Close-up')).toBe('1:1');
    expect(aspectForShot('Two-shot')).toBe('3:4');
  });
  it('is case-insensitive', () => {
    expect(aspectForShot('wide')).toBe('16:9');
  });
});

describe('assignSpeakerSides', () => {
  it('first speaker left, second right, others alternate', () => {
    const sides = assignSpeakerSides(
      [{ character: 'SPYKE', line: 'a', type: 'speech' },
       { character: 'PUNK 1', line: 'b', type: 'speech' },
       { character: 'SPYKE', line: 'c', type: 'speech' },
       { character: 'JUNE', line: 'd', type: 'speech' }],
      ['SPYKE', 'PUNK 1', 'JUNE'],
    );
    expect(sides).toEqual({ SPYKE: 'left', 'PUNK 1': 'right', JUNE: 'left' });
  });
  it('skips narration and speakers not on the panel', () => {
    const sides = assignSpeakerSides(
      [{ character: 'Narrator', line: 'x', type: 'narration' },
       { character: 'INTERCOM', line: 'y', type: 'speech' },
       { character: 'SPYKE', line: 'z', type: 'thought' }],
      ['SPYKE'],
    );
    expect(sides).toEqual({ SPYKE: 'left' });
  });
});

describe('pickEmphasisPanel', () => {
  const p = (n: number, lines: number, notes = '') => ({ panelNumber: n, dialogueCount: lines, notes });
  it('picks the panel with the most dialogue', () => {
    expect(pickEmphasisPanel([p(1, 0), p(2, 3), p(3, 1)])).toBe(2);
  });
  it('breaks ties with reveal/beat/! notes', () => {
    expect(pickEmphasisPanel([p(1, 1), p(2, 1, 'The reveal.'), p(3, 1)])).toBe(2);
  });
  it('falls back to the last panel', () => {
    expect(pickEmphasisPanel([p(1, 0), p(2, 0), p(3, 0)])).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/planning/shot-rules.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/planning/shot-rules.ts
import type { AspectRatio, DialogueLinePlan } from '../types/page-plan.js';

/** Shot type from the script → generation aspect ratio. */
export function aspectForShot(shotType: string): AspectRatio {
  const s = shotType.toLowerCase();
  if (s.includes('medium-wide') || s.includes('medium wide')) return '4:3';
  if (s.includes('wide')) return '16:9';
  if (s.includes('close')) return '1:1';
  return '3:4';
}

/**
 * First on-panel speaker goes left, second right, then alternate.
 * Narration and speakers not on the panel get no side (balloon goes top-centre).
 */
export function assignSpeakerSides(
  dialogue: DialogueLinePlan[],
  charactersOnPanel: string[],
): Record<string, 'left' | 'right'> {
  const onPanel = new Set(charactersOnPanel.map((c) => c.toUpperCase()));
  const sides: Record<string, 'left' | 'right'> = {};
  let next: 'left' | 'right' = 'left';
  for (const line of dialogue) {
    if (line.type === 'narration') continue;
    const key = line.character;
    if (!onPanel.has(key.toUpperCase())) continue;
    if (sides[key]) continue;
    sides[key] = next;
    next = next === 'left' ? 'right' : 'left';
  }
  return sides;
}

export interface EmphasisInput { panelNumber: number; dialogueCount: number; notes: string }

const EMPHASIS_WORDS = /reveal|beat|!|hero|money shot|dominant/i;

/** The panel that gets the biggest slot on the page. */
export function pickEmphasisPanel(panels: EmphasisInput[]): number {
  if (panels.length === 0) return 1;
  const max = Math.max(...panels.map((p) => p.dialogueCount));
  const top = panels.filter((p) => p.dialogueCount === max);
  if (top.length === 1 && max > 0) return top[0]!.panelNumber;
  const flagged = top.find((p) => EMPHASIS_WORDS.test(p.notes));
  if (flagged) return flagged.panelNumber;
  return panels[panels.length - 1]!.panelNumber;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/planning/shot-rules.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/planning/shot-rules.ts pipeline/tests/planning/shot-rules.test.ts
git commit -m "feat(plan): shot-type aspect, speaker sides, emphasis rules"
```

---

### Task 3: Row-flow layout engine

**Files:**
- Create: `src/layout/row-flow.ts`
- Test: `tests/layout/row-flow.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/layout/row-flow.test.ts
import { describe, it, expect } from 'vitest';
import { rowFlowLayout } from '../../src/layout/row-flow.js';
import type { SlotRect } from '../../src/types/page-plan.js';

const canvas = { w: 1600, h: 2264 };
const margin = 60, gutter = 24;

function overlaps(a: SlotRect, b: SlotRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('rowFlowLayout', () => {
  it('gives a wide panel a full-width row and pairs portraits', () => {
    const slots = rowFlowLayout(
      [{ panelNumber: 1, aspectRatio: '16:9' }, { panelNumber: 2, aspectRatio: '3:4' }, { panelNumber: 3, aspectRatio: '1:1' }],
      { canvas, margin, gutter, emphasisPanel: 1, isSplash: false },
    );
    expect(slots.map((s) => s.panelNumber)).toEqual([1, 2, 3]);
    expect(slots[0]!.w).toBe(canvas.w - 2 * margin);
    expect(slots[1]!.y).toBe(slots[2]!.y);               // same row
    expect(slots[1]!.x + slots[1]!.w + gutter).toBe(slots[2]!.x);
    expect(slots[0]!.y + slots[0]!.h + gutter).toBe(slots[1]!.y);
  });

  it('never overlaps and fits inside the margins', () => {
    const panels = [1, 2, 3, 4, 5, 6].map((n) => ({ panelNumber: n, aspectRatio: n % 2 ? '3:4' : '1:1' } as const));
    const slots = rowFlowLayout(panels, { canvas, margin, gutter, emphasisPanel: 4, isSplash: false });
    for (const a of slots) {
      expect(a.x).toBeGreaterThanOrEqual(margin);
      expect(a.x + a.w).toBeLessThanOrEqual(canvas.w - margin + 1);
      expect(a.y + a.h).toBeLessThanOrEqual(canvas.h - margin + 1);
      for (const b of slots) if (a !== b) expect(overlaps(a, b)).toBe(false);
    }
    const last = slots[slots.length - 1]!;
    expect(last.y + last.h).toBeGreaterThanOrEqual(canvas.h - margin - 1); // fills the page
  });

  it('gives the emphasis row more height', () => {
    const base = [{ panelNumber: 1, aspectRatio: '3:4' }, { panelNumber: 2, aspectRatio: '3:4' }, { panelNumber: 3, aspectRatio: '3:4' }, { panelNumber: 4, aspectRatio: '3:4' }] as const;
    const a = rowFlowLayout([...base], { canvas, margin, gutter, emphasisPanel: 1, isSplash: false });
    const b = rowFlowLayout([...base], { canvas, margin, gutter, emphasisPanel: 3, isSplash: false });
    expect(a[0]!.h).toBeGreaterThan(a[2]!.h);
    expect(b[2]!.h).toBeGreaterThan(b[0]!.h);
  });

  it('splash pages get one full slot', () => {
    const slots = rowFlowLayout([{ panelNumber: 1, aspectRatio: '3:4' }], { canvas, margin, gutter, emphasisPanel: 1, isSplash: true });
    expect(slots).toHaveLength(1);
    expect(slots[0]!.h).toBe(canvas.h - 2 * margin);
  });

  it('leftover portrait panel takes a full row', () => {
    const slots = rowFlowLayout(
      [{ panelNumber: 1, aspectRatio: '3:4' }, { panelNumber: 2, aspectRatio: '3:4' }, { panelNumber: 3, aspectRatio: '3:4' }],
      { canvas, margin, gutter, emphasisPanel: 3, isSplash: false },
    );
    expect(slots[2]!.w).toBe(canvas.w - 2 * margin);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/layout/row-flow.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/layout/row-flow.ts
/**
 * Row-flow page layout. Panels keep script order (left→right, top→bottom).
 * Wide panels take a full-width row; two consecutive portrait/square panels
 * share a row; a leftover portrait takes a full row. Row heights come from
 * weights, with the emphasis panel's row enlarged.
 */
import type { AspectRatio, SlotRect } from '../types/page-plan.js';

export interface LayoutPanel { panelNumber: number; aspectRatio: AspectRatio }
export interface LayoutOptions {
  canvas: { w: number; h: number };
  margin: number;
  gutter: number;
  emphasisPanel: number;
  isSplash: boolean;
}

interface Row { panels: LayoutPanel[]; weight: number }

const WIDE: ReadonlySet<AspectRatio> = new Set(['16:9', '4:3']);
const WEIGHT_WIDE = 1.0;
const WEIGHT_PORTRAIT = 1.3;
const EMPHASIS_MULT = 1.25;
const MAX_FLOW_PANELS = 7;

function buildRows(panels: LayoutPanel[], emphasisPanel: number): Row[] {
  const rows: Row[] = [];
  let i = 0;
  const forcePairs = panels.length > MAX_FLOW_PANELS;
  while (i < panels.length) {
    const p = panels[i]!;
    if (!forcePairs && WIDE.has(p.aspectRatio)) {
      rows.push({ panels: [p], weight: WEIGHT_WIDE });
      i += 1;
      continue;
    }
    const q = panels[i + 1];
    if (q && (forcePairs || !WIDE.has(q.aspectRatio))) {
      rows.push({ panels: [p, q], weight: WEIGHT_PORTRAIT });
      i += 2;
    } else {
      rows.push({ panels: [p], weight: WEIGHT_PORTRAIT });
      i += 1;
    }
  }
  for (const row of rows) {
    if (row.panels.some((p) => p.panelNumber === emphasisPanel)) row.weight *= EMPHASIS_MULT;
  }
  return rows;
}

export function rowFlowLayout(panels: LayoutPanel[], opts: LayoutOptions): SlotRect[] {
  const innerW = opts.canvas.w - 2 * opts.margin;
  const innerH = opts.canvas.h - 2 * opts.margin;
  if (panels.length === 0) return [];
  if (opts.isSplash || panels.length === 1) {
    return [{ panelNumber: panels[0]!.panelNumber, x: opts.margin, y: opts.margin, w: innerW, h: innerH }];
  }

  const rows = buildRows(panels, opts.emphasisPanel);
  const totalWeight = rows.reduce((n, r) => n + r.weight, 0);
  const usableH = innerH - opts.gutter * (rows.length - 1);

  const slots: SlotRect[] = [];
  let y = opts.margin;
  rows.forEach((row, idx) => {
    const isLast = idx === rows.length - 1;
    const h = isLast
      ? opts.canvas.h - opts.margin - y            // absorb rounding so the page fills exactly
      : Math.floor((usableH * row.weight) / totalWeight);
    const n = row.panels.length;
    const w = Math.floor((innerW - opts.gutter * (n - 1)) / n);
    row.panels.forEach((p, col) => {
      const isLastCol = col === n - 1;
      const x = opts.margin + col * (w + opts.gutter);
      slots.push({ panelNumber: p.panelNumber, x, y, w: isLastCol ? opts.canvas.w - opts.margin - x : w, h });
    });
    y += h + opts.gutter;
  });
  return slots;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/layout/row-flow.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/layout/row-flow.ts pipeline/tests/layout/row-flow.test.ts
git commit -m "feat(layout): row-flow page layout engine"
```

---

### Task 4: Panel prompt builder

**Files:**
- Create: `src/planning/panel-prompt.ts`
- Modify: `src/templates/prompt-generator.ts:49` (export `extractCharactersFromPanel`)
- Test: `tests/planning/panel-prompt.test.ts`

- [ ] **Step 1: Export the character extractor**

In `src/templates/prompt-generator.ts` change line 49 from `function extractCharactersFromPanel(` to `export function extractCharactersFromPanel(`.

- [ ] **Step 2: Write the failing test**

```ts
// tests/planning/panel-prompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildPanelPrompt } from '../../src/planning/panel-prompt.js';

describe('buildPanelPrompt', () => {
  it('assembles style, action, notes, canon, framing and the no-text closer', () => {
    const p = buildPanelPrompt({
      stylePrefix: 'Colored manga, cel-shaded.',
      action: 'Spyke turns to face the punks.',
      notes: 'Tension.',
      shotType: 'Medium',
      fingerprints: [{ id: 'spyke-tinwall', name: 'Spyke Tinwall', fingerprint: 'Spyke — red bandana' }],
      speakerSides: { SPYKE: 'left', 'PUNK 1': 'right' },
      speakerNames: { SPYKE: 'Spyke Tinwall', 'PUNK 1': 'the punk leader' },
    });
    expect(p.startsWith('Colored manga, cel-shaded.')).toBe(true);
    expect(p).toContain('Spyke turns to face the punks.');
    expect(p).toContain('CHARACTERS');
    expect(p).toContain('Spyke — red bandana');
    expect(p).toContain('Spyke Tinwall on the left of the frame');
    expect(p).toContain('the punk leader on the right of the frame');
    expect(p).toContain('MEDIUM shot');
    expect(p).toContain('NO text');
    expect(p).not.toContain('Tension.\n\nTension.');
  });
  it('omits framing sides when nobody speaks', () => {
    const p = buildPanelPrompt({ stylePrefix: 's', action: 'a', notes: '', shotType: 'Wide', fingerprints: [], speakerSides: {}, speakerNames: {} });
    expect(p).not.toContain('of the frame');
    expect(p).toContain('WIDE shot');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run tests/planning/panel-prompt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement**

```ts
// src/planning/panel-prompt.ts
export interface PanelPromptInput {
  stylePrefix: string;
  action: string;
  notes: string;
  shotType: string;
  fingerprints: Array<{ id: string; name: string; fingerprint: string }>;
  speakerSides: Record<string, 'left' | 'right'>;
  /** Display name per script speaker key, e.g. { 'PUNK 1': 'the punk leader' } */
  speakerNames: Record<string, string>;
}

const CLOSER =
  'Single manga panel, one continuous scene, no panel borders inside the image. ' +
  'Leave clear headroom above the characters for dialogue balloons. ' +
  'NO text, NO speech balloons, NO sound-effect lettering, NO captions.';

export function buildPanelPrompt(i: PanelPromptInput): string {
  const parts: string[] = [i.stylePrefix.trim(), i.action.trim()];
  if (i.notes.trim()) parts.push(i.notes.trim());

  if (i.fingerprints.length > 0) {
    parts.push('CHARACTERS (match the reference images; these specs are canon):\n' +
      i.fingerprints.map((f) => `- ${f.fingerprint.trim()}`).join('\n'));
  }

  const framing: string[] = [`FRAMING: ${i.shotType.toUpperCase()} shot.`];
  for (const [key, side] of Object.entries(i.speakerSides)) {
    framing.push(`${i.speakerNames[key] ?? key} on the ${side} of the frame.`);
  }
  parts.push(framing.join(' '));
  parts.push(CLOSER);
  return parts.join('\n\n');
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/planning/panel-prompt.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/planning/panel-prompt.ts pipeline/src/templates/prompt-generator.ts pipeline/tests/planning/panel-prompt.test.ts
git commit -m "feat(plan): per-panel prompt builder"
```

---

### Task 5: Plan builder with merge, load and save

**Files:**
- Create: `src/planning/page-plan.ts`
- Test: `tests/planning/page-plan.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/planning/page-plan.test.ts
import { describe, it, expect } from 'vitest';
import { buildChapterPlan, mergeChapterPlan } from '../../src/planning/page-plan.js';
import type { Chapter } from '../../src/types/manga.js';
import { CharacterRegistry } from '../../src/characters/registry.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The registry loads YAML from a directory; build a tiny one per test run.
async function fixtureRegistry(): Promise<CharacterRegistry> {
  const dir = await mkdtemp(path.join(tmpdir(), 'chars-'));
  await writeFile(path.join(dir, 'spyke-tinwall.yaml'),
    'id: spyke-tinwall\nname: Spyke Tinwall\naliases: ["Spyke", "SPYKE"]\nfingerprint: "Spyke canon fingerprint text here"\n');
  await writeFile(path.join(dir, 'punks.yaml'),
    'id: punks\nname: Punks\naliases: ["PUNK 1", "PUNK 2", "Punks"]\nfingerprint: "Punks canon fingerprint text here"\n');
  const registry = new CharacterRegistry();
  await registry.loadAll(dir);
  return registry;
}

const chapter: Chapter = {
  chapterNumber: 1, title: 'T', themeBeat: '', estimatedPages: 1, characters: [], locations: [],
  pages: [{
    pageNumber: 3, isSplash: false, isDoubleSpread: false,
    panels: [
      { panelNumber: 1, shotType: 'Medium', action: 'Spyke walks away.', dialogue: [{ character: 'PUNK 1', line: 'Hey.', type: 'speech' }], sfx: '', notes: '', tags: [] },
      { panelNumber: 2, shotType: 'Close-up', action: "Spyke's eyes.", dialogue: [], sfx: '', notes: 'Minimal.', tags: [] },
      { panelNumber: 3, shotType: 'Wide', action: 'The punks fan out. Spyke draws.', dialogue: [
        { character: 'PUNK 1', line: 'Q', type: 'speech' }, { character: 'SPYKE', line: 'Get lost!', type: 'speech' }], sfx: 'WHOOM', notes: 'The beat.', tags: [] },
    ],
  }],
} as Chapter;

describe('buildChapterPlan', () => {
  it('derives panels, aspect, speakers and slots', async () => {
    const registry = await fixtureRegistry();
    const plan = buildChapterPlan(chapter, registry, 'STYLE');
    const page = plan.pages[0]!;
    expect(page.panels.map((p) => p.aspectRatio)).toEqual(['3:4', '1:1', '16:9']);
    expect(page.panels[0]!.characterIds).toEqual(['spyke-tinwall', 'punks']);
    expect(page.panels[2]!.speakerSides).toEqual({ 'PUNK 1': 'left', SPYKE: 'right' });
    expect(page.layout.slots.map((s) => s.panelNumber)).toEqual([1, 2, 3]);
    expect(page.panels[2]!.prompt).toContain('STYLE');
    expect(page.panels[2]!.approvedVersion).toBeNull();
  });
});

describe('mergeChapterPlan', () => {
  it('keeps versions and approvals when the prompt is unchanged, resets when it changed', async () => {
    const registry = await fixtureRegistry();
    const fresh = buildChapterPlan(chapter, registry, 'STYLE');
    const existing = structuredClone(fresh);
    const v = { version: 1, file: 'raw/runway-muse/ch01_p03_pn1_v1.png', model: 'muse_image', requestId: 'r', timestamp: 't', notes: '' };
    existing.pages[0]!.panels[0]!.versions = [v];
    existing.pages[0]!.panels[0]!.approvedVersion = 1;
    existing.pages[0]!.panels[1]!.versions = [v];
    existing.pages[0]!.panels[1]!.approvedVersion = 1;
    existing.pages[0]!.panels[1]!.promptHash = 'stale';

    const merged = mergeChapterPlan(fresh, existing);
    expect(merged.pages[0]!.panels[0]!.approvedVersion).toBe(1);
    expect(merged.pages[0]!.panels[0]!.versions).toHaveLength(1);
    expect(merged.pages[0]!.panels[1]!.approvedVersion).toBeNull();
    expect(merged.pages[0]!.panels[1]!.versions).toHaveLength(1); // history kept, approval reset
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/planning/page-plan.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/planning/page-plan.ts
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { Chapter, Panel } from '../types/manga.js';
import {
  ChapterPlanSchema, DEFAULT_CANVAS, PAGE_MARGIN, PAGE_GUTTER,
  type ChapterPlan, type PagePlan, type PanelPlan,
} from '../types/page-plan.js';
import type { CharacterRegistry } from '../characters/registry.js';
import { extractCharactersFromPanel } from '../templates/prompt-generator.js';
import { aspectForShot, assignSpeakerSides, pickEmphasisPanel } from './shot-rules.js';
import { rowFlowLayout } from '../layout/row-flow.js';
import { buildPanelPrompt } from './panel-prompt.js';
import { PATHS } from '../config/paths.js';

export function hashPrompt(prompt: string): string {
  return createHash('sha1').update(prompt).digest('hex').slice(0, 12);
}

function speakerNames(panel: Panel, registry: CharacterRegistry): Record<string, string> {
  const names: Record<string, string> = {};
  for (const d of panel.dialogue) {
    const c = registry.get(d.character);
    names[d.character] = c ? c.name : d.character.toLowerCase();
  }
  return names;
}

function buildPanel(panel: Panel, registry: CharacterRegistry, stylePrefix: string): PanelPlan {
  const { known } = extractCharactersFromPanel(panel, registry);
  const seen = new Set<string>();
  const fingerprints: Array<{ id: string; name: string; fingerprint: string }> = [];
  for (const name of known) {
    const c = registry.get(name);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    fingerprints.push({ id: c.id, name: c.name, fingerprint: c.fingerprint });
  }
  // Speaker keys that resolve to a character on the panel count as "on panel".
  const onPanelSpeakers = panel.dialogue
    .map((d) => d.character)
    .filter((k) => { const c = registry.get(k); return !!c && seen.has(c.id); });
  const speakerSides = assignSpeakerSides(panel.dialogue, onPanelSpeakers);
  const prompt = buildPanelPrompt({
    stylePrefix, action: panel.action, notes: panel.notes, shotType: panel.shotType,
    fingerprints, speakerSides, speakerNames: speakerNames(panel, registry),
  });
  return {
    panelNumber: panel.panelNumber,
    shotType: panel.shotType,
    aspectRatio: aspectForShot(panel.shotType),
    characterIds: fingerprints.map((f) => f.id),
    speakerSides,
    dialogue: panel.dialogue,
    sfx: panel.sfx.trim() === '—' ? '' : panel.sfx,
    prompt,
    promptHash: hashPrompt(prompt),
    versions: [],
    approvedVersion: null,
  };
}

export function buildChapterPlan(chapter: Chapter, registry: CharacterRegistry, stylePrefix: string): ChapterPlan {
  const pages: PagePlan[] = chapter.pages.map((page) => {
    const panels = page.panels.map((p) => buildPanel(p, registry, stylePrefix));
    const emphasis = pickEmphasisPanel(page.panels.map((p) => ({
      panelNumber: p.panelNumber, dialogueCount: p.dialogue.length, notes: p.notes,
    })));
    const slots = rowFlowLayout(
      panels.map((p) => ({ panelNumber: p.panelNumber, aspectRatio: p.aspectRatio })),
      { canvas: DEFAULT_CANVAS, margin: PAGE_MARGIN, gutter: PAGE_GUTTER, emphasisPanel: emphasis, isSplash: page.isSplash },
    );
    return { pageNumber: page.pageNumber, isSplash: page.isSplash, layout: { canvas: { ...DEFAULT_CANVAS }, slots }, panels };
  });
  return { chapterNumber: chapter.chapterNumber, canvas: { ...DEFAULT_CANVAS }, pages };
}

/** Carry versions forward; keep approval only if the prompt hash is unchanged. */
export function mergeChapterPlan(fresh: ChapterPlan, existing: ChapterPlan | null): ChapterPlan {
  if (!existing) return fresh;
  const byKey = new Map<string, PanelPlan>();
  for (const pg of existing.pages) for (const pn of pg.panels) byKey.set(`${pg.pageNumber}:${pn.panelNumber}`, pn);
  for (const pg of fresh.pages) {
    for (const pn of pg.panels) {
      const old = byKey.get(`${pg.pageNumber}:${pn.panelNumber}`);
      if (!old) continue;
      pn.versions = old.versions;
      pn.balloonOverrides = old.balloonOverrides;
      pn.approvedVersion = old.promptHash === pn.promptHash ? old.approvedVersion : null;
    }
  }
  return fresh;
}

export function planPath(chapter: number): string {
  return path.join(PATHS.chapterOutput(chapter).root, 'pages.json');
}

export async function loadChapterPlan(chapter: number): Promise<ChapterPlan | null> {
  const file = planPath(chapter);
  if (!existsSync(file)) return null;
  return ChapterPlanSchema.parse(JSON.parse(await readFile(file, 'utf-8')));
}

export async function saveChapterPlan(plan: ChapterPlan): Promise<string> {
  const file = planPath(plan.chapterNumber);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ChapterPlanSchema.parse(plan), null, 2), 'utf-8');
  return file;
}

export function findPanel(plan: ChapterPlan, page: number, panel: number): PanelPlan | undefined {
  return plan.pages.find((p) => p.pageNumber === page)?.panels.find((q) => q.panelNumber === panel);
}

export function approvedFile(plan: ChapterPlan, panel: PanelPlan): string | null {
  if (panel.approvedVersion == null) return null;
  const v = panel.versions.find((x) => x.version === panel.approvedVersion);
  return v ? path.join(PATHS.chapterOutput(plan.chapterNumber).root, v.file) : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/planning/page-plan.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/planning/page-plan.ts pipeline/tests/planning/page-plan.test.ts
git commit -m "feat(plan): chapter plan builder with merge, load, save"
```

---

### Task 6: `plan` stage and CLI command

**Files:**
- Create: `src/stages/plan.ts`
- Modify: `src/cli.ts` (append command before `program.parse`)

- [ ] **Step 1: Write the stage**

```ts
// src/stages/plan.ts
/**
 * Plan stage: script.json + character registry → output/ch-NN/pages.json.
 * Re-running keeps existing versions and approvals for unchanged prompts.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageOptions, StageResult } from '../types/pipeline.js';
import type { Chapter } from '../types/manga.js';
import { PATHS } from '../config/paths.js';
import { loadCharacterRegistry } from '../characters/registry.js';
import { loadStyleGuide } from '../templates/prompt-generator.js';
import { buildChapterPlan, mergeChapterPlan, loadChapterPlan, saveChapterPlan } from '../planning/page-plan.js';

export async function runPlan(options: StageOptions): Promise<StageResult> {
  const start = Date.now();
  const scriptPath = path.join(PATHS.chapterOutput(options.chapter).root, 'script.json');
  if (!existsSync(scriptPath)) {
    return { stage: 'plan', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`script.json not found: ${scriptPath}. Run: pnpm stage:script -- -c ${options.chapter}`] };
  }
  const chapter = JSON.parse(await readFile(scriptPath, 'utf-8')) as Chapter;
  const registry = await loadCharacterRegistry();
  const style = loadStyleGuide(PATHS.styleGuide);
  const fresh = buildChapterPlan(chapter, registry, style.stylePrefix);
  const merged = mergeChapterPlan(fresh, await loadChapterPlan(options.chapter));

  if (options.verbose) {
    for (const pg of merged.pages) {
      const desc = pg.panels.map((p) => `${p.panelNumber}:${p.aspectRatio}`).join(' ');
      console.log(`[plan] page ${String(pg.pageNumber).padStart(2, '0')}: ${pg.panels.length} panels  ${desc}`);
    }
  }
  if (options.dryRun) {
    console.log(`[plan] dry run: would write ${merged.pages.length} pages`);
    return { stage: 'plan', success: true, outputFiles: [], errors: [], duration: Date.now() - start };
  }
  const file = await saveChapterPlan(merged);
  console.log(`[plan] wrote ${file} (${merged.pages.length} pages, ${merged.pages.reduce((n, p) => n + p.panels.length, 0)} panels)`);
  return { stage: 'plan', success: true, outputFiles: [file], errors: [], duration: Date.now() - start };
}
```

- [ ] **Step 2: Add the CLI command**

Append to `src/cli.ts` just above `program.parse(...)`:

```ts
// ---------------------------------------------------------------------------
// Panel pipeline: plan → panels → review/approve → compose → letter
// ---------------------------------------------------------------------------

function parsePages(raw?: string, single?: string): number[] | undefined {
  if (single) return [parseInt(single)];
  if (!raw) return undefined;
  if (raw.includes('-') && !raw.includes(',')) {
    const [a, b] = raw.split('-').map((s) => parseInt(s));
    if (a == null || b == null || isNaN(a) || isNaN(b) || a > b) { console.error(`Invalid page range: ${raw}`); process.exit(1); }
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return raw.split(',').map((s) => parseInt(s.trim()));
}

program
  .command('plan')
  .description('Build output/ch-NN/pages.json from script.json (layout, per-panel prompts)')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without writing')
  .action(async (options) => {
    if (!options.chapter) { console.error("error: required option '-c, --chapter <number>' not specified"); process.exit(1); }
    const { runPlan } = await import('./stages/plan.js');
    const result = await runPlan({ chapter: parseInt(options.chapter), verbose: options.verbose, dryRun: options.dryRun });
    if (!result.success) { console.error('Stage failed:', result.errors); process.exit(1); }
  });
```

- [ ] **Step 3: Typecheck and dry-run**

Run: `pnpm typecheck && pnpm dev plan -c 1 --dry-run -v`
Expected: no type errors; 28 lines like `[plan] page 03: 4 panels  1:3:4 2:1:1 3:3:4 4:3:4` and `[plan] dry run: would write 28 pages`.

- [ ] **Step 4: Write the real plan and inspect**

Run: `pnpm dev plan -c 1 && python3 -c "import json;p=json.load(open('../output/ch-01/pages.json'));pg=p['pages'][2];print(pg['layout']['slots']);print(pg['panels'][2]['prompt'][:400])"`
Expected: slot rectangles for page 3 in reading order; the panel prompt begins with the style prefix and contains a FRAMING line.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/stages/plan.ts pipeline/src/cli.ts
git commit -m "feat(plan): plan stage and CLI command"
```

---

### Task 7: Compose — cover-fit approved panels into slots

**Files:**
- Create: `src/layout/compose.ts`
- Create: `src/stages/compose.ts`
- Modify: `src/config/paths.ts` (add `pages` and `review` dirs to `chapterOutput`)
- Modify: `src/cli.ts`
- Test: `tests/layout/compose.test.ts`

- [ ] **Step 1: Add output dirs**

In `src/config/paths.ts` inside `chapterOutput`'s returned object add:

```ts
      pages: path.join(root, 'pages'),      // composed, unlettered page grids
      review: path.join(root, 'review'),    // contact sheets
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/layout/compose.test.ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { composePage } from '../../src/layout/compose.js';

async function tile(dir: string, name: string, w: number, h: number, rgb: { r: number; g: number; b: number }) {
  const file = path.join(dir, name);
  await writeFile(file, await sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer());
  return file;
}

describe('composePage', () => {
  it('places each panel in its slot and fills missing slots with a placeholder', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'compose-'));
    const red = await tile(dir, 'a.png', 160, 90, { r: 255, g: 0, b: 0 });   // 16:9 into a wider slot → cover crop
    const out = await composePage({
      canvas: { w: 400, h: 600 },
      slots: [
        { panelNumber: 1, x: 20, y: 20, w: 360, h: 150 },
        { panelNumber: 2, x: 20, y: 190, w: 360, h: 390 },
      ],
      panelFiles: { 1: red, 2: null },
      missingLabel: (n) => `MISSING ${n}`,
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(600);
    const px = async (x: number, y: number) => {
      const { data } = await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      return [data[0], data[1], data[2]];
    };
    expect(await px(200, 95)).toEqual([255, 0, 0]);       // centre of slot 1 is red
    expect(await px(200, 385)).toEqual([200, 200, 200]);  // centre of missing slot 2 is placeholder grey
    expect(await px(5, 5)).toEqual([255, 255, 255]);      // margin is white
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run tests/layout/compose.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the composer**

```ts
// src/layout/compose.ts
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { SlotRect } from '../types/page-plan.js';

export interface ComposeInput {
  canvas: { w: number; h: number };
  slots: SlotRect[];
  /** Approved image path per panel number, or null when nothing is approved. */
  panelFiles: Record<number, string | null>;
  missingLabel?: (panelNumber: number) => string;
  borderPx?: number;
}

const PLACEHOLDER = { r: 200, g: 200, b: 200 };

function labelSvg(text: string, w: number, h: number): Buffer {
  const size = Math.max(16, Math.floor(w / 14));
  return Buffer.from(
    `<svg width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="sans-serif" font-size="${size}" fill="#555">${text}</text></svg>`);
}

/** Compose approved panel images into a white page. Returns a PNG buffer. */
export async function composePage(input: ComposeInput): Promise<Buffer> {
  const border = input.borderPx ?? 4;
  const layers: OverlayOptions[] = [];
  for (const slot of input.slots) {
    const file = input.panelFiles[slot.panelNumber] ?? null;
    // Black frame
    layers.push({
      input: await sharp({ create: { width: slot.w, height: slot.h, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer(),
      left: slot.x, top: slot.y,
    });
    const innerW = slot.w - 2 * border, innerH = slot.h - 2 * border;
    if (file) {
      layers.push({
        input: await sharp(file).resize(innerW, innerH, { fit: 'cover', position: 'centre' }).png().toBuffer(),
        left: slot.x + border, top: slot.y + border,
      });
    } else {
      layers.push({
        input: await sharp({ create: { width: innerW, height: innerH, channels: 3, background: PLACEHOLDER } }).png().toBuffer(),
        left: slot.x + border, top: slot.y + border,
      });
      const label = input.missingLabel?.(slot.panelNumber) ?? `MISSING panel ${slot.panelNumber}`;
      layers.push({ input: labelSvg(label, innerW, innerH), left: slot.x + border, top: slot.y + border });
    }
  }
  return sharp({ create: { width: input.canvas.w, height: input.canvas.h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(layers)
    .png()
    .toBuffer();
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/layout/compose.test.ts`
Expected: PASS

- [ ] **Step 6: Write the compose stage**

```ts
// src/stages/compose.ts
/** Compose stage: approved panels from pages.json → output/ch-NN/pages/chNN_pPP.png */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan, approvedFile } from '../planning/page-plan.js';
import { composePage } from '../layout/compose.js';

export interface ComposeOptions { chapter: number; pages?: number[]; verbose?: boolean; dryRun?: boolean }

export function pageFileName(chapter: number, page: number): string {
  return `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(2, '0')}.png`;
}

export async function runCompose(options: ComposeOptions): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) {
    return { stage: 'compose', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`pages.json not found for chapter ${options.chapter}. Run: pnpm dev plan -c ${options.chapter}`] };
  }
  const outDir = PATHS.chapterOutput(options.chapter).pages;
  await mkdir(outDir, { recursive: true });
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const pages = plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber));

  for (const page of pages) {
    const panelFiles: Record<number, string | null> = {};
    let missing = 0;
    for (const panel of page.panels) {
      const f = approvedFile(plan, panel);
      panelFiles[panel.panelNumber] = f;
      if (!f) missing++;
    }
    const out = path.join(outDir, pageFileName(options.chapter, page.pageNumber));
    if (options.dryRun) { console.log(`[compose] page ${page.pageNumber}: ${page.panels.length - missing}/${page.panels.length} approved → ${out}`); continue; }
    try {
      const buf = await composePage({
        canvas: page.layout.canvas, slots: page.layout.slots, panelFiles,
        missingLabel: (n) => `MISSING p${String(page.pageNumber).padStart(2, '0')} panel ${n}`,
      });
      await writeFile(out, buf);
      outputFiles.push(out);
      console.log(`[compose] page ${page.pageNumber}: ${page.panels.length - missing}/${page.panels.length} panels → ${path.basename(out)}${missing ? ` (${missing} missing)` : ''}`);
    } catch (e) {
      errors.push(`page ${page.pageNumber}: ${(e as Error).message}`);
    }
  }
  return { stage: 'compose', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}
```

- [ ] **Step 7: Add the CLI command** (in `src/cli.ts`, after the `plan` command)

```ts
program
  .command('compose')
  .description('Compose approved panels into page grids (output/ch-NN/pages/)')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--page <number>', 'Single page')
  .option('--pages <range>', 'Page range, e.g. "1-5" or "3,7"')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done')
  .action(async (options) => {
    if (!options.chapter) { console.error("error: required option '-c, --chapter <number>' not specified"); process.exit(1); }
    const { runCompose } = await import('./stages/compose.js');
    const result = await runCompose({ chapter: parseInt(options.chapter), pages: parsePages(options.pages, options.page), verbose: options.verbose, dryRun: options.dryRun });
    if (!result.success) { console.error('Stage failed:', result.errors); process.exit(1); }
  });
```

- [ ] **Step 8: Typecheck and compose placeholder pages (no API)**

Run: `pnpm typecheck && pnpm dev compose -c 1 --pages 1-3 && ls ../output/ch-01/pages/`
Expected: three PNGs, each a white page with grey "MISSING" slots laid out per the plan. Open `ch01_p03.png` and confirm the layout reads: panel 1 and 2 paired, panel 3 (Wide) full width, panel 4 full width (the slot shapes are the deliverable of Phase 1).

- [ ] **Step 9: Commit**

```bash
git add pipeline/src/layout/compose.ts pipeline/src/stages/compose.ts pipeline/src/config/paths.ts pipeline/src/cli.ts pipeline/tests/layout/compose.test.ts
git commit -m "feat(compose): cover-fit approved panels into page grids"
```

---

### Task 8: `panels` stage with injected generator

**Files:**
- Create: `src/stages/panel-generate.ts`
- Modify: `src/cli.ts`
- Test: `tests/stages/panel-generate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/stages/panel-generate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generatePanels } from '../../src/stages/panel-generate.js';
import type { ChapterPlan } from '../../src/types/page-plan.js';

function plan(): ChapterPlan {
  return { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [{
    pageNumber: 3, isSplash: false, layout: { canvas: { w: 1600, h: 2264 }, slots: [] },
    panels: [
      { panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: ['spyke-tinwall'], speakerSides: {}, dialogue: [], sfx: '', prompt: 'P1', promptHash: 'h1', versions: [], approvedVersion: null },
      { panelNumber: 2, shotType: 'Wide', aspectRatio: '16:9', characterIds: [], speakerSides: {}, dialogue: [], sfx: '', prompt: 'P2', promptHash: 'h2',
        versions: [{ version: 1, file: 'raw/x/ch01_p03_pn2_v1.png', model: 'm', requestId: 'r', timestamp: 't', notes: '' }], approvedVersion: 1 },
    ],
  }] };
}

describe('generatePanels', () => {
  it('generates only unapproved panels, records a version, and auto-approves the first one', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'panels-'));
    const generate = vi.fn(async (req: { prompt: string; aspectRatio: string; refs: string[]; refGroups: Array<{ label: string; count: number }> }) => ({
      imageUrls: ['http://x/img.png'], requestId: 'req-1', model: { alias: 'runway-muse', endpoint: 'muse_image' },
    }));
    const download = vi.fn(async (_url: string, dest: string) => { await writeFile(dest, 'png'); });
    const p = plan();
    const result = await generatePanels(p, {
      chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: ['ref.png'], groups: [{ label: 'spyke-tinwall', count: 1 }] }),
      generate, download, notes: 'test',
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]![0]).toMatchObject({ prompt: 'P1', aspectRatio: '3:4', refs: ['ref.png'], refGroups: [{ label: 'spyke-tinwall', count: 1 }] });
    const panel = p.pages[0]!.panels[0]!;
    expect(panel.versions).toHaveLength(1);
    expect(panel.versions[0]!.file).toBe('raw/runway-muse/ch01_p03_pn1_v1.png');
    expect(panel.approvedVersion).toBe(1);
    expect(await readFile(path.join(root, panel.versions[0]!.file), 'utf-8')).toBe('png');
    expect(result.errors).toEqual([]);
  });

  it('redo generates approved panels too but does not change the approval', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'panels-'));
    const p = plan();
    const generate = vi.fn(async () => ({ imageUrls: ['u'], requestId: 'r', model: { alias: 'runway-muse', endpoint: 'muse_image' } }));
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: [], groups: [] }), generate, download: async (_u, d) => writeFile(d, 'x'), redo: true, notes: '' });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(p.pages[0]!.panels[1]!.versions).toHaveLength(2);
    expect(p.pages[0]!.panels[1]!.approvedVersion).toBe(1);
  });

  it('records provider errors per panel and continues', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'panels-'));
    const p = plan();
    const generate = vi.fn(async () => { throw new Error('boom'); });
    const result = await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: [], groups: [] }), generate, download: async () => {}, notes: '' });
    expect(result.errors).toEqual(['page 3 panel 1: boom']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/stages/panel-generate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the stage (pure core + CLI runner)**

```ts
// src/stages/panel-generate.ts
/**
 * Panels stage: one image per panel from pages.json.
 * The generator and downloader are injected so tests never touch the network.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import type { ChapterPlan, PanelPlan, PagePlan } from '../types/page-plan.js';
import { PATHS } from '../config/paths.js';
import { loadEnvFile } from '../utils/env.js';
import { loadChapterPlan, saveChapterPlan } from '../planning/page-plan.js';
import { loadCharacterReferences } from '../generation/references.js';
import { resolveModel, buildRefBindings, type ModelSpec } from '../generation/models.js';
import { configureProvider, generateImage, downloadAndSave, uploadToFal } from '../generation/kling-client.js';

export interface RefGroup { label: string; count: number }
export interface GenerateRequest { prompt: string; aspectRatio: string; refs: string[]; refGroups: RefGroup[] }
export interface GenerateResponse { imageUrls: string[]; requestId: string; model: { alias: string; endpoint: string } }

export interface GeneratePanelsDeps {
  chapterRoot: string;
  modelAlias: string;
  /** Reference image paths/URLs for the panel's characters, plus one binding group per character (in the same order). */
  refsFor: (characterIds: string[]) => Promise<{ refs: string[]; groups: RefGroup[] }>;
  generate: (req: GenerateRequest) => Promise<GenerateResponse>;
  download: (url: string, dest: string) => Promise<void>;
  notes: string;
  pages?: number[];
  panel?: number;
  redo?: boolean;
  log?: (msg: string) => void;
}

export function panelFileName(chapter: number, page: number, panel: number, version: number): string {
  return `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(2, '0')}_pn${panel}_v${version}.png`;
}

function shouldGenerate(panel: PanelPlan, deps: GeneratePanelsDeps): boolean {
  if (deps.panel != null && panel.panelNumber !== deps.panel) return false;
  return deps.redo === true || panel.approvedVersion == null;
}

/** Core: mutates the plan in place, writes images + logs, returns per-panel errors. */
export async function generatePanels(plan: ChapterPlan, deps: GeneratePanelsDeps): Promise<{ outputFiles: string[]; errors: string[] }> {
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const log = deps.log ?? (() => {});
  const rawDir = path.join(deps.chapterRoot, 'raw', deps.modelAlias);
  await mkdir(rawDir, { recursive: true });

  const pages: PagePlan[] = plan.pages.filter((p) => !deps.pages || deps.pages.includes(p.pageNumber));
  for (const page of pages) {
    for (const panel of page.panels) {
      if (!shouldGenerate(panel, deps)) continue;
      const version = panel.versions.reduce((n, v) => Math.max(n, v.version), 0) + 1;
      const file = panelFileName(plan.chapterNumber, page.pageNumber, panel.panelNumber, version);
      const rel = path.posix.join('raw', deps.modelAlias, file);
      try {
        const { refs, groups } = await deps.refsFor(panel.characterIds);
        const res = await deps.generate({ prompt: panel.prompt, aspectRatio: panel.aspectRatio, refs, refGroups: groups });
        if (res.imageUrls.length === 0) throw new Error('no images returned');
        const dest = path.join(deps.chapterRoot, rel);
        await deps.download(res.imageUrls[0]!, dest);
        const entry = { version, file: rel, model: res.model.endpoint, requestId: res.requestId, timestamp: new Date().toISOString(), notes: deps.notes };
        panel.versions.push(entry);
        if (panel.approvedVersion == null) panel.approvedVersion = version;
        await writeFile(`${dest}.log.json`, JSON.stringify({ ...entry, page: page.pageNumber, panel: panel.panelNumber, prompt: panel.prompt, refs }, null, 2));
        outputFiles.push(dest);
        log(`[panels] page ${page.pageNumber} panel ${panel.panelNumber} → ${file}`);
      } catch (e) {
        errors.push(`page ${page.pageNumber} panel ${panel.panelNumber}: ${(e as Error).message}`);
        log(`[panels] page ${page.pageNumber} panel ${panel.panelNumber}: ERROR ${(e as Error).message}`);
      }
    }
  }
  return { outputFiles, errors };
}

export interface PanelStageOptions { chapter: number; pages?: number[]; panel?: number; model?: string; redo?: boolean; notes?: string; verbose?: boolean; dryRun?: boolean }

/** CLI runner: wires real providers into generatePanels. */
export async function runPanels(options: PanelStageOptions): Promise<StageResult> {
  const start = Date.now();
  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'panels', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };

  let model: ModelSpec;
  try { model = resolveModel(options.model); if (!options.dryRun) configureProvider(model); }
  catch (e) { return { stage: 'panels', success: false, outputFiles: [], errors: [(e as Error).message], duration: Date.now() - start }; }

  const chapterRoot = PATHS.chapterOutput(options.chapter).root;
  const refCache = new Map<string, string[]>();
  const refsFor = async (ids: string[]) => {
    const refs: string[] = [];
    const groups: Array<{ label: string; count: number }> = [];
    let budget = model.maxRefs;
    const perChar = ids.length ? Math.max(1, Math.floor(budget / ids.length)) : 0;
    for (const id of ids) {
      if (!refCache.has(id)) {
        const local = await loadCharacterReferences(id);
        if (local.length === 0) console.warn(`  Warning: no reference images for ${id}`);
        refCache.set(id, model.provider === 'runway' ? local : await Promise.all(local.map(uploadToFal)));
      }
      const take = refCache.get(id)!.slice(0, Math.min(perChar, budget));
      if (take.length > 0) { refs.push(...take); groups.push({ label: id, count: take.length }); budget -= take.length; }
    }
    return { refs, groups };
  };

  if (options.dryRun) {
    const todo = plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber))
      .flatMap((p) => p.panels.filter((q) => (options.panel == null || q.panelNumber === options.panel) && (options.redo || q.approvedVersion == null)).map((q) => `p${p.pageNumber}/${q.panelNumber}`));
    console.log(`[panels] dry run via ${model.endpoint}: ${todo.length} panel(s): ${todo.join(' ')}`);
    return { stage: 'panels', success: true, outputFiles: [], errors: [], duration: Date.now() - start };
  }

  const { outputFiles, errors } = await generatePanels(plan, {
    chapterRoot, modelAlias: model.alias, refsFor, notes: options.notes ?? '', pages: options.pages, panel: options.panel, redo: options.redo,
    log: (m) => console.log(m),
    generate: async (req) => {
      const bindings = req.refGroups.length ? buildRefBindings(model, req.refGroups) + ' ' : '';
      const r = await generateImage({ model: model.alias, prompt: bindings + req.prompt, imageUrls: req.refs, aspectRatio: req.aspectRatio, resolution: '2K' });
      return { imageUrls: r.imageUrls, requestId: r.requestId, model: { alias: r.model.alias, endpoint: r.model.endpoint } };
    },
    download: downloadAndSave,
  });
  await saveChapterPlan(plan);
  return { stage: 'panels', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/stages/panel-generate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the CLI command** (in `src/cli.ts`)

```ts
program
  .command('panels')
  .description('Generate one image per panel from pages.json (skips approved panels unless --redo)')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--page <number>', 'Single page')
  .option('--pages <range>', 'Page range, e.g. "1-3"')
  .option('--panel <number>', 'Only this panel number (with --page)')
  .option('--model <name>', 'Model alias (default: runway-muse)')
  .option('--redo', 'Generate a new version even for approved panels')
  .option('--notes <text>', 'Notes stored with each version')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'List what would be generated without calling any API')
  .action(async (options) => {
    if (!options.chapter) { console.error("error: required option '-c, --chapter <number>' not specified"); process.exit(1); }
    const { runPanels } = await import('./stages/panel-generate.js');
    const result = await runPanels({ chapter: parseInt(options.chapter), pages: parsePages(options.pages, options.page), panel: options.panel ? parseInt(options.panel) : undefined,
      model: options.model, redo: options.redo, notes: options.notes, verbose: options.verbose, dryRun: options.dryRun });
    if (!result.success) { console.error('Stage failed:', result.errors); process.exit(1); }
  });
```

- [ ] **Step 6: Typecheck and dry-run only**

Run: `pnpm typecheck && pnpm dev panels -c 1 --pages 1-3 --dry-run`
Expected: `[panels] dry run via muse_image: 11 panel(s): p1/1 p1/2 p1/3 p2/1 ... p3/4`. **Do not run without `--dry-run`** — that is Phase 2 and needs the user's go.

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/stages/panel-generate.ts pipeline/src/cli.ts pipeline/tests/stages/panel-generate.test.ts
git commit -m "feat(panels): per-panel generation stage with injected provider"
```

---

### Task 9: Review contact sheet and approve command

**Files:**
- Create: `src/stages/review.ts`
- Modify: `src/cli.ts`
- Test: `tests/stages/review.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/stages/review.test.ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderContactSheet, approvePanel } from '../../src/stages/review.js';
import type { ChapterPlan } from '../../src/types/page-plan.js';

describe('review', () => {
  it('renders one row per panel with every version, and approve updates the plan', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'review-'));
    const mk = async (rel: string) => { const f = path.join(root, rel); await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toFile(f).catch(async () => { await writeFile(f, ''); }); return rel; };
    await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer(); // warm sharp
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(root, 'raw/m'), { recursive: true });
    const plan: ChapterPlan = { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [{
      pageNumber: 2, isSplash: false, layout: { canvas: { w: 1600, h: 2264 }, slots: [] },
      panels: [{ panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: {}, dialogue: [], sfx: '', prompt: 'p', promptHash: 'h',
        versions: [
          { version: 1, file: await mk('raw/m/a.png'), model: 'm', requestId: 'r', timestamp: 't', notes: '' },
          { version: 2, file: await mk('raw/m/b.png'), model: 'm', requestId: 'r', timestamp: 't', notes: '' },
        ], approvedVersion: 1 }],
    }] };
    const buf = await renderContactSheet(plan, plan.pages[0]!, root, { thumbWidth: 100 });
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBeGreaterThanOrEqual(2 * 100);
    expect(meta.height).toBeGreaterThan(48);

    approvePanel(plan, 2, 1, 2);
    expect(plan.pages[0]!.panels[0]!.approvedVersion).toBe(2);
    expect(() => approvePanel(plan, 2, 1, 9)).toThrow(/version 9/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/stages/review.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/stages/review.ts
/** Review: contact sheet of every version per panel; approve: pick the winner. */
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import type { ChapterPlan, PagePlan } from '../types/page-plan.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan, saveChapterPlan, findPanel } from '../planning/page-plan.js';

const PAD = 12;
const LABEL_H = 28;

function label(text: string, w: number, approved: boolean): Buffer {
  const bg = approved ? '#2e7d32' : '#333';
  return Buffer.from(`<svg width="${w}" height="${LABEL_H}"><rect width="${w}" height="${LABEL_H}" fill="${bg}"/>` +
    `<text x="8" y="19" font-family="sans-serif" font-size="16" fill="#fff">${text}${approved ? ' ✓' : ''}</text></svg>`);
}

export async function renderContactSheet(plan: ChapterPlan, page: PagePlan, chapterRoot: string, opts: { thumbWidth?: number } = {}): Promise<Buffer> {
  const tw = opts.thumbWidth ?? 320;
  const rows: Array<{ h: number; layers: OverlayOptions[] }> = [];
  let maxCols = 1;
  for (const panel of page.panels) {
    const layers: OverlayOptions[] = [];
    let rowH = LABEL_H;
    const versions = panel.versions.length ? panel.versions : [];
    maxCols = Math.max(maxCols, versions.length || 1);
    if (versions.length === 0) {
      layers.push({ input: label(`panel ${panel.panelNumber}: no versions`, tw, false), left: PAD, top: 0 });
    }
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i]!;
      const file = path.join(chapterRoot, v.file);
      const x = PAD + i * (tw + PAD);
      layers.push({ input: label(`panel ${panel.panelNumber}  v${v.version}`, tw, v.version === panel.approvedVersion), left: x, top: 0 });
      if (existsSync(file)) {
        const thumb = await sharp(file).resize(tw, undefined, { fit: 'inside' }).png().toBuffer();
        const th = (await sharp(thumb).metadata()).height ?? 0;
        layers.push({ input: thumb, left: x, top: LABEL_H });
        rowH = Math.max(rowH, LABEL_H + th);
      }
    }
    rows.push({ h: rowH, layers });
  }
  const width = PAD + maxCols * (tw + PAD);
  const height = rows.reduce((n, r) => n + r.h + PAD, PAD);
  let y = PAD;
  const all: OverlayOptions[] = [];
  for (const r of rows) { for (const l of r.layers) all.push({ ...l, top: (l.top as number) + y }); y += r.h + PAD; }
  return sharp({ create: { width, height, channels: 3, background: { r: 245, g: 245, b: 245 } } }).composite(all).png().toBuffer();
}

export function approvePanel(plan: ChapterPlan, page: number, panel: number, version: number): void {
  const p = findPanel(plan, page, panel);
  if (!p) throw new Error(`page ${page} panel ${panel} not in plan`);
  if (!p.versions.some((v) => v.version === version)) throw new Error(`page ${page} panel ${panel} has no version ${version}`);
  p.approvedVersion = version;
}

export async function runReview(options: { chapter: number; pages?: number[] }): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'review', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };
  const paths = PATHS.chapterOutput(options.chapter);
  await mkdir(paths.review, { recursive: true });
  const outputFiles: string[] = [];
  for (const page of plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber))) {
    const out = path.join(paths.review, `ch${String(options.chapter).padStart(2, '0')}_p${String(page.pageNumber).padStart(2, '0')}.png`);
    await writeFile(out, await renderContactSheet(plan, page, paths.root));
    outputFiles.push(out);
    console.log(`[review] ${path.basename(out)}`);
  }
  return { stage: 'review', success: true, outputFiles, errors: [], duration: Date.now() - start };
}

export async function runApprove(options: { chapter: number; page: number; panel: number; version: number }): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'approve', success: false, outputFiles: [], errors: ['pages.json not found'], duration: Date.now() - start };
  try { approvePanel(plan, options.page, options.panel, options.version); }
  catch (e) { return { stage: 'approve', success: false, outputFiles: [], errors: [(e as Error).message], duration: Date.now() - start }; }
  const file = await saveChapterPlan(plan);
  console.log(`[approve] page ${options.page} panel ${options.panel} → v${options.version}`);
  return { stage: 'approve', success: true, outputFiles: [file], errors: [], duration: Date.now() - start };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/stages/review.test.ts`
Expected: PASS

- [ ] **Step 5: CLI commands** (in `src/cli.ts`)

```ts
program
  .command('review')
  .description('Render a contact sheet of every panel version per page (output/ch-NN/review/)')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--page <number>', 'Single page')
  .option('--pages <range>', 'Page range')
  .action(async (options) => {
    if (!options.chapter) { console.error("error: required option '-c, --chapter <number>' not specified"); process.exit(1); }
    const { runReview } = await import('./stages/review.js');
    const result = await runReview({ chapter: parseInt(options.chapter), pages: parsePages(options.pages, options.page) });
    if (!result.success) { console.error('Stage failed:', result.errors); process.exit(1); }
  });

program
  .command('approve')
  .description('Approve a panel version in pages.json')
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .requiredOption('--page <number>', 'Page number')
  .requiredOption('--panel <number>', 'Panel number')
  .requiredOption('--version <number>', 'Version number to approve')
  .action(async (options) => {
    const { runApprove } = await import('./stages/review.js');
    const result = await runApprove({ chapter: parseInt(options.chapter), page: parseInt(options.page), panel: parseInt(options.panel), version: parseInt(options.version) });
    if (!result.success) { console.error('Failed:', result.errors); process.exit(1); }
  });
```

- [ ] **Step 6: Typecheck and run review on the placeholder plan**

Run: `pnpm typecheck && pnpm dev review -c 1 --page 3 && ls ../output/ch-01/review/`
Expected: `ch01_p03.png` exists showing "panel N: no versions" rows.

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/stages/review.ts pipeline/src/cli.ts pipeline/tests/stages/review.test.ts
git commit -m "feat(review): contact sheets and approve command"
```

---

### Task 10: Balloon placement inside a slot, and the bundled font

**Files:**
- Create: `src/overlay/placement.ts`
- Create: `src/overlay/fonts.ts`
- Create: `data/fonts/ComicNeue-Bold.otf` (download)
- Modify: `src/overlay/balloon.ts:115` (font family + size parameters)
- Test: `tests/overlay/placement.test.ts`

- [ ] **Step 1: Download the font (OFL)**

Run:
```bash
mkdir -p data/fonts && curl -fsSL -o data/fonts/ComicNeue-Bold.otf https://github.com/crozynski/comicneue/raw/master/Fonts/OTF/ComicNeue-Bold.otf && curl -fsSL -o data/fonts/OFL.txt https://github.com/crozynski/comicneue/raw/master/OFL.txt && ls -la data/fonts
```
Expected: two files; the OTF is roughly 40–80 KB. If the URL 404s, fetch the ZIP from https://fonts.google.com/specimen/Comic+Neue and copy `ComicNeue-Bold.ttf` instead (adjust the filename in `fonts.ts`).

- [ ] **Step 2: Font lookup**

```ts
// src/overlay/fonts.ts
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config/paths.js';

export interface LetterFont { family: string; fontfile?: string }

/** Bundled comic font, with a system fallback so lettering never fails on a missing file. */
export function letterFont(): LetterFont {
  for (const name of ['ComicNeue-Bold.otf', 'ComicNeue-Bold.ttf']) {
    const file = path.join(PATHS.pipelineRoot, 'data', 'fonts', name);
    if (existsSync(file)) return { family: 'Comic Neue', fontfile: file };
  }
  return { family: 'sans-serif' };
}
```

- [ ] **Step 3: Write the failing placement tests**

```ts
// tests/overlay/placement.test.ts
import { describe, it, expect } from 'vitest';
import { placeBalloons } from '../../src/overlay/placement.js';

const slot = { panelNumber: 1, x: 100, y: 200, w: 800, h: 600 };
const size = async (text: string) => ({ width: Math.min(60 + text.length * 8, 360), height: 60 });

describe('placeBalloons', () => {
  it('puts the speaker-left balloon at top-left and speaker-right at top-right, inside the slot', async () => {
    const out = await placeBalloons({
      slot,
      dialogue: [{ character: 'SPYKE', line: 'Get lost!', type: 'speech' }, { character: 'PUNK 1', line: 'Hey', type: 'speech' }],
      speakerSides: { SPYKE: 'left', 'PUNK 1': 'right' },
      measure: size, inset: 24, spacing: 12,
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.x).toBe(slot.x + 24);
    expect(out[0]!.y).toBe(slot.y + 24);
    expect(out[1]!.x + out[1]!.w).toBe(slot.x + slot.w - 24);
    for (const b of out) {
      expect(b.x).toBeGreaterThanOrEqual(slot.x);
      expect(b.x + b.w).toBeLessThanOrEqual(slot.x + slot.w);
      expect(b.y + b.h).toBeLessThanOrEqual(slot.y + slot.h);
    }
  });

  it('stacks repeated same-side balloons downward', async () => {
    const out = await placeBalloons({ slot, dialogue: [
      { character: 'SPYKE', line: 'One', type: 'speech' }, { character: 'SPYKE', line: 'Two', type: 'speech' }],
      speakerSides: { SPYKE: 'left' }, measure: size, inset: 24, spacing: 12 });
    expect(out[1]!.y).toBe(out[0]!.y + out[0]!.h + 12);
  });

  it('centres narration and off-panel speech at the top, and applies overrides', async () => {
    const out = await placeBalloons({ slot, dialogue: [
      { character: 'Narrator', line: 'Later.', type: 'narration' }, { character: 'INTERCOM', line: 'Attention', type: 'speech' }],
      speakerSides: {}, measure: size, inset: 24, spacing: 12, overrides: { 1: { dx: 10, dy: 5 } } });
    expect(Math.abs((out[0]!.x + out[0]!.w / 2) - (slot.x + slot.w / 2))).toBeLessThan(2);
    expect(out[1]!.tail).toBe('none');
    expect(out[1]!.x).toBe(Math.round(slot.x + (slot.w - out[1]!.w) / 2) + 10);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm vitest run tests/overlay/placement.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Implement placement**

```ts
// src/overlay/placement.ts
/** Balloon placement inside a known panel rectangle. Pure: measurement is injected. */
import type { SlotRect, DialogueLinePlan } from '../types/page-plan.js';

export interface PlacedBalloon {
  index: number;
  text: string;
  type: 'speech' | 'thought' | 'narration';
  x: number; y: number; w: number; h: number;
  tail: 'left' | 'right' | 'none';
}

export interface PlacementInput {
  slot: SlotRect;
  dialogue: DialogueLinePlan[];
  speakerSides: Record<string, 'left' | 'right'>;
  /** Returns balloon body size (already including padding) for a line, given max width. */
  measure: (text: string, maxWidth: number) => Promise<{ width: number; height: number }>;
  inset: number;
  spacing: number;
  overrides?: Record<string, { dx: number; dy: number }>;
}

export async function placeBalloons(i: PlacementInput): Promise<PlacedBalloon[]> {
  const { slot } = i;
  const maxW = Math.min(Math.floor(slot.w * 0.45), 420);
  const cursor = { left: slot.y + i.inset, right: slot.y + i.inset, centre: slot.y + i.inset };
  const placed: PlacedBalloon[] = [];

  for (let idx = 0; idx < i.dialogue.length; idx++) {
    const d = i.dialogue[idx]!;
    const side: 'left' | 'right' | 'centre' = d.type === 'narration' ? 'centre' : (i.speakerSides[d.character] ?? 'centre');
    const width = side === 'centre' && d.type === 'narration' ? Math.min(Math.floor(slot.w * 0.6), 560) : maxW;
    const m = await i.measure(d.line, width);
    const w = Math.min(m.width, width);
    const h = m.height;

    let x: number;
    if (side === 'left') x = slot.x + i.inset;
    else if (side === 'right') x = slot.x + slot.w - i.inset - w;
    else x = Math.round(slot.x + (slot.w - w) / 2);

    let y = cursor[side];
    // Keep inside the slot vertically; if it would overflow, pin to the bottom inset.
    y = Math.min(y, slot.y + slot.h - i.inset - h);
    cursor[side] = y + h + i.spacing;

    const o = i.overrides?.[String(idx)];
    if (o) { x += o.dx; y += o.dy; }

    placed.push({ index: idx, text: d.line, type: d.type, x, y, w, h, tail: side === 'centre' ? 'none' : side });
  }
  return placed;
}
```

- [ ] **Step 6: Make the balloon SVG accept a font and size**

In `src/overlay/balloon.ts`, change the signature to
`export function generateBalloonSvg(text: string, width: number, height: number, type: BalloonType, font: { family: string; size: number } = { family: 'sans-serif', size: 14 }): Buffer`
and at line ~115 replace `font-family="sans-serif" font-size="14"` with ``font-family="${font.family}" font-size="${font.size}"``. Existing callers keep working through the default. Also make the tail side selectable: add an optional 6th parameter `tail: 'left' | 'right' | 'none' = 'left'`; when `type === 'speech'` and `tail !== 'none'`, draw the tail polygon at 30% of the width for `left` and 70% for `right`; when `tail === 'none'` draw no tail (treat like thought/narration for the tail). Read the existing tail polygon code in that file and parametrise its x coordinate; do not restyle anything else.

- [ ] **Step 7: Run placement tests and the existing suite**

Run: `pnpm vitest run tests/overlay/placement.test.ts && pnpm test:run 2>&1 | tail -5`
Expected: placement PASS; the full suite still shows only the 3 pre-existing prompt-generator failures (fixed in Task 12).

- [ ] **Step 8: Commit**

```bash
git add pipeline/src/overlay/placement.ts pipeline/src/overlay/fonts.ts pipeline/src/overlay/balloon.ts pipeline/data/fonts pipeline/tests/overlay/placement.test.ts
git commit -m "feat(letter): slot-aware balloon placement and bundled Comic Neue"
```

---

### Task 11: `letter` stage

**Files:**
- Create: `src/stages/letter.ts`
- Modify: `src/cli.ts`
- Test: `tests/stages/letter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/stages/letter.test.ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { letterPage } from '../../src/stages/letter.js';
import type { PagePlan } from '../../src/types/page-plan.js';

describe('letterPage', () => {
  it('draws a balloon inside the speaking panel and leaves silent panels untouched', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'letter-'));
    const pageFile = path.join(dir, 'page.png');
    await sharp({ create: { width: 400, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } } }).png().toFile(pageFile);
    const page: PagePlan = {
      pageNumber: 1, isSplash: false,
      layout: { canvas: { w: 400, h: 600 }, slots: [
        { panelNumber: 1, x: 20, y: 20, w: 360, h: 260 }, { panelNumber: 2, x: 20, y: 300, w: 360, h: 280 }] },
      panels: [
        { panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: { SPYKE: 'left' },
          dialogue: [{ character: 'SPYKE', line: 'Hi', type: 'speech' }], sfx: '', prompt: 'p', promptHash: 'h', versions: [], approvedVersion: null },
        { panelNumber: 2, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: {}, dialogue: [], sfx: '', prompt: 'p', promptHash: 'h', versions: [], approvedVersion: null },
      ],
    };
    const out = await letterPage(pageFile, page);
    const px = async (x: number, y: number) => {
      const { data } = await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      return [data[0], data[1], data[2]];
    };
    expect(await px(60, 60)).toEqual([255, 255, 255]);   // inside the balloon (white fill)
    expect(await px(200, 450)).toEqual([0, 0, 255]);     // silent panel unchanged
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/stages/letter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/stages/letter.ts
/** Letter stage: composed page + pages.json slots → balloons and SFX in the right panels. */
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import type { PagePlan } from '../types/page-plan.js';
import { DEFAULT_OVERLAY_CONFIG } from '../types/overlay.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan } from '../planning/page-plan.js';
import { pageFileName } from './compose.js';
import { placeBalloons } from '../overlay/placement.js';
import { generateBalloonSvg } from '../overlay/balloon.js';
import { measureText } from '../overlay/text-measure.js';
import { renderSfx } from '../overlay/sfx.js';
import { letterFont } from '../overlay/fonts.js';

const INSET = 24;
const SPACING = 12;
const PAD = { x: 22, y: 16 };

function fontSizeFor(slotWidth: number): number {
  return Math.max(18, Math.min(34, Math.round(slotWidth / 28)));
}

export async function letterPage(pageFile: string, page: PagePlan): Promise<Buffer> {
  const font = letterFont();
  const layers: OverlayOptions[] = [];

  for (const slot of page.layout.slots) {
    const panel = page.panels.find((p) => p.panelNumber === slot.panelNumber);
    if (!panel) continue;
    const size = fontSizeFor(slot.w);
    const fontSpec = font.fontfile ? `${font.family}` : font.family;

    if (panel.dialogue.length > 0) {
      const balloons = await placeBalloons({
        slot, dialogue: panel.dialogue, speakerSides: panel.speakerSides, inset: INSET, spacing: SPACING,
        overrides: panel.balloonOverrides,
        measure: async (text, maxWidth) => {
          const m = await measureText(text, fontSpec, size, maxWidth - 2 * PAD.x, DEFAULT_OVERLAY_CONFIG.dpi);
          return { width: m.width + 2 * PAD.x, height: m.height + 2 * PAD.y };
        },
      });
      for (const b of balloons) {
        layers.push({ input: generateBalloonSvg(b.text, b.w, b.h, b.type, { family: font.family, size }, b.tail), left: Math.round(b.x), top: Math.round(b.y) });
      }
    }

    if (panel.sfx.trim()) {
      const sfx = await renderSfx(panel.sfx, { ...DEFAULT_OVERLAY_CONFIG, sfxFontSize: Math.round(size * 1.6) });
      if (sfx.length > 0) {
        const m = await sharp(sfx).metadata();
        layers.push({ input: sfx, left: Math.round(slot.x + (slot.w - (m.width ?? 0)) / 2), top: Math.round(slot.y + slot.h - (m.height ?? 0) - INSET) });
      }
    }
  }
  const img = sharp(pageFile);
  return layers.length ? img.composite(layers).png().toBuffer() : img.png().toBuffer();
}

export async function runLetter(options: { chapter: number; pages?: number[]; dryRun?: boolean }): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'letter', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };
  const paths = PATHS.chapterOutput(options.chapter);
  await mkdir(paths.lettered, { recursive: true });
  const outputFiles: string[] = [];
  const errors: string[] = [];
  for (const page of plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber))) {
    const name = pageFileName(options.chapter, page.pageNumber);
    const src = path.join(paths.pages, name);
    if (!existsSync(src)) { errors.push(`page ${page.pageNumber}: composed page missing (${src}); run compose first`); continue; }
    const out = path.join(paths.lettered, name);
    if (options.dryRun) { console.log(`[letter] page ${page.pageNumber}: ${page.panels.reduce((n, p) => n + p.dialogue.length, 0)} balloons → ${out}`); continue; }
    try { await writeFile(out, await letterPage(src, page)); outputFiles.push(out); console.log(`[letter] ${name}`); }
    catch (e) { errors.push(`page ${page.pageNumber}: ${(e as Error).message}`); }
  }
  return { stage: 'letter', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}
```

If `measureText` cannot see the bundled font by family name (Pango only finds installed fonts), extend `measureText` with an optional `fontfile` parameter passed through to Sharp's `text.fontfile`, and pass `font.fontfile` from `letterPage`. Sharp's text input accepts `{ text, font, fontfile, width, dpi, rgba, wrap }`.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/stages/letter.test.ts`
Expected: PASS

- [ ] **Step 5: CLI command** (in `src/cli.ts`)

```ts
program
  .command('letter')
  .description('Letter composed pages with balloons and SFX using pages.json slots (output/ch-NN/lettered/)')
  .option('-c, --chapter <number>', 'Chapter number (required)')
  .option('--page <number>', 'Single page')
  .option('--pages <range>', 'Page range')
  .option('--dry-run', 'Show what would be done')
  .action(async (options) => {
    if (!options.chapter) { console.error("error: required option '-c, --chapter <number>' not specified"); process.exit(1); }
    const { runLetter } = await import('./stages/letter.js');
    const result = await runLetter({ chapter: parseInt(options.chapter), pages: parsePages(options.pages, options.page), dryRun: options.dryRun });
    if (!result.success) { console.error('Stage failed:', result.errors); process.exit(1); }
  });
```

- [ ] **Step 6: Typecheck and letter the placeholder pages**

Run: `pnpm typecheck && pnpm dev letter -c 1 --pages 1-3 && ls ../output/ch-01/lettered/`
Expected: `ch01_p01.png` … `ch01_p03.png`; open page 3 and confirm balloons sit inside the correct grey slots, the punk's line top-left of panel 1, Spyke's "Don't touch me." on the right of panel 3, in Comic Neue.

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/stages/letter.ts pipeline/src/cli.ts pipeline/tests/stages/letter.test.ts
git commit -m "feat(letter): letter composed pages inside known panel slots"
```

---

### Task 12: Fix the stale prompt-generator tests and document the workflow

**Files:**
- Modify: `tests/templates/prompt-generator.test.ts` (three assertions on `'spiky ginger hair'`)
- Modify: `.claude/skills/plasma-generator/SKILL.md`
- Modify: `pipeline/package.json` (scripts)

- [ ] **Step 1: Update the stale assertions**

In `tests/templates/prompt-generator.test.ts`, replace each `toContain('spiky ginger hair')` with `toContain('STRAIGHT and layered')`, which is in the current Spyke fingerprint. Run `pnpm test:run` and confirm 0 failures.

- [ ] **Step 2: Add scripts**

In `pipeline/package.json` `scripts`, add:

```json
    "stage:plan": "tsx src/cli.ts plan",
    "stage:panels": "tsx src/cli.ts panels",
    "stage:review": "tsx src/cli.ts review",
    "stage:compose": "tsx src/cli.ts compose",
    "stage:letter": "tsx src/cli.ts letter",
```

- [ ] **Step 3: Document in the skill**

Replace the "Production prompts from the script" section of `.claude/skills/plasma-generator/SKILL.md` with:

```markdown
## Page production (panel pipeline)

1. `pnpm stage:script -- -c N` — parse the chapter script
2. `pnpm stage:plan -- -c N` — build `output/ch-NN/pages.json` (layout, per-panel prompts, speaker sides). Safe to re-run; approvals survive unless a panel's prompt changed.
3. `pnpm stage:panels -- -c N --pages A-B` — one Muse image per panel (skips approved; `--redo` for new versions; `--panel K` with `--page`). Output: `raw/<model>/chNN_pPP_pnK_vV.png`.
4. `pnpm stage:review -- -c N --page P` — contact sheet in `output/ch-NN/review/`; then `pnpm dev approve -c N --page P --panel K --version V`.
5. `pnpm stage:compose -- -c N` — page grids in `output/ch-NN/pages/` (grey MISSING slots for unapproved panels).
6. `pnpm stage:letter -- -c N` — balloons + SFX inside slots → `output/ch-NN/lettered/`. Nudge a balloon by adding `balloonOverrides: { "<dialogueIndex>": { "dx": 0, "dy": 0 } }` to the panel in `pages.json`.

`stage:kling` remains for single-image tests and reference work.
```

- [ ] **Step 4: Full verification**

Run: `pnpm typecheck && pnpm test:run 2>&1 | tail -4`
Expected: 0 type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add pipeline/tests/templates/prompt-generator.test.ts pipeline/package.json .claude/skills/plasma-generator/SKILL.md
git commit -m "chore: fix stale canon tests, add panel pipeline scripts and docs"
```

---

## Phase gates (for the human)

- **After Task 7:** open `output/ch-01/pages/ch01_p03.png` and `ch01_p06.png`. The grey layouts are the pacing proposal. Adjust weights in `src/layout/row-flow.ts` if a page reads wrong before spending a cent.
- **After Task 12:** `pnpm stage:panels -- -c 1 --pages 1-3` is the first paid run (about 11 panels, ~$0.11). Then `review`, `approve`, `compose`, `letter`, and compare against `raw/runway-muse/ch01_p001_v1.png` … `p003_v1.png`.
- Only after that comparison: pages 4–28.
