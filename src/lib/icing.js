const PRECIPITATION_TOKEN = /(?:^|\s)(?:-?\+?(?:FZ)?(?:RA|DZ)|-?\+?SN|-?\+?PL|-?\+?SG|IC)(?:\s|$)/;
const SIGNIFICANT_CLOUD = /\b(?:BKN|OVC|VV)\d{3}\b/;

export function estimateFreezingLevel(tempC, elevationFt) {
  if (!Number.isFinite(tempC) || !Number.isFinite(elevationFt)) return null;
  if (tempC <= 0) return Math.round(elevationFt);
  return Math.round(elevationFt + tempC * 500);
}

export function hasVisibleMoistureSignal(metar="", tafs=[]) {
  const weatherText = [metar, ...(tafs || [])].join(" ").toUpperCase();
  return SIGNIFICANT_CLOUD.test(weatherText) || PRECIPITATION_TOKEN.test(weatherText);
}

export function isNegativeIcingIntensity(intensity="") {
  return /^(?:NEG|NONE)/i.test(String(intensity).trim());
}

export function classifyIcingAwareness({
  plannedAltitudeFt,
  freezingLevelFt,
  visibleMoisture,
  advisoryActive=false,
  positivePirepCount=0,
}) {
  if (advisoryActive) return "OFFICIAL ADVISORY ACTIVE";
  if (positivePirepCount > 0) return "ICING REPORTED NEARBY";
  if (!Number.isFinite(freezingLevelFt) || !Number.isFinite(plannedAltitudeFt)) return "ESTIMATE UNAVAILABLE — METAR TEMP MISSING";
  if (plannedAltitudeFt >= freezingLevelFt && visibleMoisture) return "POTENTIAL";
  return "NOT INDICATED LOCALLY";
}
