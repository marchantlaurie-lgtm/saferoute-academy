import test from "node:test";
import assert from "node:assert/strict";

import {
  FULL_GUIDE_SECTIONS,
  GUIDE_IDS,
  QUICK_START_GUIDES,
  normaliseGuideId,
} from "../src/data/beta-guide-content.js";

test("beta guidance includes a full guide and one Quick Start per requested role", () => {
  assert.deepEqual(
    QUICK_START_GUIDES.map(guide => guide.id),
    ["pilot-ops", "club-admin", "cfi", "engineering"],
  );
  assert.ok(FULL_GUIDE_SECTIONS.length >= 10);
  assert.deepEqual(GUIDE_IDS, ["full", "pilot-ops", "club-admin", "cfi", "engineering"]);
});

test("every role guide contains usable steps, evaluation prompts and beta limits", () => {
  for (const guide of QUICK_START_GUIDES) {
    assert.ok(guide.steps.length >= 8, `${guide.id} needs a complete task sequence`);
    assert.ok(guide.testFocus.length >= 4, `${guide.id} needs evaluation prompts`);
    assert.ok(guide.cautions.length >= 2, `${guide.id} needs explicit beta limits`);
  }
});

test("full guide preserves the shared-data and non-authoritative safety boundary", () => {
  const text = JSON.stringify(FULL_GUIDE_SECTIONS).toLowerCase();
  assert.match(text, /do not enter real/);
  assert.match(text, /shared/);
  assert.match(text, /authoritative aviation record/);
  assert.match(text, /does not.*authorise|never makes or authorises/);
});

test("guide links safely default to the full guide", () => {
  assert.equal(normaliseGuideId("cfi"), "cfi");
  assert.equal(normaliseGuideId("unknown"), "full");
  assert.equal(normaliseGuideId(null), "full");
});
