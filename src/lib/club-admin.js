export const CLUB_ACCESS_ROLES = [
  { id: "pilot", label: "Pilot / Ops" },
  { id: "cfi", label: "CFI / Training" },
  { id: "engineering", label: "Engineering" },
  { id: "admin", label: "Club Admin" },
];

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
