import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClubAdminSummary,
  toggleClubUserRole,
  toggleClubUserStatus,
} from "../src/lib/club-admin.js";

const users = [
  { id: "u1", name: "Admin", status: "active", roles: ["admin", "cfi"] },
  { id: "u2", name: "Pilot", status: "active", roles: ["pilot"] },
  { id: "u3", name: "Engineer", status: "suspended", roles: ["engineering"] },
];

test("role updates are session-safe and do not mutate the source list", () => {
  const result = toggleClubUserRole(users, "u2", "cfi");
  assert.equal(result.changed, true);
  assert.deepEqual(result.users[1].roles, ["pilot", "cfi"]);
  assert.deepEqual(users[1].roles, ["pilot"]);
});

test("the final active Club Admin cannot be removed or suspended", () => {
  const roleResult = toggleClubUserRole(users, "u1", "admin");
  const statusResult = toggleClubUserStatus(users, "u1");

  assert.equal(roleResult.changed, false);
  assert.match(roleResult.reason, /final active Club Admin/);
  assert.equal(statusResult.changed, false);
  assert.match(statusResult.reason, /final active Club Admin/);
});

test("a user can be suspended when another active admin remains", () => {
  const twoAdmins = [...users, { id: "u4", name: "Second Admin", status: "active", roles: ["admin"] }];
  const result = toggleClubUserStatus(twoAdmins, "u1");
  assert.equal(result.changed, true);
  assert.equal(result.users[0].status, "suspended");
});

test("club summary reports training, fleet and access attention", () => {
  const people = [
    { trainingStatus: "current" },
    { trainingStatus: "due" },
    { trainingStatus: "noncurrent" },
  ];
  const aircraft = [
    { status: "airworthy", defects: [] },
    { status: "restricted", defects: [{ status: "Deferred" }] },
    { status: "grounded", defects: [{ status: "Work in progress" }, { status: "Closed" }] },
  ];

  assert.deepEqual(buildClubAdminSummary(people, aircraft, users), {
    activeUsers: 2,
    attentionPilots: 1,
    dueSoonPilots: 1,
    availableAircraft: 2,
    restrictedAircraft: 1,
    unavailableAircraft: 1,
    openDefects: 2,
  });
});
