// uk-cloud-base.js
// Cloud base + basic VMC compliance helper for the UK tab.
// Swaps in as the headline "go/no-go" stat in place of density altitude,
// which matters far less in the UK's climate than in Arizona heat.
//
// This is a planning aid, not a substitute for the ANO Rules of the Air /
// CAA VFR minima — see disclaimer text at the bottom, always show it.

// Standard approximation: cloud base (AGL) ≈ (temp - dewpoint) / 2.5 °C * 1000ft
// This is the widely-used PPL-level rule of thumb, not a precision forecast —
// label it as such in the UI rather than presenting it as exact.
const LAPSE_RATE_FT_PER_DEGREE = 400; // 1000ft per 2.5°C spread

/**
 * @param {object} input
 * @param {number} input.surfaceTempC
 * @param {number} input.dewpointC
 * @param {number} input.elevationFt
 * @param {number} input.plannedAltitudeFt - altitude the student plans to fly at (AMSL)
 * @param {'G'|'D'|'other-controlled'} input.airspaceClass
 * @returns {{cloudBaseAglFt: number, cloudBaseAmslFt: number, clearOfCloud: boolean, marginFt: number, vmcNote: string}}
 */
export function estimateCloudBase(input) {
  const spread = input.surfaceTempC - input.dewpointC;
  const cloudBaseAglFt = Math.max(0, spread * LAPSE_RATE_FT_PER_DEGREE);
  const cloudBaseAmslFt = cloudBaseAglFt + input.elevationFt;

  const marginFt = cloudBaseAmslFt - input.plannedAltitudeFt;
  const clearOfCloud = marginFt > 0;

  let vmcNote;
  if (!clearOfCloud) {
    vmcNote = 'Planned altitude is at or above estimated cloud base — expect to be in cloud. Not VMC.';
  } else if (marginFt < 500) {
    vmcNote = 'Estimated margin below cloud is under 500ft — tight for comfortable VFR separation from cloud.';
  } else {
    vmcNote = 'Estimated margin below cloud looks workable for VFR — confirm against the actual TAF/METAR before flight.';
  }

  return { cloudBaseAglFt, cloudBaseAmslFt, clearOfCloud, marginFt, vmcNote };
}

// Simplified VFR minima reference (Class G, below FL100, at or below 3000ft AMSL
// as the common training-flight case). This is intentionally minimal — extend
// with the full ANO Rules of the Air Schedule 5 table if the tool needs to
// cover higher airspace classes or altitudes.
export const SIMPLIFIED_VFR_MINIMA_NOTE =
  'Class G below 3000ft AMSL, ≤140kt: clear of cloud, surface in sight, 1500m flight visibility (5km if above 3000ft AMSL or above 140kt). Always confirm current minima for your airspace class and altitude — this is a simplified reference, not the full ANO Schedule 5 table.';

export const CLOUD_BASE_DISCLAIMER =
  'Estimated cloud base uses the standard temperature/dewpoint spread approximation and is for planning awareness only. Always obtain and use the actual TAF/METAR and a proper briefing before flight.';

// ---------- Freezing level / icing risk ----------
// Standard atmosphere lapse rate ≈ 2°C per 1000ft. Given surface temp, this
// estimates the altitude at which OAT crosses 0°C — the freezing level.
// Same "planning awareness, not precision" caveat as cloud base: this is a
// rule-of-thumb estimate from a single surface reading, not a sounding.
// Where you have it, prefer the freezing level actually stated in the TAF
// (some UK TAFs and the F214/F215 charts state it directly) over this
// estimate — treat this function purely as a fallback when that's absent.

const STANDARD_LAPSE_RATE_FT_PER_DEGREE = 500; // 1000ft per 2°C

/**
 * @param {object} input
 * @param {number} input.surfaceTempC
 * @param {number} input.cloudBaseAmslFt
 * @param {number} [input.cloudTopsAmslFt] - optional; if unknown, treat cloud as open-ended upward
 * @param {number} input.elevationFt
 * @returns {{freezingLevelAmslFt: number, icingRisk: 'none'|'possible'|'likely', note: string}}
 */
export function estimateIcingRisk(input) {
  const freezingLevelAmslFt = input.surfaceTempC > 0
    ? input.elevationFt + input.surfaceTempC * STANDARD_LAPSE_RATE_FT_PER_DEGREE
    : input.elevationFt; // already at/below freezing at the surface

  const cloudTop = input.cloudTopsAmslFt ?? Infinity;
  const cloudIntersectsFreezingLevel =
    freezingLevelAmslFt >= input.cloudBaseAmslFt && freezingLevelAmslFt <= cloudTop;

  let icingRisk;
  let note;

  if (input.surfaceTempC <= 0) {
    icingRisk = 'likely';
    note = 'Surface temperature at or below freezing — icing risk in any visible moisture, including on the ground (airframe/carb icing).';
  } else if (cloudIntersectsFreezingLevel) {
    icingRisk = 'possible';
    note = `Freezing level (~${Math.round(freezingLevelAmslFt)}ft AMSL) falls within the cloud layer — airframe icing risk if flying in cloud near or above that altitude.`;
  } else if (freezingLevelAmslFt < input.cloudBaseAmslFt) {
    icingRisk = 'possible';
    note = `Freezing level (~${Math.round(freezingLevelAmslFt)}ft AMSL) is below the cloud base — icing risk climbing through cloud before reaching cloud base altitude.`;
  } else {
    icingRisk = 'none';
    note = `Freezing level estimated well above cloud tops (~${Math.round(freezingLevelAmslFt)}ft AMSL) — low icing risk for a flight staying below cloud.`;
  }

  return { freezingLevelAmslFt, icingRisk, note };
}

export const ICING_DISCLAIMER =
  'Freezing level is estimated from surface temperature using a standard atmosphere lapse rate and is not a substitute for the F214/F215 charts or actual TAF freezing level. Carburettor icing can occur well above 0°C in humid conditions — this tool does not model carb icing risk.';
