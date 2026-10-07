import test from "node:test";
import assert from "node:assert/strict";

import { normaliseAppearance, resolveAppearance } from "../src/lib/appearance.js";

test("appearance accepts the three supported choices and safely defaults to system", () => {
  assert.equal(normaliseAppearance("system"), "system");
  assert.equal(normaliseAppearance("light"), "light");
  assert.equal(normaliseAppearance("dark"), "dark");
  assert.equal(normaliseAppearance("unknown"), "system");
  assert.equal(normaliseAppearance(null), "system");
});

test("system appearance follows the device while explicit choices remain fixed", () => {
  assert.equal(resolveAppearance("system", false), "light");
  assert.equal(resolveAppearance("system", true), "dark");
  assert.equal(resolveAppearance("light", true), "light");
  assert.equal(resolveAppearance("dark", false), "dark");
});
