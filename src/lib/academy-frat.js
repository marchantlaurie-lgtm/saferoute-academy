const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function utcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

export function parseAcademyDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : utcDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== "string") return null;

  const text = value.trim();
  const named = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (named) {
    const month = MONTH_INDEX[named[2].toLowerCase()];
    if (month === undefined) return null;
    return utcDate(Number(named[3]), month, Number(named[1]));
  }

  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    return utcDate(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
  }

  return null;
}

export function daysSinceAcademyDate(value, asOf = new Date()) {
  const recordDate = parseAcademyDate(value);
  const assessmentDate = parseAcademyDate(asOf);
  if (!recordDate || !assessmentDate) return null;
  return Math.max(0, Math.floor((assessmentDate.getTime() - recordDate.getTime()) / DAY_MS));
}

export function hrs90ToFratPoints(hours) {
  if (hours > 20) return 0;
  if (hours >= 10) return 1;
  if (hours >= 3) return 2;
  return 3;
}

export function lastFlightToFratPoints(lastFlight, asOf = new Date()) {
  const days = daysSinceAcademyDate(lastFlight, asOf);
  if (days === null) return null;
  if (days <= 7) return 0;
  if (days <= 14) return 1;
  if (days <= 30) return 2;
  return 3;
}

export function trainingStatusToFratPoints(person, asOf = new Date()) {
  if (person?.trainingStatus === "noncurrent") return 3;
  if (person?.trainingStatus === "due") return 2;

  const daysSinceCheck = daysSinceAcademyDate(person?.lastCheck, asOf);
  return daysSinceCheck !== null && daysSinceCheck <= 90 ? 0 : 1;
}

export function getOpenAircraftDefects(aircraft) {
  return (aircraft?.defects || []).filter(defect => defect.status !== "Closed");
}

export function aircraftDefectToFratPoints(aircraft) {
  const openDefects = getOpenAircraftDefects(aircraft);
  if (!openDefects.length && !aircraft?.squawk && aircraft?.status !== "restricted") return 0;

  const context = [
    aircraft?.squawk,
    ...openDefects.flatMap(defect => [defect.text, defect.restriction]),
  ].filter(Boolean).join(" ").toLowerCase();

  if (/grounded|do not fly|unserviceable|affects safety/.test(context)) return 3;
  if (aircraft?.status === "restricted" || openDefects.some(defect => defect.restriction)) return 2;
  return 1;
}

function aircraftDefectDetail(aircraft) {
  const openDefects = getOpenAircraftDefects(aircraft);
  if (!openDefects.length) {
    return aircraft?.squawk
      ? `${aircraft.tail}: ${aircraft.squawk}`
      : `${aircraft.tail}: no open defects recorded.`;
  }

  return openDefects.map(defect => {
    const restriction = defect.restriction ? ` Restriction: ${defect.restriction}.` : "";
    return `${defect.id || "Open defect"}: ${defect.text}.${restriction}`;
  }).join(" ");
}

export function evaluateFratEligibility(person, aircraft) {
  const blockers = [];

  if (aircraft?.status === "grounded" || aircraft?.status === "maintenance") {
    const state = aircraft.status === "maintenance" ? "in maintenance" : "grounded";
    blockers.push({
      code: "aircraft_unavailable",
      title: `${aircraft.tail} is ${state}`,
      detail: "Engineering must return the aircraft to service before it can be used for a FRAT.",
    });
  }

  if (person && aircraft && !(person.aircraftAuth || []).includes(aircraft.type)) {
    blockers.push({
      code: "aircraft_authorisation_required",
      title: `${person.name} is not authorised for ${aircraft.type}`,
      detail: "A CFI must record the appropriate checkout or authorisation before this pilot can start the assessment for this aircraft.",
    });
  }

  if (person?.trainingStatus === "noncurrent") {
    blockers.push({
      code: "training_action_required",
      title: `${person.name}'s training record requires action`,
      detail: `${person.clubCurrency || "Club currency is not current"}. A CFI must complete the required check or sign-off before a normal flight assessment can start.`,
    });
  }

  return { allowed: blockers.length === 0, blockers };
}

export function buildOpsFratSeed(opsPrefill, asOf = new Date()) {
  const answers = {};
  const keys = {};
  const contexts = {};
  const advisories = [];
  const person = opsPrefill?.person;
  const aircraft = opsPrefill?.aircraft;

  if (person) {
    answers.pilot_0 = hrs90ToFratPoints(person.hrs90);
    keys.pilot_0 = true;
    contexts.pilot_0 = {
      source: "Academy pilot record",
      detail: `${person.hrs90} hours recorded in the last 90 days.`,
    };

    const daysSinceFlight = daysSinceAcademyDate(person.lastFlight, asOf);
    const lastFlightPoints = lastFlightToFratPoints(person.lastFlight, asOf);
    if (lastFlightPoints !== null) {
      answers.pilot_2 = lastFlightPoints;
      keys.pilot_2 = true;
      contexts.pilot_2 = {
        source: "Academy flight history",
        detail: `Last flight: ${person.lastFlight} (${daysSinceFlight} day${daysSinceFlight === 1 ? "" : "s"} before this assessment).`,
      };
    } else {
      advisories.push({
        id: "last-flight-unverified",
        title: "Last-flight date needs confirmation",
        detail: "Academy could not interpret the recorded date, so time since last flight remains pilot-entered.",
      });
    }

    answers.pilot_4 = trainingStatusToFratPoints(person, asOf);
    keys.pilot_4 = true;
    contexts.pilot_4 = {
      source: "Academy CFI / training record",
      detail: `Status: ${person.clubCurrency || person.trainingStatus}. Last check: ${person.lastCheck || "not recorded"}. Next check: ${person.nextCheck || "not recorded"}.`,
    };

    if (person.trainingStatus === "due") {
      advisories.push({
        id: "training-due-soon",
        title: "Training / check due soon",
        detail: `${person.clubCurrency || "The next check is approaching"}. This directly informs the Pilot currency answer but is not itself a prohibition.`,
      });
    }
    if (person.pendingSignoff) {
      advisories.push({
        id: "training-signoff-pending",
        title: "CFI sign-off pending",
        detail: "A completed training item is awaiting CFI sign-off. Confirm its status before relying on it.",
      });
    }
  }

  if (aircraft) {
    answers.aircraft_1 = aircraftDefectToFratPoints(aircraft);
    keys.aircraft_1 = true;
    contexts.aircraft_1 = {
      source: "Academy Engineering record",
      detail: aircraftDefectDetail(aircraft),
    };

    if (aircraft.status === "restricted") {
      advisories.push({
        id: "aircraft-restricted",
        title: `${aircraft.tail} is serviceable with restrictions`,
        detail: aircraftDefectDetail(aircraft),
      });
    }

    if (aircraft.nextMaintenanceHours != null && aircraft.nextMaintenanceHours <= 10) {
      advisories.push({
        id: "maintenance-due-soon",
        title: "Scheduled maintenance due soon",
        detail: `${aircraft.tail} has ${aircraft.nextMaintenanceHours} hours remaining. This is advisory only and does not add FRAT points unless it directly affects the planned flight or aircraft serviceability changes.`,
      });
    }
  }

  return { answers, keys, contexts, advisories };
}
