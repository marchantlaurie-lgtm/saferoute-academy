export const CFI_ROSTER_FILTERS = [
  { id: "attention", label: "Needs Attention" },
  { id: "action", label: "Action Required" },
  { id: "due", label: "Due Soon" },
  { id: "signoff", label: "Awaiting Sign-Off" },
  { id: "current", label: "Current" },
  { id: "all", label: "All" },
];

export function getCfiRosterCategory(person) {
  if (person?.trainingStatus === "noncurrent") return "action";
  if (person?.trainingStatus === "due") return "due";
  if (person?.pendingSignoff) return "signoff";
  return "current";
}

export function matchesCfiRosterFilter(person, filter) {
  if (filter === "all") return true;
  if (filter === "attention") {
    return person?.trainingStatus === "noncurrent" || person?.trainingStatus === "due" || !!person?.pendingSignoff;
  }
  if (filter === "signoff") return !!person?.pendingSignoff;
  return getCfiRosterCategory(person) === filter;
}

export function getCfiRosterCounts(people) {
  return {
    attention: people.filter(person => matchesCfiRosterFilter(person, "attention")).length,
    action: people.filter(person => matchesCfiRosterFilter(person, "action")).length,
    due: people.filter(person => matchesCfiRosterFilter(person, "due")).length,
    signoff: people.filter(person => matchesCfiRosterFilter(person, "signoff")).length,
    current: people.filter(person => matchesCfiRosterFilter(person, "current")).length,
    all: people.length,
  };
}

const GROUPS = [
  { id: "action", label: "Action Required" },
  { id: "due", label: "Due Soon" },
  { id: "signoff", label: "Awaiting Sign-Off" },
  { id: "current", label: "Current" },
];

function byName(left, right) {
  return left.name.localeCompare(right.name);
}

export function groupCfiRoster(people, filter = "attention") {
  const visible = people.filter(person => matchesCfiRosterFilter(person, filter));

  if (!["attention", "all"].includes(filter)) {
    const definition = GROUPS.find(group => group.id === filter);
    return visible.length ? [{...definition, people:[...visible].sort(byName)}] : [];
  }

  return GROUPS.map(group => ({
    ...group,
    people: visible.filter(person => getCfiRosterCategory(person) === group.id).sort(byName),
  })).filter(group => group.people.length);
}
