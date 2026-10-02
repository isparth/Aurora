import type { Metadata } from "next";
import Link from "next/link";

import { SkyBackground } from "@/components/brand/sky-background";
import { ResultsView } from "@/components/results/results-view";
import { buttonClass } from "@/components/ui/button";
import { parseRecommendationQuery } from "@/features/recommendations/query";
import { getRecommendations } from "@/features/recommendations/service";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseRecommendationQuery(await searchParams);
  const label = query.ok ? query.value.label : undefined;
  return { title: label ? `Tonight near ${label}` : "Tonight's best aurora spots" };
}

export default async function ResultsPage({ searchParams }: Props) {
  const query = parseRecommendationQuery(await searchParams);

  if (!query.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <SkyBackground intensity="subtle" />
        <div role="alert" className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">We need a location first</h1>
          <p className="mt-2 text-sm text-ink-muted">That link is missing a valid location. Choose where you are to see tonight&apos;s best spots.</p>
          <Link href="/" className={buttonClass({ variant: "aurora", className: "mt-5" })}>
            Choose a location
          </Link>
        </div>
      </main>
    );
  }

  const { lat, lon, label, travelMode, demo } = query.value;
  const data = await getRecommendations(query.value);

  return (
    <main className="relative min-h-dvh">
      <SkyBackground intensity="subtle" />
      <ResultsView key={`${travelMode}:${lat}:${lon}`} data={data} params={{ lat, lon, label, mode: travelMode, demo }} />
    </main>
  );
}
