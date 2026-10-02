"use client";

import dynamic from "next/dynamic";

import type { AuroraMapProps } from "./aurora-map";

const AuroraMap = dynamic(() => import("./aurora-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-night-900" aria-busy="true">
      <span className="text-sm text-ink-subtle">Loading map…</span>
    </div>
  ),
});

export function MapPanel(props: AuroraMapProps) {
  return <AuroraMap {...props} />;
}
