import type { RoadStatus } from "@/domain/types";

/**
 * IRCA "færð" surface codes (AstandYfirbord), as documented at
 * https://www.vegagerdin.is/vegagerdin/gagnasafn/faerd-gagnasnid
 */
export const SURFACE_STATUS: Record<string, RoadStatus> = {
  GREIDFAERT: "good", // easily passable
  HALKUBLETTIR: "caution", // spots of ice
  HALKA: "caution", // slippery
  KRAP: "caution", // slush
  SNJOTHEKJA: "caution", // snow-covered
  FLUGHALT: "difficult", // extremely slippery
  THAEFINGUR: "difficult", // heavy going in snow
  THUNGFAERT: "difficult", // very difficult
  FAERT_FJALLABILUM: "difficult", // mountain (4×4) vehicles only
  OFAERT_ANNAD: "closed", // impassable
  OFAERT_VEDUR: "closed", // impassable due to weather
  LOKAD: "closed",
  EKKI_I_THJONUSTU: "unknown", // no winter service / not reported
  OTHEKKT: "unknown",
};

/** Additional weather / restriction codes (AstandVidbotaruppl) that can only make things worse. */
export const EXTRA_STATUS: Record<string, RoadStatus> = {
  ALLUR_AKSTUR_BANN: "closed", // all traffic prohibited
  OVEDUR: "difficult", // storm
  STORHRID: "difficult", // blizzard
  SANDBYLUR: "difficult", // sandstorm
  FAERT_FJALLABILUM: "difficult",
  SKAFRENNINGUR: "caution", // blowing snow
  SNJOKOMA: "caution", // snowfall
  ELJAGANGUR: "caution", // snow showers
  THOKA: "caution", // fog
  STEINKAST: "caution", // flying gravel
  OSLETTUR_VEGUR: "caution", // uneven road
  MOKSTUR: "caution", // snow clearing in progress
};

export const SEVERITY: Record<RoadStatus, number> = { unknown: 0, good: 1, caution: 2, difficult: 3, closed: 4 };

export function worstStatus(statuses: RoadStatus[]): RoadStatus {
  return statuses.reduce<RoadStatus>((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), "unknown");
}

export function normaliseRoadCondition(surface: string | null | undefined, extra: string | null | undefined): RoadStatus {
  const base = (surface && SURFACE_STATUS[surface]) || "unknown";
  const added = extra ? EXTRA_STATUS[extra] : undefined;
  if (!added) return base;
  return SEVERITY[added] > SEVERITY[base] ? added : base;
}
