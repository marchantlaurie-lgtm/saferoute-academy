const EARTH_RADIUS_NM = 3440.065;

function toRadians(value) {
  return value * Math.PI / 180;
}

function roundDistance(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function haversineNm(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(to.lon - from.lon);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function projectCoordinate(coordinate, originLat, originLon) {
  const meanLatitude = toRadians(originLat);
  return {
    x: (coordinate[0] - originLon) * 60 * Math.cos(meanLatitude),
    y: (coordinate[1] - originLat) * 60,
  };
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  ));
  return Math.hypot(point.x - (start.x + position * dx), point.y - (start.y + position * dy));
}

function orientation(a, b, c) {
  const crossProduct = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(crossProduct) < 1e-9 ? 0 : Math.sign(crossProduct);
}

function pointOnSegment(point, start, end) {
  return point.x <= Math.max(start.x,end.x) + 1e-9
    && point.x >= Math.min(start.x,end.x) - 1e-9
    && point.y <= Math.max(start.y,end.y) + 1e-9
    && point.y >= Math.min(start.y,end.y) - 1e-9;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && pointOnSegment(c,a,b))
    || (o2 === 0 && pointOnSegment(d,a,b))
    || (o3 === 0 && pointOnSegment(a,c,d))
    || (o4 === 0 && pointOnSegment(b,c,d));
}

function segmentToSegmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

function pointInRing(point, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLon, currentLat] = ring[current];
    const [previousLon, previousLat] = ring[previous];
    const crossesLatitude = (currentLat > point.lat) !== (previousLat > point.lat);
    const crossingLon = (previousLon - currentLon) * (point.lat - currentLat)
      / ((previousLat - currentLat) || Number.EPSILON) + currentLon;
    if (crossesLatitude && point.lon < crossingLon) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!polygon?.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some(ring => pointInRing(point, ring));
}

function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function geometryLines(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return geometryPolygons(geometry).flat();
}

function geometryPoints(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "MultiPoint") return geometry.coordinates;
  return [];
}

export function distanceToGeometryNm(point, geometry) {
  if (!geometry) return Infinity;
  if (geometry.type === "GeometryCollection") {
    return Math.min(...geometry.geometries.map(item => distanceToGeometryNm(point, item)));
  }
  const polygons = geometryPolygons(geometry);
  if (polygons.some(polygon => pointInPolygon(point, polygon))) return 0;

  const origin = { x:0, y:0 };
  let minimum = Infinity;
  geometryLines(geometry).forEach(line => {
    for (let index = 1; index < line.length; index += 1) {
      const start = projectCoordinate(line[index - 1], point.lat, point.lon);
      const end = projectCoordinate(line[index], point.lat, point.lon);
      minimum = Math.min(minimum, pointToSegmentDistance(origin, start, end));
    }
  });
  geometryPoints(geometry).forEach(coordinate => {
    minimum = Math.min(minimum, haversineNm(point, { lat:coordinate[1], lon:coordinate[0] }));
  });
  return minimum;
}

export function distanceGeometryToRouteNm(geometry, from, to) {
  if (!geometry) return Infinity;
  if (geometry.type === "GeometryCollection") {
    return Math.min(...geometry.geometries.map(item => distanceGeometryToRouteNm(item, from, to)));
  }
  const polygons = geometryPolygons(geometry);
  if (polygons.some(polygon => pointInPolygon(from, polygon) || pointInPolygon(to, polygon))) return 0;

  const originLat = (from.lat + to.lat) / 2;
  const originLon = (from.lon + to.lon) / 2;
  const routeStart = projectCoordinate([from.lon, from.lat], originLat, originLon);
  const routeEnd = projectCoordinate([to.lon, to.lat], originLat, originLon);
  let minimum = Infinity;
  geometryLines(geometry).forEach(line => {
    for (let index = 1; index < line.length; index += 1) {
      const start = projectCoordinate(line[index - 1], originLat, originLon);
      const end = projectCoordinate(line[index], originLat, originLon);
      minimum = Math.min(minimum, segmentToSegmentDistance(routeStart, routeEnd, start, end));
    }
  });
  geometryPoints(geometry).forEach(coordinate => {
    const projected = projectCoordinate(coordinate, originLat, originLon);
    minimum = Math.min(minimum, pointToSegmentDistance(projected, routeStart, routeEnd));
  });
  return minimum;
}

export function featureWithinScope(feature, departure, radiusNm, destination=null, corridorNm=25) {
  const departureDistanceNm = distanceToGeometryNm(departure, feature.geometry);
  const routeDistanceNm = destination
    ? distanceGeometryToRouteNm(feature.geometry, departure, destination)
    : null;
  const matches = destination
    ? routeDistanceNm <= corridorNm
    : departureDistanceNm <= radiusNm;
  return {
    matches,
    departureDistanceNm:roundDistance(departureDistanceNm),
    routeDistanceNm:roundDistance(routeDistanceNm),
  };
}

export function tfrNotamId(feature) {
  const key = String(feature?.properties?.NOTAM_KEY || "");
  const keyMatch = key.match(/^([0-9]+\/[0-9]+)/);
  if (keyMatch) return keyMatch[1];
  return String(feature?.id || "").replace(/^.*\./, "") || null;
}

export function tfrDetailUrl(notamId) {
  return notamId
    ? `https://tfr.faa.gov/tfr3/?page=detail_${encodeURIComponent(notamId.replace("/", "_"))}`
    : "https://tfr.faa.gov/tfr3/?page=list";
}

function compactUtcTimestamp(value) {
  if (!/^\d{12}$/.test(String(value || ""))) return null;
  const text = String(value);
  return `${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6,8)}T${text.slice(8,10)}:${text.slice(10,12)}:00Z`;
}

export function normaliseTfrFeature(feature, tfrList=[], scope={}) {
  const notamId = tfrNotamId(feature);
  const listEntry = tfrList.find(item => item.notam_id === notamId) || {};
  return {
    ...feature,
    properties:{
      ...feature.properties,
      category:"tfr",
      source:"Federal Aviation Administration",
      notamId,
      title:listEntry.description || feature.properties?.TITLE || `TFR ${notamId || ""}`.trim(),
      type:listEntry.type || feature.properties?.LEGAL || "TFR",
      state:listEntry.state || feature.properties?.STATE || null,
      modifiedAt:compactUtcTimestamp(listEntry.mod_abs_time || feature.properties?.LAST_MODIFICATION_DATETIME),
      detailUrl:tfrDetailUrl(notamId),
      ...scope,
    },
  };
}

export function normaliseGairmetFeature(feature, scope={}) {
  const properties = feature.properties || {};
  return {
    ...feature,
    properties:{
      ...properties,
      category:"gairmet",
      source:"Aviation Weather Center",
      title:`${properties.product || "G-AIRMET"} · ${String(properties.hazard || "ADVISORY").replaceAll("_", " ")}`,
      type:properties.hazard || properties.product || "G-AIRMET",
      validFrom:properties.issueTime || null,
      validTo:properties.validTime || null,
      ...scope,
    },
  };
}

export function normaliseSigmetFeature(feature, scope={}) {
  const properties = feature.properties || {};
  return {
    ...feature,
    properties:{
      ...properties,
      category:"sigmet",
      source:"Aviation Weather Center",
      title:`SIGMET · ${String(properties.hazard || "AVIATION HAZARD").replaceAll("_", " ")}`,
      type:properties.hazard || "SIGMET",
      validFrom:properties.validTimeFrom || null,
      validTo:properties.validTimeTo || null,
      ...scope,
    },
  };
}

export function isSigmetCurrent(feature, now=new Date()) {
  const from = Date.parse(feature?.properties?.validTimeFrom || "");
  const to = Date.parse(feature?.properties?.validTimeTo || "");
  const timestamp = now.getTime();
  return Number.isFinite(from) && Number.isFinite(to) && from <= timestamp && timestamp <= to;
}

export function formatAdvisoryAltitude(value) {
  if (value === null || value === undefined || value === "") return null;
  if (String(value).toUpperCase() === "SFC") return "SFC";
  if (String(value).toUpperCase() === "FZL") return "freezing level";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number >= 1000 ? `${number.toLocaleString()}ft MSL` : `FL${String(number).padStart(3,"0")}`;
}
