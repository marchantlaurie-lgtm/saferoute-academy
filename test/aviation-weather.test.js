import test from "node:test";
import assert from "node:assert/strict";

import {
  interpretMetarShort,
  isMetarUsableForCalculations,
  parseAviationVisibility,
  parseMetarAltimeter,
  parseMetarDewpoint,
  parseMetarTemp,
  parsePeriodSummary,
  parseTAFPeriods,
} from "../src/lib/aviation-weather.js";

test("US METAR summary includes statute-mile visibility and clear sky", () => {
  const summary = interpretMetarShort("KVRB 290753Z AUTO 24004KT 10SM CLR 22/18 A2996 RMK AO2");
  assert.match(summary, /Vis 10SM/);
  assert.match(summary, /Clear/);
  assert.match(summary, /22°C/);
});

test("TAF validity groups are never interpreted as metric visibility", () => {
  const summary = parsePeriodSummary("TAF KFXE 290540Z 2906/3006 VRB04KT P6SM FEW030 SCT250");
  assert.match(summary, /Vis >6SM/);
  assert.doesNotMatch(summary, /2906m/);
});

test("metric visibility is parsed only from a complete token", () => {
  assert.equal(parseAviationVisibility("EGLL 291050Z 24005KT 4000 BR BKN008"), "Vis 4000m");
  assert.equal(parseAviationVisibility("TAF EGLL 2911/3017 24005KT"), null);
  assert.equal(parseAviationVisibility("EGLL 291050Z 24005KT 9999 SCT020"), "Vis ≥10km");
});

test("altimeter parser supports both inHg and QNH", () => {
  assert.equal(parseMetarAltimeter("KVRB 290753Z 24004KT 10SM CLR 22/18 A2996"), 29.96);
  assert.equal(parseMetarAltimeter("EGLL 291050Z 24005KT CAVOK 17/10 Q1016"), 30.0);
  assert.equal(parseMetarAltimeter("EGLL 291050Z 24005KT CAVOK 17/10"), null);
});

test("METAR temperature remains usable when the dew point is omitted", () => {
  const metar = "METAR KZPH 301235Z AUTO 00000KT 10SM CLR 22/ A3006";
  assert.equal(parseMetarTemp(metar), 22);
  assert.equal(parseMetarDewpoint(metar), null);
});

test("stale and unavailable METARs cannot drive calculations", () => {
  assert.equal(isMetarUsableForCalculations({ metar:"METAR KAAA", metarStatus:"current" }), true);
  assert.equal(isMetarUsableForCalculations({ metar:"METAR KAAA", metarStatus:"last-known-good" }), true);
  assert.equal(isMetarUsableForCalculations({ metar:"METAR KAAA", metarStatus:"stale" }), false);
  assert.equal(isMetarUsableForCalculations({ metar:"", metarStatus:"unavailable" }), false);
});

test("TAF periods retain base and FROM groups", () => {
  const periods = parseTAFPeriods("TAF KFXE 290540Z 2906/3006 VRB04KT P6SM FEW030 FM291500 15007KT P6SM SCT030");
  assert.equal(periods.length, 2);
  assert.equal(periods[0].type, "BASE");
  assert.equal(periods[1].type, "FROM");
});
