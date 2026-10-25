import test from "node:test";
import assert from "node:assert/strict";
import handler, { resetAdvisoryCacheForTests } from "../api/advisories.js";

const polygon = {
  type:"Polygon",
  coordinates:[[[-80.6,27.5],[-80.2,27.5],[-80.2,27.8],[-80.6,27.8],[-80.6,27.5]]],
};

function responseRecorder() {
  return {
    headers:{},
    statusCode:null,
    body:null,
    setHeader(name,value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("advisories endpoint separates valid empty results from unavailable sources", async () => {
  resetAdvisoryCacheForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url.includes("getTfrList")) return new Response(JSON.stringify([{
      notam_id:"6/1234", description:"VERO BEACH, FL", type:"HAZARDS", state:"FL", mod_abs_time:"202610251030",
    }]));
    if (url.includes("geoserver")) return new Response(JSON.stringify({
      type:"FeatureCollection",
      features:[{ type:"Feature", id:"V_TFR_LOC.6/1234", geometry:polygon, properties:{ NOTAM_KEY:"6/1234-1-FDC-F" } }],
    }));
    if (url.includes("gairmet")) return new Response(JSON.stringify({ type:"FeatureCollection", validTime:1792929600, features:[] }));
    if (url.includes("sigmet")) throw new Error("SIGMET source unavailable");
    if (url.includes("airport-events")) return new Response(JSON.stringify([{
      airportId:"VRB",
      airportLongName:"Vero Beach Regional",
      latitude:"27.65",
      longitude:"-80.42",
      groundStop:null,
      groundDelay:null,
      airportClosure:null,
      freeForm:null,
      arrivalDelay:{ averageDelay:15, trend:"increasing", reason:"Wx", updateTime:"2026-10-25T10:55:00Z" },
      departureDelay:null,
      deicing:null,
      airportConfig:null,
    }]));
    throw new Error("Unexpected source");
  };
  try {
    const response = responseRecorder();
    await handler({ method:"GET", query:{ icao:"KVRB", lat:"27.65", lon:"-80.42", radius:"50" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.sources.tfr.status, "ok");
    assert.equal(response.body.sources.gairmet.status, "ok");
    assert.equal(response.body.sources.sigmet.status, "unavailable");
    assert.equal(response.body.sources.nas.status, "ok");
    assert.equal(response.body.tfrs.features.length, 1);
    assert.equal(response.body.gairmets.features.length, 0);
    assert.equal(response.body.nas.departure.airportId, "VRB");
    assert.equal(response.body.nas.departure.events[0].type, "Arrival Delay");
    assert.match(response.headers["Cache-Control"], /s-maxage=60/);
  } finally {
    globalThis.fetch = originalFetch;
    resetAdvisoryCacheForTests();
  }
});

test("advisories endpoint rejects invalid coordinates and non-GET methods", async () => {
  const invalidResponse = responseRecorder();
  await handler({ method:"GET", query:{ lat:"north", lon:"-80" } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);

  const methodResponse = responseRecorder();
  await handler({ method:"POST", query:{} }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.Allow, "GET");
});
