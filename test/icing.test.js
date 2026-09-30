import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyIcingAwareness,
  estimateFreezingLevel,
  hasVisibleMoistureSignal,
  isNegativeIcingIntensity,
} from "../src/lib/icing.js";

test("freezing level estimate uses the surface elevation and standard lapse rate", () => {
  assert.equal(estimateFreezingLevel(10, 1000), 6000);
  assert.equal(estimateFreezingLevel(-2, 1000), 1000);
});

test("visible moisture is signalled by ceilings, vertical visibility, or precipitation", () => {
  assert.equal(hasVisibleMoistureSignal("METAR KAAA 301200Z 00000KT 10SM CLR 15/10 A3000", []), false);
  assert.equal(hasVisibleMoistureSignal("METAR KAAA 301200Z 00000KT 5SM BKN020 03/02 A3000", []), true);
  assert.equal(hasVisibleMoistureSignal("METAR KAAA 301200Z 00000KT 3SM -RA SCT020 03/02 A3000", []), true);
  assert.equal(hasVisibleMoistureSignal("", ["TAF KAAA 301130Z 3012/0112 00000KT P6SM OVC030"]), true);
});

test("official advisories and positive PIREPs outrank the local estimate", () => {
  assert.equal(classifyIcingAwareness({ plannedAltitudeFt:3000, freezingLevelFt:8000, visibleMoisture:false, advisoryActive:true }), "OFFICIAL ADVISORY ACTIVE");
  assert.equal(classifyIcingAwareness({ plannedAltitudeFt:3000, freezingLevelFt:8000, visibleMoisture:false, positivePirepCount:1 }), "ICING REPORTED NEARBY");
  assert.equal(classifyIcingAwareness({ plannedAltitudeFt:9000, freezingLevelFt:8000, visibleMoisture:true }), "POTENTIAL");
  assert.equal(classifyIcingAwareness({ plannedAltitudeFt:7000, freezingLevelFt:8000, visibleMoisture:true }), "NOT INDICATED LOCALLY");
  assert.equal(classifyIcingAwareness({ plannedAltitudeFt:7000, freezingLevelFt:null, visibleMoisture:false }), "ESTIMATE UNAVAILABLE — METAR TEMP MISSING");
});

test("negative PIREP intensity variants are not counted as positive icing", () => {
  assert.equal(isNegativeIcingIntensity("NEG"), true);
  assert.equal(isNegativeIcingIntensity("NEGclr"), true);
  assert.equal(isNegativeIcingIntensity("NONE"), true);
  assert.equal(isNegativeIcingIntensity("TRC"), false);
});
