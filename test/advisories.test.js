import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceGeometryToRouteNm,
  distanceToGeometryNm,
  featureWithinScope,
  formatAdvisoryAltitude,
  isSigmetCurrent,
  normaliseTfrFeature,
  tfrDetailUrl,
} from "../src/lib/advisories.js";

const square = {
  type:"Polygon",
  coordinates:[[[-81,27],[-80,27],[-80,28],[-81,28],[-81,27]]],
};

test("geometry distance distinguishes an airport inside an advisory from one outside", () => {
  assert.equal(distanceToGeometryNm({ lat:27.5, lon:-80.5 }, square), 0);
  assert.ok(distanceToGeometryNm({ lat:29, lon:-80.5 }, square) > 55);
});

test("route distance detects an advisory polygon crossed by the direct route", () => {
  assert.equal(distanceGeometryToRouteNm(square, { lat:27.5, lon:-82 }, { lat:27.5, lon:-79 }), 0);
  assert.equal(distanceGeometryToRouteNm(square, { lat:27, lon:-82 }, { lat:27, lon:-79 }), 0);
  assert.ok(distanceGeometryToRouteNm(square, { lat:30, lon:-82 }, { lat:30, lon:-79 }) > 100);
});

test("feature scope uses airport radius or the selected route corridor", () => {
  const feature = { type:"Feature", geometry:square, properties:{} };
  assert.equal(featureWithinScope(feature, { lat:27.5, lon:-82 }, 25).matches, false);
  const routeScope = featureWithinScope(feature, { lat:27.5, lon:-82 }, 25, { lat:27.5, lon:-79 }, 10);
  assert.equal(routeScope.matches, true);
  assert.equal(routeScope.routeDistanceNm, 0);
});

test("TFR normalization joins official list metadata and builds an official detail link", () => {
  const feature = {
    type:"Feature",
    id:"V_TFR_LOC.6/1234",
    geometry:square,
    properties:{ NOTAM_KEY:"6/1234-1-FDC-F", LEGAL:"SECURITY" },
  };
  const normalized = normaliseTfrFeature(feature, [{
    notam_id:"6/1234",
    description:"TEST LOCATION, FL, Sunday",
    type:"HAZARDS",
    state:"FL",
    mod_abs_time:"202610251030",
  }], { departureDistanceNm:12.3 });
  assert.equal(normalized.properties.notamId, "6/1234");
  assert.equal(normalized.properties.type, "HAZARDS");
  assert.equal(normalized.properties.modifiedAt, "2026-10-25T10:30:00Z");
  assert.equal(normalized.properties.detailUrl, "https://tfr.faa.gov/tfr3/?page=detail_6_1234");
  assert.equal(tfrDetailUrl(null), "https://tfr.faa.gov/tfr3/?page=list");
});

test("SIGMET currency requires the current time to fall inside the validity window", () => {
  const feature = { properties:{ validTimeFrom:"2026-10-25T10:00:00Z", validTimeTo:"2026-10-25T12:00:00Z" } };
  assert.equal(isSigmetCurrent(feature, new Date("2026-10-25T11:00:00Z")), true);
  assert.equal(isSigmetCurrent(feature, new Date("2026-10-25T13:00:00Z")), false);
});

test("advisory altitude labels preserve surface and flight-level semantics", () => {
  assert.equal(formatAdvisoryAltitude("SFC"), "SFC");
  assert.equal(formatAdvisoryAltitude("FZL"), "freezing level");
  assert.equal(formatAdvisoryAltitude("090"), "FL090");
  assert.equal(formatAdvisoryAltitude(14000), "14,000ft MSL");
});
