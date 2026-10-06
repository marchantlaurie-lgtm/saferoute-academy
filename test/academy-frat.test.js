import test from "node:test";
import assert from "node:assert/strict";

import {
  aircraftDefectToFratPoints,
  buildOpsFratSeed,
  daysSinceAcademyDate,
  evaluateFratEligibility,
  hrs90ToFratPoints,
  lastFlightToFratPoints,
  trainingStatusToFratPoints,
} from "../src/lib/academy-frat.js";

const AS_OF = new Date("2026-10-06T12:00:00Z");

const currentPilot = {
  name: "Jordan Reyes",
  hrs90: 14.2,
  lastFlight: "28 Sep 2026",
  clubCurrency: "Current",
  trainingStatus: "current",
  lastCheck: "18 May 2026",
  nextCheck: "18 Nov 2026",
  pendingSignoff: false,
  aircraftAuth: ["Cessna 172S"],
};

const duePilot = {
  name: "Alicia Chen",
  hrs90: 6.5,
  lastFlight: "22 Sep 2026",
  clubCurrency: "Expires in 12 days",
  trainingStatus: "due",
  lastCheck: "18 Apr 2026",
  nextCheck: "18 Oct 2026",
  pendingSignoff: true,
  aircraftAuth: ["Cessna 172N"],
};

const clearAircraft = {
  tail: "N172SR",
  type: "Cessna 172S",
  status: "airworthy",
  squawk: null,
  nextMaintenanceHours: 37.2,
  defects: [],
};

const restrictedAircraft = {
  tail: "N44TR",
  type: "Cessna 172N",
  status: "restricted",
  squawk: "Right nav light intermittent — deferred (minor)",
  nextMaintenanceHours: 8.4,
  defects: [{
    id: "DEF-0047",
    text: "Right nav light intermittent",
    status: "Deferred",
    restriction: "Day VFR only",
  }],
};

test("last-flight recency follows the FRAT thresholds", () => {
  assert.equal(lastFlightToFratPoints("05 Oct 2026", AS_OF), 0);
  assert.equal(lastFlightToFratPoints("28 Sep 2026", AS_OF), 1);
  assert.equal(lastFlightToFratPoints("20 Sep 2026", AS_OF), 2);
  assert.equal(lastFlightToFratPoints("31 Aug 2026", AS_OF), 3);
  assert.equal(lastFlightToFratPoints("07 Oct 2026", AS_OF), null, "a future date must not auto-fill as recent");
  assert.equal(daysSinceAcademyDate("not a date", AS_OF), null);
});

test("90-day hours only auto-fill from a valid non-negative number", () => {
  assert.equal(hrs90ToFratPoints(20.1), 0);
  assert.equal(hrs90ToFratPoints(20), 1);
  assert.equal(hrs90ToFratPoints(3), 2);
  assert.equal(hrs90ToFratPoints(2.9), 3);
  assert.equal(hrs90ToFratPoints(undefined), null);
  assert.equal(hrs90ToFratPoints(-1), null);
});

test("Academy seed fills only record-backed fields and leaves human inputs manual", () => {
  const seed = buildOpsFratSeed({ person: currentPilot, aircraft: clearAircraft }, AS_OF);

  assert.deepEqual(seed.answers, {
    pilot_0: 1,
    pilot_2: 1,
    pilot_4: 1,
    aircraft_1: 0,
  });
  assert.deepEqual(Object.keys(seed.keys).sort(), ["aircraft_1", "pilot_0", "pilot_2", "pilot_4"]);
  assert.equal(seed.answers.pilot_1, undefined, "sleep must stay manual");
  assert.equal(seed.answers.pilot_3, undefined, "IMSAFE must stay manual");
  assert.equal(seed.answers.aircraft_0, undefined, "authorisation must not pretend to measure familiarity");
  assert.equal(seed.answers.environment_0, undefined, "weather must stay manual");
  assert.equal(seed.answers.external_0, undefined, "external pressure must stay manual");
});

test("due training and an operational restriction provide scored context plus advisories", () => {
  const seed = buildOpsFratSeed({ person: duePilot, aircraft: restrictedAircraft }, AS_OF);

  assert.equal(seed.answers.pilot_4, 2);
  assert.equal(seed.answers.aircraft_1, 2);
  assert.match(seed.contexts.aircraft_1.detail, /DEF-0047/);
  assert.match(seed.contexts.aircraft_1.detail, /Day VFR only/);
  assert.deepEqual(
    seed.advisories.map(item => item.id),
    ["training-due-soon", "training-signoff-pending", "aircraft-restricted", "maintenance-due-soon"],
  );
  assert.equal(Object.keys(seed.answers).length, 4, "maintenance due soon must not create a separate score");
});

test("closed defects do not contribute aircraft risk", () => {
  const aircraft = {
    ...clearAircraft,
    defects: [{ id: "DEF-1", text: "Resolved", status: "Closed", restriction: "Day VFR only" }],
  };
  assert.equal(aircraftDefectToFratPoints(aircraft), 0);
  assert.equal(aircraftDefectToFratPoints({
    ...clearAircraft,
    defects: [{ id: "DEF-2", text: "Resolved", status: "closed", restriction: "Day VFR only" }],
  }), 0);
});

test("recent CFI check maps to current and recent dual", () => {
  assert.equal(trainingStatusToFratPoints({ trainingStatus: "current", lastCheck: "12 Aug 2026" }, AS_OF), 0);
  assert.equal(trainingStatusToFratPoints(currentPilot, AS_OF), 1);
  assert.equal(trainingStatusToFratPoints(duePilot, AS_OF), 2);
});

test("FRAT eligibility blocks unavailable aircraft and missing authorisation", () => {
  const grounded = { ...restrictedAircraft, status: "grounded", type: "Piper PA-28-181", tail: "N9DA" };
  const result = evaluateFratEligibility(currentPilot, grounded);

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockers.map(blocker => blocker.code), [
    "aircraft_unavailable",
    "aircraft_authorisation_required",
  ]);

  const maintenance = evaluateFratEligibility(currentPilot, { ...clearAircraft, status: "maintenance" });
  assert.equal(maintenance.allowed, false);
  assert.equal(maintenance.blockers[0].code, "aircraft_unavailable");
});

test("non-current training fills the flight-review field and requires visible CFI action", () => {
  const noncurrentPilot = {
    ...currentPilot,
    trainingStatus: "noncurrent",
    clubCurrency: "Expired — instructor check required",
  };
  const result = evaluateFratEligibility(noncurrentPilot, clearAircraft);
  const seed = buildOpsFratSeed({ person: noncurrentPilot, aircraft: clearAircraft }, AS_OF);

  assert.equal(result.allowed, true, "the FRAT remains available as a decision-support record");
  assert.equal(seed.answers.pilot_4, 3);
  assert.equal(seed.advisories.find(item => item.id === "training-action-required")?.level, "action");
});

test("invalid Academy pilot values stay manual instead of creating an auto-fill", () => {
  const seed = buildOpsFratSeed({
    person: {
      ...currentPilot,
      hrs90: undefined,
      lastFlight: "07 Oct 2026",
      trainingStatus: "unknown",
    },
    aircraft: clearAircraft,
  }, AS_OF);

  assert.equal(seed.answers.pilot_0, undefined);
  assert.equal(seed.answers.pilot_2, undefined);
  assert.equal(seed.answers.pilot_4, undefined);
  assert.deepEqual(
    seed.advisories.map(item => item.id),
    ["hours-90-unverified", "last-flight-unverified", "training-status-unverified"],
  );
});
