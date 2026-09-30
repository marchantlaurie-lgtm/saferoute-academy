function signedTemperature(token) {
  return token.startsWith("M") ? -Number.parseInt(token.slice(1), 10) : Number.parseInt(token, 10);
}

export function parseMetarTemp(metar) {
  const match = metar?.match(/(?:^|\s)(M?\d{2})\/(?:M?\d{2}|\/{1,2})?(?=\s|$)/);
  return match ? signedTemperature(match[1]) : null;
}

export function parseMetarDewpoint(metar) {
  const match = metar?.match(/(?:^|\s)M?\d{2}\/(M?\d{2})(?=\s|$)/);
  return match ? signedTemperature(match[1]) : null;
}

export function isMetarUsableForCalculations(liveWx) {
  if (!liveWx?.metar) return false;
  const status = liveWx.metarStatus || "current";
  return status === "current" || status === "last-known-good";
}

export function parseMetarAltimeter(metar) {
  if (!metar) return null;
  const inches = metar.match(/(?:^|\s)A(\d{4})(?=\s|$)/);
  if (inches) return Number.parseInt(inches[1], 10) / 100;
  const qnh = metar.match(/(?:^|\s)Q(\d{4})(?=\s|$)/);
  return qnh ? Number((Number.parseInt(qnh[1], 10) * 0.029529983).toFixed(2)) : null;
}

export function parseMetarWind(metar) {
  const match = metar?.match(/(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT/);
  if (!match) return null;
  return {
    dir: match[1],
    spd: Number.parseInt(match[2], 10),
    gust: match[4] ? Number.parseInt(match[4], 10) : null,
  };
}

export function parseAviationVisibility(raw) {
  if (!raw) return null;
  if (/(?:^|\s)CAVOK(?=\s|$)/.test(raw)) return "CAVOK";

  const statuteMiles = raw.match(/(?:^|\s)(P|M)?(?:(\d+)\s+)?(\d+\/\d+|\d+(?:\.\d+)?)SM(?=\s|$)/);
  if (statuteMiles) {
    const [, qualifier, whole, remainder] = statuteMiles;
    const value = whole ? `${whole} ${remainder}` : remainder;
    return `Vis ${qualifier === "P" ? ">" : qualifier === "M" ? "<" : ""}${value}SM`;
  }

  // Metric visibility must be a complete token. This deliberately excludes
  // TAF validity groups such as 2906/3006, which were previously read as 2906m.
  const metric = raw.match(/(?:^|\s)(\d{4})(?=\s|$)/);
  if (!metric) return null;
  return metric[1] === "9999" ? "Vis ≥10km" : `Vis ${metric[1]}m`;
}

function cloudSummary(raw, separator) {
  if (/(?:^|\s)(?:CLR|SKC|NSC|NCD)(?=\s|$)/.test(raw)) return "Clear";
  const verticalVisibility = raw.match(/(?:^|\s)VV(\d{3}|\/\/\/)(?=\s|$)/);
  if (verticalVisibility) {
    return verticalVisibility[1] === "///" ? "Vertical visibility unknown" : `VV ${Number.parseInt(verticalVisibility[1], 10) * 100}ft`;
  }
  const layers = [...raw.matchAll(/(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?/g)];
  return layers.length
    ? layers.map(layer => `${layer[1]} ${Number.parseInt(layer[2], 10) * 100}ft${layer[3] ? ` ${layer[3]}` : ""}`).join(separator)
    : null;
}

function weatherSummary(raw) {
  const parts = [];
  if (/TSRA|\+TS/.test(raw)) parts.push("THUNDERSTORM");
  else if (/\bTS\b/.test(raw)) parts.push("TS");
  if (/\bRA\b/.test(raw)) parts.push("Rain");
  if (/\bSN\b/.test(raw)) parts.push("Snow");
  if (/\bFG\b/.test(raw)) parts.push("Fog");
  if (/\bBR\b/.test(raw)) parts.push("Mist");
  return parts;
}

export function parseTAFPeriods(tafRaw) {
  if (!tafRaw) return [];
  const lines = tafRaw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const periodRegex = /(BECMG|TEMPO|PROB\d+\s*TEMPO|PROB\d+|FM\d{6}|FROM\s+\d)/g;
  const parts = lines.split(periodRegex).filter(Boolean);
  const periods = [];
  const base = parts[0];
  if (base) periods.push({ type: "BASE", raw: base.trim() });

  for (let index = 1; index < parts.length; index += 2) {
    const keyword = parts[index]?.trim();
    const body = parts[index + 1]?.trim() || "";
    if (!keyword) continue;
    const type = keyword.startsWith("BECMG") ? "BECMG"
      : keyword.startsWith("TEMPO") ? "TEMPO"
      : keyword.startsWith("PROB") && keyword.includes("TEMPO") ? "PROB TEMPO"
      : keyword.startsWith("PROB") ? "PROB"
      : keyword.startsWith("FM") || keyword.startsWith("FROM") ? "FROM"
      : "PERIOD";
    periods.push({ type, keyword, raw: body });
  }
  return periods;
}

export function parsePeriodSummary(raw) {
  if (!raw) return "—";
  const parts = [];
  const wind = parseMetarWind(raw);
  if (wind) parts.push(`Wind ${wind.dir === "VRB" ? "VRB" : `${wind.dir}°`} ${wind.spd}kt${wind.gust ? ` G${wind.gust}kt` : ""}`);
  parts.push(...weatherSummary(raw));
  const visibility = parseAviationVisibility(raw);
  if (visibility) parts.push(visibility);
  if (visibility !== "CAVOK") {
    const clouds = cloudSummary(raw, ", ");
    if (clouds) parts.push(clouds);
  }
  if (/\bCB\b/.test(raw) && !parts.some(part => part.includes("CB"))) parts.push("⚠ CB");
  return parts.join(" · ") || raw.slice(0, 60);
}

export function interpretMetarShort(metar) {
  if (!metar) return "No data";
  const parts = [];
  const wind = parseMetarWind(metar);
  if (wind) parts.push(`${wind.dir === "VRB" ? "VRB" : `${wind.dir}°`} ${wind.spd}kt${wind.gust ? ` G${wind.gust}kt` : ""}`);
  parts.push(...weatherSummary(metar));
  const visibility = parseAviationVisibility(metar);
  if (visibility) parts.push(visibility);
  if (visibility !== "CAVOK") {
    const clouds = cloudSummary(metar, " ");
    if (clouds) parts.push(clouds);
  }
  const temp = parseMetarTemp(metar);
  if (temp !== null) parts.push(`${temp}°C`);
  return parts.join(" · ") || metar.slice(0, 60);
}
