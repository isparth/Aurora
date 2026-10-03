import { DEG } from "./math";

/**
 * Sky background against which the aurora has to be seen, in cd/m² (photopic, V band). Each source is a
 * published model; together they decide the faintest aurora a dark-adapted eye can pick out.
 */

/** Natural night sky at the zenith (airglow + starlight): ≈21.7 mag/arcsec² in V at a sea-level site. */
export const NATURAL_SKY_CD = 2.3e-4;

const magToCd = (mag: number) => 1.08e5 * 10 ** (-0.4 * mag);
/** Night-sky level already contained in Patat's twilight fit (Paranal, V ≈ 21.83). */
const PATAT_NIGHT_CD = magToCd(21.83);
/** Paranal's twilight is ~30% darker than a low-altitude site's (Patat et al. 2006). */
const SEA_LEVEL_TWILIGHT = 1.3;

/**
 * Zenith twilight above the night-sky level: Patat et al. (2006, A&A 455, 385) V-band fit
 * m = 11.84 + 1.518(ζ − 95) − 0.057(ζ − 95)², ζ = Sun's zenith distance (valid 95°–105°, reaching the
 * night sky near 107°). Above −5° it keeps the 95° slope, which is only ever used to say "too bright".
 */
export function twilightLuminance(sunAltitudeDeg: number): number {
  const zeta = 90 - sunAltitudeDeg;
  if (zeta >= 107) return 0;
  const z = Math.max(zeta, 95) - 95;
  const mag = 11.84 + 1.518 * z - 0.057 * z * z - (zeta < 95 ? 1.518 * (95 - zeta) : 0);
  return Math.max(0, magToCd(mag) - PATAT_NIGHT_CD) * SEA_LEVEL_TWILIGHT;
}

/** Visual extinction (mag per airmass) for maritime sea-level air. */
export const EXTINCTION_PER_AIRMASS = 0.2;
const NANOLAMBERT_CD = 3.1831e-6;

/** Relative airmass towards an elevation (Kasten & Young 1989, accurate down to the horizon). */
export function airmass(elevationDeg: number): number {
  const h = Math.max(0.5, elevationDeg);
  return 1 / (Math.sin(h * DEG) + 0.50572 * (h + 6.07995) ** -1.6364);
}

/** How much dimmer (log10) light from this elevation arrives than light from the zenith. */
export const extinctionDex = (elevationDeg: number) => 0.4 * EXTINCTION_PER_AIRMASS * (airmass(elevationDeg) - 1);
const airmassKS = (zenithDeg: number) => 1 / Math.sqrt(1 - 0.96 * Math.sin(Math.min(zenithDeg, 89.9) * DEG) ** 2);

/**
 * Scattered moonlight in one direction: Krisciunas & Schaefer (1991, PASP 103, 1033), V band.
 * Phase angle from the illuminated fraction; `separationDeg` is the angle between the Moon and the view.
 */
export function moonLuminance(p: { moonAltitudeDeg: number; illumination: number; separationDeg: number; viewZenithDeg: number }): number {
  if (p.moonAltitudeDeg <= 0 || p.illumination <= 0) return 0;
  const phaseAngle = Math.acos(Math.min(1, Math.max(-1, 2 * p.illumination - 1))) / DEG;
  const moonBrightness = 10 ** (-0.4 * (3.84 + 0.026 * phaseAngle + 4e-9 * phaseAngle ** 4));
  const rho = Math.max(p.separationDeg, 5);
  const scattering = 10 ** 5.36 * (1.06 + Math.cos(rho * DEG) ** 2) + 10 ** (6.15 - rho / 40);
  const k = EXTINCTION_PER_AIRMASS;
  const nanolamberts =
    scattering * moonBrightness * 10 ** (-0.4 * k * airmassKS(90 - p.moonAltitudeDeg)) * (1 - 10 ** (-0.4 * k * airmassKS(p.viewZenithDeg)));
  return nanolamberts * NANOLAMBERT_CD;
}

/**
 * Town glow from the site's light-pollution score (0 = urban, 1 = pristine), as a multiple of the natural
 * sky: 10^(2 − 4·score). Grótta (0.35) ≈ 4× natural (SQM ≈ 20), 0.6 ≈ 0.4×, 0.9 and darker ≈ negligible.
 * The scores are editorial estimates; satellite light-pollution data would replace this mapping.
 */
export function artificialLuminance(lightPollutionScore: number): number {
  return NATURAL_SKY_CD * 10 ** (2 - 4 * Math.min(1, Math.max(0, lightPollutionScore)));
}

/** Natural sky toward a given elevation: longer airglow path (van Rhijn, layer at 90 km) dimmed by extinction. */
export function naturalSkyLuminance(elevationDeg: number): number {
  const e = Math.max(2, elevationDeg) * DEG;
  const r = 6371 / (6371 + 90);
  const vanRhijn = 1 / Math.sqrt(1 - r * r * Math.cos(e) ** 2);
  return NATURAL_SKY_CD * vanRhijn * 10 ** (-0.4 * EXTINCTION_PER_AIRMASS * (1 / Math.sin(e) - 1));
}

/**
 * Threshold luminance increment for a large, uniform target (Crumey 2014, MNRAS 442, 2600, Eqs. 35–38):
 * scotopic 7.633e-3·B^¾ − 7.174e-3·B, photopic (Weber) 2.72e-3·B above 0.354 cd/m².
 */
function largeTargetIncrement(backgroundCd: number): number {
  return backgroundCd < 0.354 ? 7.633e-3 * backgroundCd ** 0.75 - 7.174e-3 * backgroundCd : 2.72e-3 * backgroundCd;
}

/** Naked-eye limit in a natural dark sky: 1 kR at 557.7 nm, the faintest class (IBC I, ≈ Milky Way) of the aurora brightness scale. */
export const DARK_SKY_THRESHOLD_KR = 1;
const REFERENCE_INCREMENT = largeTargetIncrement(NATURAL_SKY_CD);

/** Faintest aurora (kR) a dark-adapted observer notices against a background of `backgroundCd`. */
export function visualThresholdKr(backgroundCd: number): number {
  return (DARK_SKY_THRESHOLD_KR * largeTargetIncrement(Math.max(backgroundCd, NATURAL_SKY_CD * 0.5))) / REFERENCE_INCREMENT;
}

/** Great-circle angle between two sky directions (altitude/azimuth, degrees). */
export function angularSeparationDeg(a: { altitudeDeg: number; azimuthDeg: number }, b: { altitudeDeg: number; azimuthDeg: number }): number {
  const cos =
    Math.sin(a.altitudeDeg * DEG) * Math.sin(b.altitudeDeg * DEG) +
    Math.cos(a.altitudeDeg * DEG) * Math.cos(b.altitudeDeg * DEG) * Math.cos((a.azimuthDeg - b.azimuthDeg) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / DEG;
}
