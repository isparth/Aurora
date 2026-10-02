import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkyBackground } from "@/components/brand/sky-background";
import { DetailView } from "@/components/location/detail-view";
import { getViewingLocation } from "@/data/viewing-locations";
import { isDemoParam, parseDetailQuery } from "@/features/recommendations/query";
import { getLocationDetail } from "@/features/recommendations/service";
import { DEFAULT_TRAVEL_MODE } from "@/features/recommendations/travel-modes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const location = getViewingLocation((await params).id);
  return { title: location ? `${location.name} tonight` : "Viewing spot" };
}

export default async function LocationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const location = getViewingLocation(id);
  if (!location) notFound();

  const raw = await searchParams;
  const parsed = parseDetailQuery(raw);
  // An invalid shared link still shows the spot — just without travel planning.
  const q = parsed.ok ? parsed.value : { travelMode: DEFAULT_TRAVEL_MODE, demo: isDemoParam(raw) };

  const detail = await getLocationDetail({ id, ...q });
  if (!detail) notFound();

  return (
    <main className="relative min-h-dvh">
      <SkyBackground intensity="subtle" />
      <DetailView detail={detail} location={location} params={{ lat: q.lat, lon: q.lon, label: q.label, mode: q.travelMode, demo: q.demo }} />
    </main>
  );
}
