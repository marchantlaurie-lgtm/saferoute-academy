export const CLUB_ACCESS_ROLES = [
  { id: "pilot", label: "Pilot / Ops" },
  { id: "cfi", label: "CFI / Training" },
  { id: "engineering", label: "Engineering" },
  { id: "admin", label: "Club Admin" },
];

export const CLUB_ADMIN_DIRECTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "students", label: "Students" },
  { id: "instructors", label: "Instructors" },
  { id: "staff", label: "Staff" },
  { id: "aircraft", label: "Aircraft" },
];

const CLUB_ADMIN_DIRECTORY_GROUPS = [
  { id: "students", label: "Students", kind: "user" },
  { id: "instructors", label: "Instructors", kind: "user" },
  { id: "staff", label: "Staff", kind: "user" },
  { id: "aircraft", label: "Aircraft", kind: "aircraft" },
];

export function getClubAdminUserCategory(user, people) {
  const linkedPerson = people.find(person => person.id === user.personId);
  const linkedRole = linkedPerson?.role || "";
  if (user.roles.includes("cfi") || /\bCFI\b|instructor/i.test(linkedRole)) return "instructors";
  if (/student/i.test(linkedRole)) return "students";
  return "staff";
}

export function getClubAdminDirectoryCounts(users, people, aircraftList) {
  const counts = { all: users.length + aircraftList.length, students: 0, instructors: 0, staff: 0, aircraft: aircraftList.length };
  users.forEach(user => { counts[getClubAdminUserCategory(user, people)] += 1; });
  return counts;
}

export function groupClubAdminDirectory(users, people, aircraftList, filter = "all") {
  const groups = CLUB_ADMIN_DIRECTORY_GROUPS.map(group => ({
    ...group,
    items: group.kind === "aircraft"
      ? [...aircraftList].sort((left, right) => left.tail.localeCompare(right.tail))
      : users.filter(user => getClubAdminUserCategory(user, people) === group.id).sort((left, right) => left.name.localeCompare(right.name)),
  }));

  return groups.filter(group => (filter === "all" || group.id === filter) && group.items.length);
}

function activeAdminCount(users) {
  return users.filter(user => user.status === "active" && user.roles.includes("admin")).length;
}

export function toggleClubUserRole(users, userId, role) {
  if (!CLUB_ACCESS_ROLES.some(item => item.id === role)) {
    return { users, changed: false, reason: "Unknown access role." };
  }

  const user = users.find(item => item.id === userId);
  if (!user) return { users, changed: false, reason: "User not found." };

  const hasRole = user.roles.includes(role);
  if (role === "admin" && hasRole && user.status === "active" && activeAdminCount(users) <= 1) {
    return { users, changed: false, reason: "The final active Club Admin cannot be removed." };
  }

  const nextRoles = hasRole ? user.roles.filter(item => item !== role) : [...user.roles, role];
  return {
    users: users.map(item => item.id === userId ? { ...item, roles: nextRoles } : item),
    changed: true,
    reason: null,
  };
}

export function toggleClubUserStatus(users, userId) {
  const user = users.find(item => item.id === userId);
  if (!user) return { users, changed: false, reason: "User not found." };

  if (user.status === "active" && user.roles.includes("admin") && activeAdminCount(users) <= 1) {
    return { users, changed: false, reason: "The final active Club Admin cannot be suspended." };
  }

  const nextStatus = user.status === "active" ? "suspended" : "active";
  return {
    users: users.map(item => item.id === userId ? { ...item, status: nextStatus } : item),
    changed: true,
    reason: null,
  };
}

export function buildClubAdminSummary(people, aircraftList, users) {
  return {
    activeUsers: users.filter(user => user.status === "active").length,
    attentionPilots: people.filter(person => person.trainingStatus === "noncurrent").length,
    dueSoonPilots: people.filter(person => person.trainingStatus === "due").length,
    availableAircraft: aircraftList.filter(aircraft => aircraft.status === "airworthy" || aircraft.status === "restricted").length,
    restrictedAircraft: aircraftList.filter(aircraft => aircraft.status === "restricted").length,
    unavailableAircraft: aircraftList.filter(aircraft => aircraft.status === "grounded" || aircraft.status === "maintenance").length,
    openDefects: aircraftList.reduce(
      (total, aircraft) => total + (aircraft.defects || []).filter(defect => defect.status !== "Closed").length,
      0,
    ),
  };
}
