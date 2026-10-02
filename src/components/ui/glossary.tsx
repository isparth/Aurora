import { InfoTip } from "./info-tip";

/** Plain-language explanations for the few terms a first-time visitor is likely to wonder about. */
export function ViewingScoreTip() {
  return (
    <InfoTip term="Viewing score">
      How good the sky should be for seeing the northern lights at this spot during your best window: mostly cloud cover, plus
      aurora activity, darkness and light pollution. 80+ is excellent. It can&apos;t promise the aurora will appear.
    </InfoTip>
  );
}

export function AuroraActivityTip() {
  return (
    <InfoTip term="Aurora activity">
      The Icelandic Met Office&apos;s forecast of how active the northern lights will be, from 0 (quiet) to 9 (very strong). Even 2–3
      can give a good show under a clear, dark sky — clouds matter more than this number.
    </InfoTip>
  );
}

export function ConfidenceTip() {
  return (
    <InfoTip term="Forecast confidence">
      How much to trust tonight&apos;s forecast. It drops when the time is far ahead, when cloud is changing quickly, or when some
      data is missing — check back closer to the time.
    </InfoTip>
  );
}
