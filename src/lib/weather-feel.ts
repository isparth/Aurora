/**
 * Wind chill (Environment Canada / NWS formula), valid for air at or below 10 °C with wind of at
 * least 4.8 km/h; otherwise the air temperature is what it feels like.
 */
export function feelsLikeC(tempC: number, windKph: number): number {
  if (tempC > 10 || windKph < 4.8) return tempC;
  const v = Math.pow(windKph, 0.16);
  return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
}

/** What to wear when you'll be standing still outside for an hour or more. */
export function clothingAdvice(feelsLike: number): string {
  if (feelsLike <= -10) return "Very cold for standing around: thermal layers, an insulated jacket, hat, gloves and warm boots.";
  if (feelsLike <= 0) return "Cold once you stop moving: warm layers, a hat and gloves.";
  return "Cool and often windy: bring a warm, windproof jacket.";
}
