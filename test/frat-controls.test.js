import test from "node:test";
import assert from "node:assert/strict";

import { canControlReduce, FRAT_RETAIN_CONTROL, hasRecordedControl } from "../src/lib/frat-controls.js";

const question = {
  mitigations: ["Delay departure", "Review with a CFI"],
  nonReducingMitigations: ["Review with a CFI"],
};

test("a note records review but cannot reduce residual risk", () => {
  const control = { actions: [], note: "Reviewed" };
  assert.equal(hasRecordedControl(control), true);
  assert.equal(canControlReduce(question, control), false);
});

test("a reducing structured control can reduce residual risk", () => {
  assert.equal(canControlReduce(question, { actions: ["Delay departure"], note: "" }), true);
});

test("review-only and retain-risk actions cannot reduce residual risk", () => {
  assert.equal(canControlReduce(question, { actions: ["Review with a CFI"], note: "" }), false);
  assert.equal(canControlReduce(question, { actions: [FRAT_RETAIN_CONTROL], note: "" }), false);
});
