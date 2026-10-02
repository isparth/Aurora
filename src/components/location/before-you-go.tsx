import { Car, ParkingSquare, Shirt, TriangleAlert } from "lucide-react";

import type { Recommendation, ViewingLocation } from "@/domain/types";
import { formatTime } from "@/lib/time";
import { clothingAdvice, feelsLikeC } from "@/lib/weather-feel";

/** The practical checklist: what it will feel like, the drive, and how to behave on site. */
export function BeforeYouGo({ rec, location }: { rec: Recommendation; location: ViewingLocation }) {
  const peak = rec.hourly.find((h) => h.time === rec.bestWindow?.peak)?.conditions ?? rec.conditions;
  const temp = peak?.temperatureC;
  const wind = peak?.windKph ?? 0;
  const feels = temp === undefined ? null : Math.round(feelsLikeC(temp, wind));

  const road =
    rec.road.status === "good"
      ? "Roads on the way are reported easily passable. Still allow extra time — it's dark and conditions can change."
      : rec.road.status === "caution"
        ? `${rec.road.description ?? "Slippery stretches reported"} — drive slowly and keep your distance.`
        : rec.road.status === "unknown"
          ? "Road conditions are unavailable for this drive — check umferdin.is before you set off."
          : "Serious road warnings on this route — please don't attempt it tonight.";

  const items = [
    feels !== null && {
      icon: Shirt,
      title: `Feels like ${feels < 0 ? "−" : ""}${Math.abs(feels)}°C${rec.bestWindow ? ` around ${formatTime(rec.bestWindow.peak)}` : ""}`,
      body: `${clothingAdvice(feels)}${wind >= 20 ? ` Wind about ${Math.round(wind)} km/h.` : ""}`,
    },
    {
      icon: rec.road.status === "good" ? Car : TriangleAlert,
      title: location.normalCarAccessible ? "Fine for a normal car" : "4×4 recommended",
      body: road,
    },
    {
      icon: ParkingSquare,
      title: location.parkingAvailable ? "Park in the parking area" : "Limited parking",
      body: "Never stop on the road or the hard shoulder to look up. Switch off your headlights once parked.",
    },
  ].filter(Boolean) as { icon: typeof Car; title: string; body: string }[];

  return (
    <section aria-labelledby="before-title" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="before-title" className="text-sm font-semibold">
        Before you go
      </h2>
      <ul className="mt-3 space-y-3.5">
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-aurora-300" />
            <div>
              <p className="text-sm font-medium text-ink">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
