import test from "node:test";
import assert from "node:assert/strict";

import {
  APPEARANCE_OPTIONS,
  normaliseAppearance,
  resolveAppearance,
} from "../src/lib/appearance.js";

test("appearance options expose system, light and dark choices", () => {
  assert.deepEqual(APPEARANCE_OPTIONS, ["system", "light", "dark"]);
});

test("unknown or missing appearance values fall back to system", () => {
  assert.equal(normaliseAppearance("sepia"), "system");
  assert.equal(normaliseAppearance(null), "system");
});

test("system appearance follows the device while explicit choices remain fixed", () => {
  assert.equal(resolveAppearance("system", true), "dark");
  assert.equal(resolveAppearance("system", false), "light");
  assert.equal(resolveAppearance("light", true), "light");
  assert.equal(resolveAppearance("dark", false), "dark");
});
