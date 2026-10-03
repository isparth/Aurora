import { InfoTip } from "./info-tip";

/** Plain-language explanations for the few terms a first-time visitor is likely to wonder about. */
export function ChanceTip() {
  return (
    <InfoTip term="Chance of seeing the aurora">
      Our estimate that you&apos;ll see the northern lights with your own eyes at this spot during the best window: a clear view of the
      sky, times aurora bright enough to see — which depends on activity, where the auroral oval is, and how dark the sky is. It&apos;s
      good to roughly ±10–15 points. Phone cameras pick up fainter aurora than your eyes.
    </InfoTip>
  );
}

export function AuroraActivityTip() {
  return (
    <InfoTip term="Aurora activity (Kp)">
      How disturbed Earth&apos;s magnetic field is, on the 0–9 Kp scale used by NOAA and the Icelandic Met Office. Around Kp 2–3 the
      auroral oval reaches north and west Iceland near midnight; from Kp 4 it covers the whole country. Clouds still matter more than
      this number.
    </InfoTip>
  );
}

export function ConfidenceTip() {
  return (
    <InfoTip term="Forecast confidence">
      How much to trust tonight&apos;s chance. It drops when the time is far ahead, when the activity forecast is uncertain, when cloud is
      changing quickly, or when some data is missing — check back closer to the time.
    </InfoTip>
  );
}
