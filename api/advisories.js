import {
  featureWithinScope,
  haversineNm,
  isSigmetCurrent,
  normaliseGairmetFeature,
  normaliseSigmetFeature,
  normaliseTfrFeature,
} from "../src/lib/advisories.js";

const SOURCE_URLS = {
  tfrList:"https://tfr.faa.gov/tfrapi/getTfrList",
  tfrGeo:"https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=300&outputFormat=application/json&srsname=EPSG:4326",
  gairmet:"https://aviationweather.gov/api/data/gairmet?format=geojson",
  sigmet:"https://aviationweather.gov/api/data/sigmet?format=geojson",
  nas:"https://nasstatus.faa.gov/api/airport-events",
};

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 9_000;
let feedCache = { value:null, expiresAt:0, pending:null };

function numericQuery(value, minimum, maximum, fallback=null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers:{
        Accept:"application/json",
        "User-Agent":"SafeRoute-Academy/1.0 aviation-training-awareness",
      },
      signal:controller.signal,
    });
    if (response.status === 204) return { type:"FeatureCollection", features:[] };
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sourceResult(result, retrievedAt) {
  return result.status === "fulfilled"
    ? { status:"ok", retrievedAt, data:result.value }
    : { status:"unavailable", retrievedAt, data:null };
}

async function loadFeeds() {
  const now = Date.now();
  if (feedCache.value && feedCache.expiresAt > now) return feedCache.value;
  if (feedCache.pending) return feedCache.pending;
  feedCache.pending = (async () => {
    const retrievedAt = new Date().toISOString();
    const results = await Promise.allSettled(Object.values(SOURCE_URLS).map(fetchJson));
    const value = {
      retrievedAt,
      tfrList:sourceResult(results[0], retrievedAt),
      tfrGeo:sourceResult(results[1], retrievedAt),
      gairmet:sourceResult(results[2], retrievedAt),
      sigmet:sourceResult(results[3], retrievedAt),
      nas:sourceResult(results[4], retrievedAt),
    };
    feedCache = { value, expiresAt:Date.now() + CACHE_TTL_MS, pending:null };
    return value;
  })();
  try {
    return await feedCache.pending;
  } finally {
    feedCache.pending = null;
  }
}

function scopedFeatures(features, departure, radiusNm, destination, corridorNm, normalise, extra) {
  return (features || []).flatMap(feature => {
    const scope = featureWithinScope(feature, departure, radiusNm, destination, corridorNm);
    return scope.matches ? [normalise(feature, ...extra, {
      departureDistanceNm:scope.departureDistanceNm,
      routeDistanceNm:scope.routeDistanceNm,
    })] : [];
  }).sort((left,right) => {
    const property = destination ? "routeDistanceNm" : "departureDistanceNm";
    return (left.properties[property] ?? Infinity) - (right.properties[property] ?? Infinity);
  });
}

function sourceStatus(primary, secondary=null) {
  if (primary.status !== "ok") return "unavailable";
  if (secondary && secondary.status !== "ok") return "partial";
  return "ok";
}

function nasAirportId(icao) {
  const code = String(icao || "").trim().toUpperCase();
  return /^K[A-Z0-9]{3}$/.test(code) ? code.slice(1) : code;
}

function normaliseNasEvents(record) {
  if (!record) return null;
  const events = [];
  const addEvent = (type, value, detail, extra={}) => {
    if (!value) return;
    events.push({
      type,
      detail:detail(value),
      startsAt:value.startTime || value.eventTime || value.updateTime || null,
      endsAt:value.endTime || null,
      updatedAt:value.updatedAt || value.updateTime || null,
      advisoryUrl:value.advisoryUrl || null,
      ...extra,
    });
  };
  addEvent("Airport Closure", record.airportClosure, value => value.text ? `Closed ${value.text}` : "Airport closure reported");
  addEvent("Airport Closure", record.freeForm, value => value.text ? `Closed ${value.text}` : "Airport closure reported");
  addEvent("Ground Stop", record.groundStop, value => value.impactingCondition ? `Due to ${value.impactingCondition}` : "Ground stop active", {
    extensionProbability:record.groundStop?.probabilityOfExtension || null,
  });
  addEvent("Ground Delay", record.groundDelay, value => {
    const delay = Number.isFinite(Number(value.avgDelay)) ? `Average delay ${value.avgDelay} minutes` : "Ground delay program active";
    return value.impactingCondition ? `${delay} · ${value.impactingCondition}` : delay;
  });
  addEvent("Arrival Delay", record.arrivalDelay, value => {
    const trend = value.trend ? ` and ${value.trend}` : "";
    return `Average ${value.averageDelay} minute arrival delay${trend}${value.reason ? ` · ${value.reason}` : ""}`;
  });
  addEvent("Departure Delay", record.departureDelay, value => {
    const trend = value.trend ? ` and ${value.trend}` : "";
    return `Average ${value.averageDelay} minute departure delay${trend}${value.reason ? ` · ${value.reason}` : ""}`;
  });
  addEvent("Deicing", record.deicing, () => "Deicing operations reported");
  return {
    airportId:record.airportId,
    airportName:record.airportLongName || null,
    events,
    airportConfig:record.airportConfig ? {
      arrivalRunways:record.airportConfig.arrivalRunwayConfig || null,
      departureRunways:record.airportConfig.departureRunwayConfig || null,
      arrivalRate:record.airportConfig.arrivalRate ?? null,
      sourceTimeStamp:record.airportConfig.sourceTimeStamp || null,
    } : null,
  };
}

function selectedNasEvents(records, icao) {
  const id = nasAirportId(icao);
  const list = Array.isArray(records) ? records : [];
  return normaliseNasEvents(list.find(record => record.airportId === id)) || {
    airportId:id || null,
    airportName:null,
    events:[],
    airportConfig:null,
  };
}

export function resetAdvisoryCacheForTests() {
  feedCache = { value:null, expiresAt:0, pending:null };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error:"Method not allowed" });
  }

  const lat = numericQuery(request.query.lat, -90, 90);
  const lon = numericQuery(request.query.lon, -180, 180);
  const radiusNm = numericQuery(request.query.radius, 5, 250, 50);
  const destinationLat = numericQuery(request.query.destLat, -90, 90);
  const destinationLon = numericQuery(request.query.destLon, -180, 180);
  const corridorNm = numericQuery(request.query.corridor, 5, 75, 25);
  const icao = String(request.query.icao || "").trim().toUpperCase();
  const destinationIcao = String(request.query.destIcao || "").trim().toUpperCase();
  if (lat === null || lon === null || radiusNm === null || corridorNm === null) {
    return response.status(400).json({ error:"Valid lat, lon, radius and corridor values are required." });
  }
  const destinationRequested = request.query.destLat !== undefined || request.query.destLon !== undefined;
  if (destinationRequested && (destinationLat === null || destinationLon === null)) {
    return response.status(400).json({ error:"Both destination latitude and longitude are required." });
  }

  const departure = { lat, lon };
  const destination = destinationLat === null ? null : { lat:destinationLat, lon:destinationLon };
  const feeds = await loadFeeds();
  const tfrList = Array.isArray(feeds.tfrList.data) ? feeds.tfrList.data : [];
  const tfrFeatures = scopedFeatures(
    feeds.tfrGeo.data?.features,
    departure,
    radiusNm,
    destination,
    corridorNm,
    normaliseTfrFeature,
    [tfrList],
  );
  const gairmetFeatures = scopedFeatures(
    feeds.gairmet.data?.features,
    departure,
    radiusNm,
    destination,
    corridorNm,
    normaliseGairmetFeature,
    [],
  );
  const currentSigmets = (feeds.sigmet.data?.features || []).filter(feature => isSigmetCurrent(feature));
  const sigmetFeatures = scopedFeatures(
    currentSigmets,
    departure,
    radiusNm,
    destination,
    corridorNm,
    normaliseSigmetFeature,
    [],
  );

  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response.status(200).json({
    requestedAt:new Date().toISOString(),
    scope:{
      mode:destination ? "route" : "nearby",
      radiusNm,
      corridorNm:destination ? corridorNm : null,
      directDistanceNm:destination ? Math.round(haversineNm(departure, destination)) : null,
    },
    sources:{
      tfr:{
        status:sourceStatus(feeds.tfrGeo, feeds.tfrList),
        retrievedAt:feeds.tfrGeo.retrievedAt,
        mappedRecordCount:feeds.tfrGeo.data?.features?.length ?? null,
        listRecordCount:Array.isArray(feeds.tfrList.data) ? feeds.tfrList.data.length : null,
        url:"https://tfr.faa.gov/tfr3/?page=list",
      },
      gairmet:{
        status:feeds.gairmet.status,
        retrievedAt:feeds.gairmet.retrievedAt,
        validTime:feeds.gairmet.data?.validTime
          ? new Date(feeds.gairmet.data.validTime * 1000).toISOString()
          : gairmetFeatures[0]?.properties?.validTo || null,
        url:"https://aviationweather.gov/gfa/",
      },
      sigmet:{
        status:feeds.sigmet.status,
        retrievedAt:feeds.sigmet.retrievedAt,
        url:"https://aviationweather.gov/gfa/",
      },
      nas:{
        status:feeds.nas.status,
        retrievedAt:feeds.nas.retrievedAt,
        url:"https://nasstatus.faa.gov/",
      },
    },
    tfrs:{ type:"FeatureCollection", features:tfrFeatures },
    gairmets:{ type:"FeatureCollection", features:gairmetFeatures },
    sigmets:{ type:"FeatureCollection", features:sigmetFeatures },
    nas:{
      departure:selectedNasEvents(feeds.nas.data, icao),
      destination:destination ? selectedNasEvents(feeds.nas.data, destinationIcao) : null,
    },
  });
}
