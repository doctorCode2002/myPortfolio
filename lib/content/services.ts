/**
 * Locale-neutral service catalogue. Titles, descriptions and tags live in the
 * dictionaries under `studio.services.items.<id>`; group names and outcome
 * lines under `studio.services.groups.<group>`.
 *
 * Grouped into four outcome pillars so nine disciplines read as one offer
 * (Brand → Motion → Product → Automation), not a scattered list.
 */

export const SERVICE_GROUPS = [
  "brand",
  "motion",
  "product",
  "automation",
] as const;
export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

export const SERVICE_IDS = [
  "logo",
  "identity",
  "aiDesign",
  "video",
  "animation",
  "uiux",
  "web",
  "mobile",
  "aiWorkflows",
] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export const SERVICE_GROUP_OF: Record<ServiceId, ServiceGroup> = {
  logo: "brand",
  identity: "brand",
  aiDesign: "brand",
  video: "motion",
  animation: "motion",
  uiux: "product",
  web: "product",
  mobile: "product",
  aiWorkflows: "automation",
};

export function servicesIn(group: ServiceGroup): ServiceId[] {
  return SERVICE_IDS.filter((id) => SERVICE_GROUP_OF[id] === group);
}

/** Two-digit display number for a service, in catalogue order (01–09). */
export function serviceNumber(id: ServiceId): string {
  return String(SERVICE_IDS.indexOf(id) + 1).padStart(2, "0");
}
