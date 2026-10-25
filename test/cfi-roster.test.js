import test from "node:test";
import assert from "node:assert/strict";

import {
  getCfiRosterCategory,
  getCfiRosterCounts,
  groupCfiRoster,
  matchesCfiRosterFilter,
} from "../src/lib/cfi-roster.js";

const people = [
  { id:"current", name:"Jordan", trainingStatus:"current", pendingSignoff:false },
  { id:"due", name:"Alicia", trainingStatus:"due", pendingSignoff:true },
  { id:"action", name:"Sarah", trainingStatus:"noncurrent", pendingSignoff:false },
  { id:"signoff", name:"Morgan", trainingStatus:"current", pendingSignoff:true },
];

test("CFI categories use a fixed action, due, sign-off, current priority", () => {
  assert.equal(getCfiRosterCategory(people[2]), "action");
  assert.equal(getCfiRosterCategory(people[1]), "due");
  assert.equal(getCfiRosterCategory(people[3]), "signoff");
  assert.equal(getCfiRosterCategory(people[0]), "current");
});

test("Needs Attention hides fully current pilots", () => {
  const visible = people.filter(person => matchesCfiRosterFilter(person, "attention"));
  assert.deepEqual(visible.map(person => person.id), ["due", "action", "signoff"]);
});

test("Awaiting Sign-Off includes pending records even when also due soon", () => {
  const visible = people.filter(person => matchesCfiRosterFilter(person, "signoff"));
  assert.deepEqual(visible.map(person => person.id), ["due", "signoff"]);
});

test("All and Needs Attention group records in consistent priority order without duplicates", () => {
  assert.deepEqual(groupCfiRoster(people, "all").map(group => group.id), ["action", "due", "signoff", "current"]);
  assert.deepEqual(groupCfiRoster(people, "attention").map(group => group.id), ["action", "due", "signoff"]);
  assert.equal(groupCfiRoster(people, "all").flatMap(group => group.people).length, people.length);
});

test("filter counts support the CFI status chips", () => {
  assert.deepEqual(getCfiRosterCounts(people), {
    attention:3,
    action:1,
    due:1,
    signoff:2,
    current:1,
    all:4,
  });
});
