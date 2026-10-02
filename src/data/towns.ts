import type { Coordinates } from "@/domain/types";
import { haversineKm } from "@/lib/geo";

export type Town = Coordinates & { name: string; region: string };

/** Approximate centres of Icelandic towns, for labelling ("near Selfoss") and offline search. */
export const TOWNS: Town[] = [
  { name: "Reykjavík", region: "Capital Region", lat: 64.1466, lon: -21.9426 },
  { name: "Kópavogur", region: "Capital Region", lat: 64.11, lon: -21.905 },
  { name: "Hafnarfjörður", region: "Capital Region", lat: 64.0671, lon: -21.9377 },
  { name: "Garðabær", region: "Capital Region", lat: 64.0888, lon: -21.9228 },
  { name: "Mosfellsbær", region: "Capital Region", lat: 64.1667, lon: -21.7 },
  { name: "Seltjarnarnes", region: "Capital Region", lat: 64.153, lon: -22.0 },
  { name: "Reykjanesbær", region: "Reykjanes", lat: 63.9998, lon: -22.5583 },
  { name: "Keflavík Airport", region: "Reykjanes", lat: 63.985, lon: -22.6056 },
  { name: "Grindavík", region: "Reykjanes", lat: 63.8424, lon: -22.4338 },
  { name: "Selfoss", region: "South", lat: 63.9331, lon: -21.0021 },
  { name: "Hveragerði", region: "South", lat: 64.0003, lon: -21.1866 },
  { name: "Þorlákshöfn", region: "South", lat: 63.855, lon: -21.3833 },
  { name: "Laugarvatn", region: "South", lat: 64.216, lon: -20.733 },
  { name: "Flúðir", region: "South", lat: 64.134, lon: -20.312 },
  { name: "Hella", region: "South", lat: 63.8344, lon: -20.4 },
  { name: "Hvolsvöllur", region: "South", lat: 63.7533, lon: -20.2242 },
  { name: "Skógar", region: "South", lat: 63.526, lon: -19.491 },
  { name: "Vík", region: "South", lat: 63.4186, lon: -19.006 },
  { name: "Kirkjubæjarklaustur", region: "South", lat: 63.7883, lon: -18.0567 },
  { name: "Höfn", region: "Southeast", lat: 64.2539, lon: -15.2082 },
  { name: "Egilsstaðir", region: "East", lat: 65.2653, lon: -14.3948 },
  { name: "Seyðisfjörður", region: "East", lat: 65.2597, lon: -14.0103 },
  { name: "Akureyri", region: "North", lat: 65.6835, lon: -18.0878 },
  { name: "Húsavík", region: "North", lat: 66.0449, lon: -17.3389 },
  { name: "Reykjahlíð (Mývatn)", region: "North", lat: 65.644, lon: -16.911 },
  { name: "Dalvík", region: "North", lat: 65.9702, lon: -18.5286 },
  { name: "Siglufjörður", region: "North", lat: 66.1525, lon: -18.9087 },
  { name: "Sauðárkrókur", region: "North", lat: 65.7461, lon: -19.6394 },
  { name: "Blönduós", region: "North", lat: 65.66, lon: -20.2797 },
  { name: "Hvammstangi", region: "North", lat: 65.3955, lon: -20.944 },
  { name: "Borgarnes", region: "West", lat: 64.5383, lon: -21.9206 },
  { name: "Reykholt", region: "West", lat: 64.665, lon: -21.292 },
  { name: "Akranes", region: "West", lat: 64.3218, lon: -22.0749 },
  { name: "Stykkishólmur", region: "West", lat: 65.0754, lon: -22.729 },
  { name: "Grundarfjörður", region: "West", lat: 64.9227, lon: -23.256 },
  { name: "Ólafsvík", region: "West", lat: 64.8945, lon: -23.7055 },
  { name: "Ísafjörður", region: "Westfjords", lat: 66.075, lon: -23.124 },
];

export function nearestTown(p: Coordinates, maxKm = 25): Town | null {
  let best: Town | null = null;
  let bestKm = maxKm;
  for (const town of TOWNS) {
    const km = haversineKm(p, town);
    if (km <= bestKm) {
      best = town;
      bestKm = km;
    }
  }
  return best;
}

export const REYKJAVIK: Town = TOWNS[0];
