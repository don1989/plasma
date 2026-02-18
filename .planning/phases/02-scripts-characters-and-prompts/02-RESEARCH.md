# Phase 2: Scripts, Characters, and Prompts - Research

**Researched:** 2026-02-18
**Domain:** Manga script parsing, character data management, template-driven prompt generation (TypeScript)
**Confidence:** HIGH

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRP-01 | Pipeline can convert a prose story chapter into a structured panel-by-panel manga script following manga-script.md rules | Markdown parsing with remark/unified to extract structured data from existing chapter-01-script.md format; parser outputs typed Chapter/Page/Panel objects |
| SCRP-02 | Generated scripts include shot types, panel composition notes, dialogue, and SFX per panel | Panel interface expanded with shotType, action, dialogue, sfx, notes fields -- all directly extractable from the existing markdown heading/field pattern |
| SCRP-03 | Script validation checks panel counts (4-7 per page), pacing rules, and required shot types | Zod schemas for panel/page/chapter validation with custom refinements for panel counts, shot type enums, and pacing rule checks |
| CHAR-01 | Locked prompt fingerprint exists for each character -- tested and validated description block | YAML character files in pipeline/data/characters/ with verbatim prompt text blocks; Zod-validated on load |
| CHAR-02 | Per-panel QC checklist compares generated panels against character reference sheets | QC report generator that cross-references characters-in-scene against character registry; outputs a checklist markdown |
| CHAR-03 | New character introduction workflow generates reference sheets before chapter prompts | CLI subcommand `character add` that scaffolds a new YAML character file from glossary data and validates it |
| CHAR-04 | Character reference data stored in structured format (YAML/JSON) for template injection | YAML files parsed with `yaml` npm package, validated with Zod, typed as CharacterFingerprint interface |
| PRMT-01 | Pipeline generates Gemini-optimized art prompts from manga scripts, one prompt per page | Nunjucks template engine renders page-level prompts from script data + character fingerprints + style prefix |
| PRMT-02 | Every prompt embeds the full character visual description inline (prompt fingerprint system) | Template includes block that iterates characters-in-scene and injects their verbatim fingerprint text |
| PRMT-03 | Style guide prefix is locked verbatim and included in every prompt automatically | Style prefix stored as a standalone template partial / YAML config value, included at template top |
| PRMT-04 | Jinja2-style template library manages character blocks, style prefix, and setting descriptions | Nunjucks (Jinja2-inspired) with Environment.renderString(), custom filters, and partial includes |
| PRMT-05 | Templates can be updated in one place and propagate to all generated prompts | Single-source YAML for characters + single-source template files; prompt generation always re-renders from current sources |

</phase_requirements>

## Summary

Phase 2 transforms the pipeline from a stub scaffold into a working data pipeline that reads existing manga scripts (markdown), manages character visual descriptions (YAML), and generates Gemini-optimized art prompts (Nunjucks templates). The core challenge is not AI or image generation -- it is **data modeling and template engineering**. The existing `03_manga/chapter-01-script.md` file already contains a fully written manga script with 29 pages of panels following the exact format defined in `03_manga/manga-script.md`. The pipeline must parse this structured markdown into typed TypeScript objects, then feed those objects through a template engine alongside character fingerprints to produce one prompt per page.

The existing prompt files (`03_manga/prompts/pages-01-to-15.md`, `pages-16-to-29.md`) are the **gold standard output** -- they show exactly what a generated prompt should look like. Each prompt embeds a style guide prefix, character descriptions inline, and panel-by-panel composition instructions. The character-sheets.md file shows the reference sheet prompt format. The pipeline's job is to automate what was previously done by hand: assembling these prompts from script data + character descriptions + style guide.

The character consistency problem is addressed architecturally: every character gets a YAML file with their verbatim prompt fingerprint (the exact text block proven to produce consistent Gemini output). These fingerprints are injected into prompts via Nunjucks templates. Updating a character's YAML file automatically propagates to every prompt on the next generation run. This is a template compilation problem, not an AI problem.

**Primary recommendation:** Use remark (unified ecosystem) for markdown parsing, the `yaml` npm package for YAML character data, Zod for schema validation, and Nunjucks for Jinja2-style template rendering. All data flows through typed TypeScript interfaces validated by Zod schemas.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nunjucks | 3.2.4 | Jinja2-style template engine for prompt generation | Requirement PRMT-04 specifies "Jinja2-style." Nunjucks is Mozilla's Jinja2 port for JS. Has renderString() for programmatic use, custom filters, template inheritance. 2600+ npm dependents |
| yaml | ^2.7 | YAML parsing/serialization for character fingerprint files | Zero dependencies, 85M+ weekly downloads, full YAML 1.2 support, TypeScript types bundled. Superior to js-yaml for TS projects |
| zod | ^4.3 | Schema validation for parsed scripts, character data, and prompt configs | TypeScript-first, 14x faster in v4, infers TS types from schemas. Perfect for validating YAML-parsed data and markdown-extracted structures |
| remark-parse | ^11 | Markdown-to-AST parser for manga script files | Part of unified ecosystem, 500+ plugins, full TypeScript support. Parses markdown headings/bold fields into walkable MDAST tree |
| unified | ^11 | Content processing pipeline for markdown parsing | Core engine for remark. Compose parse/transform/stringify steps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/nunjucks | ^3.2 | TypeScript definitions for Nunjucks | Always -- enables type-safe template rendering calls |
| @types/mdast | ^4 | TypeScript types for markdown AST nodes | When writing the markdown parser/walker for script extraction |
| unist-util-visit | ^5 | Walk/visit nodes in a unified syntax tree | When extracting panels, pages, dialogue from parsed markdown AST |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nunjucks | Eta | Eta is faster and written in TypeScript natively, but lacks Jinja2 syntax compatibility. Requirement PRMT-04 explicitly says "Jinja2-style" -- Nunjucks is the direct Jinja2 port |
| Nunjucks | LiquidJS | Liquid syntax (Shopify-style) differs from Jinja2. Would require learning a different template syntax |
| remark | marked / markdown-it | These produce HTML, not a walkable AST. We need to extract structured data (headings, bold fields, code blocks), not render HTML |
| remark | Custom regex parser | The manga-script.md format is regular enough for regex, but fragile. remark handles edge cases (nested formatting, code blocks with backticks) that regex would break on |
| Zod | Manual validation | Zod provides TypeScript type inference for free. Manual validation means maintaining types AND validators separately |
| yaml | js-yaml | js-yaml has no bundled TypeScript types (needs @types/js-yaml). The `yaml` package has superior TS support and zero dependencies |

**Installation:**
```bash
cd pipeline
pnpm add nunjucks yaml zod unified remark-parse unist-util-visit
pnpm add -D @types/nunjucks @types/mdast
```

## Architecture Patterns

### Recommended Project Structure

```
pipeline/
├── src/
│   ├── cli.ts                    # Existing -- add character subcommand
│   ├── config/
│   │   ├── paths.ts              # Existing -- add new path constants
│   │   └── defaults.ts           # Existing
│   ├── types/
│   │   ├── index.ts              # Existing -- re-export new types
│   │   ├── pipeline.ts           # Existing
│   │   ├── manga.ts              # Existing -- expand Panel/Page/Chapter
│   │   └── characters.ts         # NEW -- CharacterFingerprint, CharacterRegistry
│   ├── schemas/                  # NEW -- Zod validation schemas
│   │   ├── manga.schema.ts       # Panel, Page, Chapter validation
│   │   └── character.schema.ts   # Character fingerprint validation
│   ├── parsers/                  # NEW -- data extraction
│   │   └── script-parser.ts      # Markdown -> Chapter typed object
│   ├── characters/               # NEW -- character data management
│   │   ├── registry.ts           # Load all character YAML files
│   │   └── qc.ts                 # QC checklist generation (CHAR-02)
│   ├── templates/                # NEW -- Nunjucks template management
│   │   ├── engine.ts             # Nunjucks Environment setup, filters
│   │   └── prompt-generator.ts   # Script + Characters -> Prompts
│   ├── stages/
│   │   ├── script.ts             # Existing stub -- implement with parser
│   │   └── prompt.ts             # Existing stub -- implement with templates
│   └── utils/
│       └── fs.ts                 # Existing
├── data/                         # NEW -- pipeline-owned data files
│   ├── characters/               # Character fingerprint YAML files
│   │   ├── spyke-tinwall.yaml
│   │   ├── june-kamara.yaml
│   │   ├── draster.yaml
│   │   ├── hood-morkain.yaml
│   │   └── punks.yaml
│   ├── templates/                # Nunjucks template files
│   │   ├── page-prompt.njk       # Main per-page prompt template
│   │   ├── character-sheet.njk   # Character reference sheet template
│   │   └── partials/
│   │       ├── style-prefix.njk  # Locked style guide prefix
│   │       └── character-block.njk  # Character description injection
│   └── config/
│       └── style-guide.yaml      # Style guide prefix text + settings
├── tests/
│   ├── parsers/
│   │   └── script-parser.test.ts
│   ├── schemas/
│   │   ├── manga.schema.test.ts
│   │   └── character.schema.test.ts
│   ├── characters/
│   │   └── registry.test.ts
│   ├── templates/
│   │   ├── engine.test.ts
│   │   └── prompt-generator.test.ts
│   └── stages/
│       └── script.test.ts        # Existing -- expand
└── package.json                  # Existing -- add new dependencies
```

### Pattern 1: Markdown Script Parsing (SCRP-01, SCRP-02)

**What:** Parse the existing manga script markdown format into typed TypeScript objects.
**When to use:** When the `script` stage runs for a chapter.
**Why this approach:** The existing chapter-01-script.md follows a consistent heading structure (`## Page N` / `### Panel N -- Shot Type` / `**Action:**` / `**Dialogue:**` / `**SFX:**` / `**Notes:**`). This is a well-defined grammar that maps directly to a tree walk.

**The existing format (from chapter-01-script.md):**
```markdown
## Page 1

### Panel 1 -- Wide

**Action:** Establishing shot. London skyline, year 3031...
**Dialogue:** --
**SFX:** --
**Notes:** Set the scale immediately...
```

**Parsing strategy:**
```typescript
// Source: unified/remark-parse documentation
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Heading, Strong, Text } from 'mdast';

interface ParsedPanel {
  panelNumber: number;
  shotType: string;         // "Wide", "Medium", "Close-up", etc.
  action: string;
  dialogue: DialogueLine[];
  sfx: string;
  notes: string;
  tags: string[];           // "[PAGE-TURN REVEAL]", "[PLAYER DECISION POINT]"
}

interface DialogueLine {
  character: string;
  line: string;
  type: 'speech' | 'thought' | 'narration';
}

interface ParsedPage {
  pageNumber: number;
  panels: ParsedPanel[];
  isSplash: boolean;
  isDoubleSpread: boolean;
}

interface ParsedChapter {
  chapterNumber: number;
  title: string;
  themeBeat: string;
  estimatedPages: number;
  characters: string[];
  locations: string[];
  pages: ParsedPage[];
}

function parseScript(markdown: string): ParsedChapter {
  const tree = unified().use(remarkParse).parse(markdown);
  // Walk tree: H2 = pages, H3 = panels, Strong = field labels
  // Extract panel data by visiting heading nodes and their siblings
  // ...
}
```

**Key insight:** The parser does NOT need to understand manga -- it needs to understand the specific heading/field pattern in `manga-script.md`. The format is already defined and consistently followed in chapter-01-script.md.

### Pattern 2: Character Fingerprint Registry (CHAR-01, CHAR-04)

**What:** YAML files containing verbatim prompt text blocks for each character, loaded into a typed registry.
**When to use:** When any prompt is generated that includes a character.

**Character YAML format:**
```yaml
# pipeline/data/characters/spyke-tinwall.yaml
id: spyke-tinwall
name: Spyke Tinwall
aliases: ["Spyke", "Redhead"]

# The verbatim prompt fingerprint -- this exact text goes into every prompt
# DO NOT paraphrase or rearrange. This text has been tested with Gemini.
fingerprint: |
  Spyke (age 21) — spiky ginger hair (tips reach traps), red bandana,
  green eyes, white knee-length cloak (sleeves cut, dojo emblem on back,
  pattern along bottom hem), red fingerless glove on left hand with red
  bracer on left wrist, armoured full-fingered glove on right hand,
  red-accented belt, metal knee pauldron on right knee, massive broadsword
  on back, patterned katana at left hip, black combat clothing under
  the cloak

# Extended description for character reference sheet prompts
reference_sheet_prompt: |
  Colored manga character reference sheet, Spyke Tinwall. Clean linework,
  cel-shaded, vibrant colors, high-resolution, white background.
  ...

# Color palette for consistency notes
palette:
  primary: ["red (bandana, glove, bracer)", "white (cloak)", "black (combat clothing)"]
  accent: ["ginger (hair)", "green (eyes)", "grey/metallic (broadsword, knee pauldron)"]

# Variants for different story states
variants:
  adrenaline_mode: "eyes turn red, art style becomes sharper/more intense, heavier inks"
  demon_active: "left eye turns purple/black sclera, arm may transform green/purple"
```

**Registry loader:**
```typescript
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const CharacterFingerprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  fingerprint: z.string().min(20),  // Must be substantial
  reference_sheet_prompt: z.string().optional(),
  palette: z.object({
    primary: z.array(z.string()),
    accent: z.array(z.string()),
  }).optional(),
  variants: z.record(z.string()).optional(),
});

type CharacterFingerprint = z.infer<typeof CharacterFingerprintSchema>;

class CharacterRegistry {
  private characters: Map<string, CharacterFingerprint> = new Map();

  async loadAll(dirPath: string): Promise<void> {
    // Read all .yaml files from dirPath
    // Parse each with yaml package
    // Validate each with Zod schema
    // Store in map keyed by id and all aliases
  }

  get(nameOrAlias: string): CharacterFingerprint | undefined {
    return this.characters.get(nameOrAlias.toLowerCase());
  }

  getFingerprint(nameOrAlias: string): string {
    const char = this.get(nameOrAlias);
    if (!char) throw new Error(`Unknown character: ${nameOrAlias}`);
    return char.fingerprint;
  }
}
```

### Pattern 3: Template-Driven Prompt Generation (PRMT-01 through PRMT-05)

**What:** Nunjucks templates that combine style prefix + character fingerprints + panel data into Gemini-optimized prompts.
**When to use:** When the `prompt` stage runs for a chapter.

**Template structure:**
```
{# pipeline/data/templates/page-prompt.njk #}
{{ style_prefix }}

{{ panel_count }}-panel {{ layout_description }}.

{% for panel in panels %}
PANEL {{ panel.panelNumber }} ({{ panel.shotType | upper }}{% if panel.position %} -- {{ panel.position }}{% endif %}): {{ panel.action }}
{% if panel.characters_in_scene %}
{# Inject character fingerprints for all characters in this panel #}
{% for char_name in panel.characters_in_scene %}
Character: {{ characters[char_name].fingerprint }}
{% endfor %}
{% endif %}
{% if panel.dialogue and panel.dialogue != '--' %}
{% for line in panel.dialogue_lines %}
Speech balloon{% if line.type == 'thought' %} (thought bubble){% endif %}: {{ line.character }}: "{{ line.line }}"
{% endfor %}
{% endif %}
{% if panel.sfx and panel.sfx != '--' %}
Stylized SFX text: "{{ panel.sfx }}"
{% endif %}
{% if panel.notes %}
{{ panel.notes }}
{% endif %}

{% endfor %}
```

**Style prefix partial (locked verbatim):**
```
{# pipeline/data/templates/partials/style-prefix.njk #}
Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.
```

**Engine setup:**
```typescript
import nunjucks from 'nunjucks';

function createPromptEngine(templateDir: string): nunjucks.Environment {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templateDir),
    {
      autoescape: false,       // Prompts are plain text, not HTML
      throwOnUndefined: true,  // Catch missing variables immediately
      trimBlocks: true,
      lstripBlocks: true,
    }
  );

  // Custom filters
  env.addFilter('upper', (str: string) => str.toUpperCase());
  env.addFilter('fingerprint', (charName: string, registry: CharacterRegistry) =>
    registry.getFingerprint(charName)
  );

  return env;
}
```

### Pattern 4: Script Validation (SCRP-03)

**What:** Zod schemas with custom refinements that enforce manga-script.md rules.
**When to use:** After parsing a script, before passing to prompt generation.

```typescript
import { z } from 'zod';

const ShotType = z.enum([
  'Wide', 'Medium', 'Medium-Wide', 'Close-up',
  'Extreme close-up', "Bird's eye", 'Low angle',
  'Full Page', 'Full Double Spread',
]);

const PanelSchema = z.object({
  panelNumber: z.number().int().positive(),
  shotType: ShotType,
  action: z.string().min(1),
  dialogue: z.array(z.object({
    character: z.string(),
    line: z.string(),
    type: z.enum(['speech', 'thought', 'narration']),
  })),
  sfx: z.string(),
  notes: z.string(),
});

const PageSchema = z.object({
  pageNumber: z.number().int().positive(),
  panels: z.array(PanelSchema),
  isSplash: z.boolean(),
  isDoubleSpread: z.boolean(),
}).refine(
  (page) => {
    if (page.isSplash) return page.panels.length === 1;
    if (page.isDoubleSpread) return page.panels.length === 1;
    return page.panels.length >= 4 && page.panels.length <= 7;
  },
  { message: 'Standard pages must have 4-7 panels (splash/spread pages have 1)' }
);

const ChapterSchema = z.object({
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1),
  pages: z.array(PageSchema).min(1),
}).refine(
  (ch) => {
    // Every chapter must end with a hook
    // At least one page must have a wide/establishing shot
    const hasWideShot = ch.pages.some(p =>
      p.panels.some(panel => panel.shotType === 'Wide')
    );
    return hasWideShot;
  },
  { message: 'Chapter must contain at least one Wide/establishing shot' }
);
```

### Anti-Patterns to Avoid

- **Baking character descriptions into templates:** The fingerprint text MUST come from YAML data files, never hardcoded in templates. This violates PRMT-05 (single-source propagation).
- **Parsing markdown with regex:** The script format has nested structures (dialogue lines within panels within pages). Regex parsers break on edge cases like multi-line dialogue, code blocks in notes, and em-dashes in shot type labels.
- **Generating prompts as plain string concatenation:** Use the template engine. String concatenation makes it impossible to audit what goes into a prompt, and updating the format requires changing code instead of templates.
- **Storing character data in TypeScript constants:** Character fingerprints must be editable without touching code. YAML files can be edited, validated, and version-controlled independently.
- **One template per page:** Use a single parameterized template with conditionals for splash pages, double spreads, etc. One template per page is unmaintainable at 29+ pages per chapter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex tokenizer for heading/field extraction | remark-parse + unist-util-visit | Edge cases: multi-line dialogue, code fences, em-dashes in headings, nested bold/italic |
| YAML parsing | Custom key-value parser | `yaml` npm package | YAML has 63 characters that need special handling. Multi-line strings (`|`, `>`), anchors, aliases |
| Data validation | Manual if/else checks with string errors | Zod schemas with refinements | Zod infers TypeScript types from schemas -- no duplicate type definitions. Error messages are structured and actionable |
| Template rendering | String interpolation / template literals | Nunjucks Environment | Template literals can't do conditionals, loops, includes, filters, or inheritance. Nunjucks provides all of these |
| Character name matching | Exact string comparison | Case-insensitive alias lookup map | Script says "SPYKE" or "Spyke" or "spyke" -- all must resolve to the same fingerprint |

**Key insight:** Every "simple" problem in this phase has edge cases that existing libraries handle. The manga script format looks regular but has splash pages, double spreads, silent panels (no dialogue), player decision points, and director's notes sections that a naive parser would choke on.

## Common Pitfalls

### Pitfall 1: Character Name Mismatch Between Script and Registry

**What goes wrong:** Script says `PUNK 1` or `REGISTRAR`, character YAML has `punk-leader` or doesn't exist. Prompt generation silently omits the character fingerprint or crashes.
**Why it happens:** Manga scripts use informal/dialogue names, YAML uses canonical IDs.
**How to avoid:** The CharacterRegistry must support aliases. Every YAML file lists all names the character is called by in scripts. The registry builds a case-insensitive lookup map from all aliases. Unknown characters produce a warning, not a crash -- minor characters (registrar, commuters) don't need fingerprints.
**Warning signs:** Prompts that mention a character in the action text but don't include their visual description.

### Pitfall 2: Panel Count Validation on Special Pages

**What goes wrong:** Validator rejects splash pages (1 panel) and action montages (8-10 panels) because the rule says "4-7 panels."
**Why it happens:** The 4-7 rule applies to "standard scenes" only. The manga-script.md explicitly allows splash pages (1 panel), double-spreads (1 panel), and action montages (up to 9-10).
**How to avoid:** The page schema must have `isSplash` and `isDoubleSpread` flags. When true, panel count validation is relaxed. Action montages should be flagged as warnings, not errors.
**Warning signs:** Every chapter failing validation on its splash/spread pages.

### Pitfall 3: Dialogue Parsing Edge Cases

**What goes wrong:** Parser mishandles thought bubbles `(thought)`, narration boxes `(narration)`, empty dialogue `--`, off-panel dialogue, and interrupted speech `"I asked you a qu--"`.
**Why it happens:** Dialogue in the script format has multiple sub-patterns: character name, optional type annotation, the actual text, and em-dashes for empty/missing dialogue.
**How to avoid:** Parse dialogue lines with explicit pattern matching:
- `- CHARACTER: "line"` = speech
- `- CHARACTER (thought): *line*` = thought
- `- (narration): *line*` = narration
- `**Dialogue:** --` = no dialogue (silent panel)
- `CHARACTER (off-panel): "line"` = off-panel speech
**Warning signs:** All thought bubbles rendered as regular speech, or narration boxes missing.

### Pitfall 4: Style Prefix Drift

**What goes wrong:** Someone edits the style prefix in one template but not others, or paraphrases it slightly. Gemini produces inconsistent art across pages.
**Why it happens:** The style prefix must be identical (verbatim) in every prompt. The CLAUDE.md explicitly warns: "never paraphrase."
**How to avoid:** Store the style prefix in exactly ONE place (style-guide.yaml or style-prefix.njk partial). Every prompt template includes it via `{% include %}` or variable injection. Never copy-paste the prefix text into individual templates.
**Warning signs:** Generated prompts with slightly different opening lines.

### Pitfall 5: Treating This as a "Prose to Script" AI Problem

**What goes wrong:** Team assumes SCRP-01 means "use AI to convert prose chapters into manga scripts." This is a massive scope expansion.
**Why it happens:** The requirement says "convert a prose story chapter into a structured script." But the scripts already exist -- chapter-01-script.md is 967 lines of human-written manga script.
**How to avoid:** Phase 2's "script" stage parses EXISTING markdown scripts into typed data structures. It does NOT generate new scripts from prose. The input is `03_manga/chapter-01-script.md` (already formatted), not `01_bible/story-bible.md` (raw prose). Future phases may add AI script generation, but Phase 2 is about parsing what already exists.
**Warning signs:** Discussion of LLM integration, prose analysis, or "AI scriptwriter" features in Phase 2 planning.

### Pitfall 6: Over-Engineering the Template System

**What goes wrong:** Building a complex template inheritance hierarchy with dozens of template files, custom tags, and a plugin system.
**Why it happens:** Nunjucks supports deep template inheritance, macros, async rendering, etc. It's tempting to use all of it.
**How to avoid:** Start with exactly 3 templates: `page-prompt.njk` (main), `character-sheet.njk` (reference sheets), and `partials/style-prefix.njk` (the locked prefix). Add complexity only when a real chapter demonstrates the need.
**Warning signs:** Template directory with 10+ files before a single chapter has been processed.

## Code Examples

Verified patterns from official sources and project analysis:

### Parsing Manga Script Markdown

```typescript
// Source: unified/remark-parse API + existing chapter-01-script.md format
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Paragraph, Strong } from 'mdast';

function parseChapterScript(markdown: string): ParsedChapter {
  const tree = unified().use(remarkParse).parse(markdown);
  const chapter: Partial<ParsedChapter> = { pages: [] };
  let currentPage: Partial<ParsedPage> | null = null;
  let currentPanel: Partial<ParsedPanel> | null = null;

  visit(tree, (node, index, parent) => {
    if (node.type === 'heading') {
      const heading = node as Heading;
      const text = extractText(heading);

      if (heading.depth === 1) {
        // # Chapter 1: The Exam
        const match = text.match(/Chapter\s+(\d+):\s+(.+)/);
        if (match) {
          chapter.chapterNumber = parseInt(match[1]);
          chapter.title = match[2];
        }
      } else if (heading.depth === 2) {
        // ## Page 1 or ## Page 25 -- DOUBLE-PAGE SPREAD
        if (currentPage) {
          if (currentPanel) currentPage.panels!.push(currentPanel as ParsedPanel);
          chapter.pages!.push(currentPage as ParsedPage);
        }
        currentPanel = null;
        const pageMatch = text.match(/Page\s+(\d+)/);
        if (pageMatch) {
          currentPage = {
            pageNumber: parseInt(pageMatch[1]),
            panels: [],
            isSplash: text.includes('SPLASH'),
            isDoubleSpread: text.includes('DOUBLE-PAGE SPREAD'),
          };
        }
      } else if (heading.depth === 3) {
        // ### Panel 1 -- Wide
        if (currentPanel && currentPage) {
          currentPage.panels!.push(currentPanel as ParsedPanel);
        }
        const panelMatch = text.match(/Panel\s+(\d+)\s+.*?(\w[\w\s-]*\w|\w)/);
        if (panelMatch) {
          currentPanel = {
            panelNumber: parseInt(panelMatch[1]),
            shotType: panelMatch[2].trim(),
            action: '',
            dialogue: [],
            sfx: '',
            notes: '',
            tags: [],
          };
        }
      }
    }

    // Extract bold-labeled fields: **Action:**, **Dialogue:**, **SFX:**, **Notes:**
    if (node.type === 'paragraph' && currentPanel) {
      const text = extractText(node);
      if (text.startsWith('Action:')) {
        currentPanel.action = text.replace('Action:', '').trim();
      } else if (text.startsWith('SFX:')) {
        currentPanel.sfx = text.replace('SFX:', '').trim();
      } else if (text.startsWith('Notes:')) {
        currentPanel.notes = text.replace('Notes:', '').trim();
      }
    }
  });

  // Don't forget the last page/panel
  if (currentPanel && currentPage) currentPage.panels!.push(currentPanel as ParsedPanel);
  if (currentPage) chapter.pages!.push(currentPage as ParsedPage);

  return chapter as ParsedChapter;
}
```

### Loading Character YAML with Validation

```typescript
// Source: yaml npm package docs + zod docs
import { readFile, readdir } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import path from 'node:path';

const CharacterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  fingerprint: z.string().min(20, 'Fingerprint must be substantial'),
  reference_sheet_prompt: z.string().optional(),
  palette: z.object({
    primary: z.array(z.string()),
    accent: z.array(z.string()),
  }).optional(),
  variants: z.record(z.string()).optional(),
});

type Character = z.infer<typeof CharacterSchema>;

async function loadCharacters(dir: string): Promise<Map<string, Character>> {
  const files = await readdir(dir);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const registry = new Map<string, Character>();

  for (const file of yamlFiles) {
    const content = await readFile(path.join(dir, file), 'utf-8');
    const raw = parseYaml(content);
    const result = CharacterSchema.safeParse(raw);

    if (!result.success) {
      console.error(`Invalid character file ${file}:`, result.error.format());
      continue;
    }

    const char = result.data;
    // Register by ID, name, and all aliases (case-insensitive)
    registry.set(char.id, char);
    registry.set(char.name.toLowerCase(), char);
    for (const alias of char.aliases) {
      registry.set(alias.toLowerCase(), char);
    }
  }

  return registry;
}
```

### Rendering a Page Prompt with Nunjucks

```typescript
// Source: nunjucks API docs (renderString, addFilter, Environment)
import nunjucks from 'nunjucks';
import path from 'node:path';

function createPromptEngine(templateDir: string): nunjucks.Environment {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templateDir),
    {
      autoescape: false,        // Plain text prompts, not HTML
      throwOnUndefined: true,   // Catch missing character names immediately
      trimBlocks: true,         // Remove newlines after block tags
      lstripBlocks: true,       // Strip leading whitespace before block tags
    }
  );
  return env;
}

interface PromptContext {
  style_prefix: string;
  page: ParsedPage;
  characters: Map<string, Character>;
  setting: string;
}

function generatePagePrompt(
  env: nunjucks.Environment,
  context: PromptContext
): string {
  // Resolve character fingerprints for all characters appearing in this page
  const panelsWithChars = context.page.panels.map(panel => ({
    ...panel,
    character_fingerprints: extractCharacterNames(panel)
      .map(name => context.characters.get(name.toLowerCase()))
      .filter(Boolean)
      .map(c => c!.fingerprint),
  }));

  return env.render('page-prompt.njk', {
    style_prefix: context.style_prefix,
    panels: panelsWithChars,
    panel_count: context.page.panels.length,
    page_number: context.page.pageNumber,
    is_splash: context.page.isSplash,
    is_double_spread: context.page.isDoubleSpread,
  });
}
```

### QC Checklist Generation (CHAR-02)

```typescript
// Per-panel QC: compare characters in scene against registry
interface QCChecklistItem {
  pageNumber: number;
  panelNumber: number;
  character: string;
  hasFingerprint: boolean;
  hasReferenceSheet: boolean;
  fingerprintIncluded: boolean;
  notes: string;
}

function generateQCChecklist(
  chapter: ParsedChapter,
  registry: Map<string, Character>,
  generatedPrompts: string[]
): QCChecklistItem[] {
  const checklist: QCChecklistItem[] = [];

  for (const page of chapter.pages) {
    const prompt = generatedPrompts[page.pageNumber - 1] || '';

    for (const panel of page.panels) {
      const characters = extractCharacterNames(panel);
      for (const charName of characters) {
        const char = registry.get(charName.toLowerCase());
        checklist.push({
          pageNumber: page.pageNumber,
          panelNumber: panel.panelNumber,
          character: charName,
          hasFingerprint: !!char,
          hasReferenceSheet: !!(char?.reference_sheet_prompt),
          fingerprintIncluded: char ? prompt.includes(char.fingerprint.trim()) : false,
          notes: char ? '' : `WARNING: No fingerprint found for "${charName}"`,
        });
      }
    }
  }

  return checklist;
}
```

## Data Format Analysis

### Existing Manga Script Format (chapter-01-script.md)

The existing Chapter 1 script is 967 lines of markdown following the exact template from manga-script.md:
- **29 pages** with panels ranging from 1 (splash) to 5 per page
- **Header metadata:** Theme beat, estimated pages, characters appearing, locations, canon references
- **Panel fields:** Shot type (in heading), Action, Dialogue, SFX, Notes
- **Special markers:** `[PAGE-TURN REVEAL]`, `[PLAYER DECISION POINT]`, `SPLASH PAGE`, `DOUBLE-PAGE SPREAD`
- **Footer sections:** Director's Notes with splash/spread summary, pacing breakdown, game design markers

**The parser must handle all of these.** The footer sections (Director's Notes, Pacing Breakdown) should be parsed into metadata, not into page/panel data.

### Existing Prompt Format (pages-01-to-15.md)

Each page prompt follows this exact structure:
1. Style guide line: `Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.`
2. Layout description: `3-panel vertical layout. Top panel is a wide cinematic establishing shot...`
3. Per-panel blocks: `PANEL 1 (WIDE -- top half of page): [full description with character visual details inline]`
4. Character descriptions embedded verbatim within each panel's description text
5. Dialogue quoted inline: `Speech balloon: "line"`
6. SFX noted: `Stylized SFX text integrated into the panel: "BONG BONG BONG"`

**This is the target output format.** The template must reproduce this structure.

### Character Description Consistency

Comparing character descriptions across existing files reveals the fingerprint concept is already in practice:

**In chapter-01-script.md (canon reference block):**
> Spyke (age 21), spiky ginger hair (tips reach traps), broadsword (Plasma-infused, impossibly heavy), patterned katana (Master's, secondary weapon), red bandana, green eyes, white knee-length cloak (sleeves cut, dojo emblem on back, pattern along bottom hem)...

**In pages-01-to-15.md (character quick reference):**
> Spyke (age 21): Spiky ginger hair (tips reach traps), red bandana, green eyes, white knee-length cloak (sleeves cut, dojo emblem on back, pattern along bottom hem)...

**In character-sheets.md (reference sheet prompt):**
> Character: Spyke Tinwall, male, age 21, slim but strong athletic build, lean muscle definition. Hair: Ginger/copper-red hair, messy and layered...

**In manga-script.md (consistency rules):**
> Spyke (age 21): Spiky ginger hair (tips reach traps), green eyes, red bandana...

These are all variations of the same core description. The fingerprint YAML must capture the TESTED version that produces consistent Gemini output (the prompt version from pages-01-to-15.md and character-sheets.md).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Copy-paste character descriptions manually | Template-injected fingerprints from YAML | This phase | Eliminates human error in character consistency |
| Write prompts by hand for each page | Template-generated prompts from script data | This phase | 29-page chapter generates prompts in seconds vs. hours |
| Check character consistency visually | QC checklist cross-referencing registry | This phase | Systematic verification instead of eyeballing |
| Style guide prefix copy-pasted per prompt | Single-source partial included in all templates | This phase | Zero drift risk |

**Key change from manual workflow:** The user currently writes prompts in `03_manga/prompts/` by hand, copying character descriptions into each prompt. Phase 2 automates this entirely. The manual prompts become the validation target -- generated prompts should match the quality and structure of hand-written ones.

## Open Questions

1. **Characters not in the registry**
   - What we know: Scripts mention minor characters (registrar, commuters, stewards) who don't need visual fingerprints
   - What's unclear: Should the prompt generator silently skip them, warn, or error?
   - Recommendation: Warn but continue. Minor characters get described by the script's action text, not by fingerprints.

2. **Parser scope: Chapter 1 only or all chapters?**
   - What we know: Only Chapter 1 has a complete manga script (`chapter-01-script.md`). Chapters 2-15 exist as prose outlines in `02_planning/` but NOT as manga scripts.
   - What's unclear: Will Phase 2 need to handle prose-to-script conversion, or just script-to-data parsing?
   - Recommendation: Phase 2 parses existing manga scripts only. Chapter 1 is the proving ground. When more chapters are scripted (by hand or AI), they follow the same markdown format and the parser handles them.

3. **Where do generated prompts go?**
   - What we know: Output goes to `output/` directory. Existing manual prompts live in `03_manga/prompts/`.
   - What's unclear: Exact output path and format for generated prompts.
   - Recommendation: Write to `output/ch-NN/prompts/` as individual text files (`page-01.txt`, `page-02.txt`). One file per page for easy copy-paste into Gemini.

4. **Extracting characters from panel action text**
   - What we know: Character names appear in the action/description text but are not always listed explicitly as a field.
   - What's unclear: How to reliably detect which characters are in a panel from free-text action descriptions.
   - Recommendation: Two approaches combined: (1) Check dialogue line speakers -- they're always named. (2) Match all registered character names/aliases against the action text. This covers 95%+ of cases.

5. **Nunjucks version stability**
   - What we know: Nunjucks 3.2.4 was last published 3 years ago. It is stable and widely used (2600+ dependents).
   - What's unclear: Whether active maintenance will continue.
   - Recommendation: Accept this. Nunjucks is mature and feature-complete for our needs (renderString, filters, includes). We use a small surface area of the API. If maintenance stops, the switch to LiquidJS or Eta is straightforward since our templates are simple.

## Sources

### Primary (HIGH confidence)
- Existing project files: `03_manga/chapter-01-script.md`, `03_manga/manga-script.md`, `03_manga/prompts/character-sheets.md`, `03_manga/prompts/pages-01-to-15.md`, `03_manga/prompts/pages-16-to-29.md` -- these define the actual data formats
- Existing pipeline code: `pipeline/src/types/manga.ts`, `pipeline/src/stages/script.ts`, `pipeline/src/config/paths.ts` -- these define the existing scaffold
- [Nunjucks API Documentation](https://mozilla.github.io/nunjucks/api.html) -- renderString, Environment, addFilter APIs verified
- [unified/remark-parse](https://github.com/remarkjs/remark) -- markdown AST parsing, fully typed with TypeScript
- [yaml npm package](https://www.npmjs.com/package/yaml) -- 85M+ weekly downloads, zero dependencies, TypeScript types bundled
- [Zod documentation](https://zod.dev/) -- v4.3.6, TypeScript-first schema validation

### Secondary (MEDIUM confidence)
- [Nunjucks npm package](https://www.npmjs.com/package/nunjucks) -- v3.2.4, last published ~3 years ago, 2600+ dependents
- [@types/nunjucks](https://www.npmjs.com/package/@types/nunjucks) -- v3.2.6, TypeScript definitions
- [Zod v4 announcement](https://www.infoq.com/news/2025/08/zod-v4-available/) -- 14x faster parsing, reduced bundle size

### Tertiary (LOW confidence)
- Template engine performance comparisons -- community benchmarks, not independently verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Libraries verified via npm, official docs, and existing project patterns. YAML and Zod are industry standard. Nunjucks is the canonical Jinja2 port for JS.
- Architecture: HIGH -- Architecture derived directly from analyzing existing data files (scripts, prompts, character sheets). The structure mirrors the data flow that already works manually.
- Pitfalls: HIGH -- Pitfalls identified from actual analysis of existing chapter-01-script.md edge cases (splash pages, dialogue patterns, silent panels).
- Data format analysis: HIGH -- Based on reading every relevant file in the repository, not assumptions.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain -- libraries and data formats are not changing rapidly)
