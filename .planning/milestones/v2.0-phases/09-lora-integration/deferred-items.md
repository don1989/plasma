# Deferred Items — Phase 09 LoRA Integration

## Pre-existing test failures (discovered during 09-02)

**File:** `pipeline/tests/templates/prompt-generator.test.ts`

**Tests failing (3):**
- `generateChapterPrompts (unit) > generated prompt includes character fingerprints for known characters`
- `generateChapterPrompts (unit) > renders multiple characters in same panel with deduplicated fingerprints`
- `generateChapterPrompts (integration) > generates 28 prompts for chapter 1 (from script.json)`

**Nature:** These tests check that character fingerprint content (e.g., `'spiky ginger hair'`) appears in generated prompts. The failures appear to be caused by changes to the character prompt fingerprint data or template rendering logic outside Phase 9 scope.

**Confirmed pre-existing:** Verified by running tests on commit `0973103` (before any 09-02 changes were applied). Same 3 failures present.

**Impact on Phase 9:** None — these tests are entirely unrelated to the ComfyUI/LoRA pipeline code modified in Phase 9.

**Recommended action:** Investigate `prompt-generator.test.ts` and character fingerprint data in a separate task. Likely the test fixture data or the `03_manga/` character sheets changed without corresponding test updates.
