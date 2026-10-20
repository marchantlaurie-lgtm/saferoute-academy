export const APPEARANCE_STORAGE_KEY = "saferoute-academy-appearance";

export const APPEARANCE_OPTIONS = ["system", "light", "dark"];

export function normaliseAppearance(value) {
  return APPEARANCE_OPTIONS.includes(value) ? value : "system";
}

export function resolveAppearance(appearance, systemPrefersDark = false) {
  const normalised = normaliseAppearance(appearance);
  if (normalised === "system") return systemPrefersDark ? "dark" : "light";
  return normalised;
}
