import { Camera as CameraIcon, Sparkles } from "lucide-react";
import Image from "next/image";

import type { NearbyCamera } from "@/domain/types";
import { cameraImageSrc } from "@/lib/links";
import { cloudLabel } from "@/lib/scoring/labels";
import { formatRelative } from "@/lib/time";

const DIRECTION_NAME: Record<number, string> = { 0: "north", 45: "north-east", 90: "east", 135: "south-east", 180: "south", 225: "south-west", 270: "west", 315: "north-west" };

function analysisBullets(obs: NonNullable<NearbyCamera["observation"]>): string[] {
  if (!obs.usable) return ["Image not clear enough to judge the sky"];
  const bullets = [obs.skyVisible ? "Sky visible" : "Sky not visible"];
  if (obs.estimatedCloudCover !== undefined) bullets.push(`${cloudLabel(obs.estimatedCloudCover)} (about ${Math.round(obs.estimatedCloudCover * 100)}% cloud)`);
  if (obs.starsVisible) bullets.push("Stars visible");
  if (obs.fog) bullets.push("Fog or low cloud");
  if (obs.precipitation) bullets.push("Rain or snow falling");
  if (obs.visibility) bullets.push(`${obs.visibility[0].toUpperCase()}${obs.visibility.slice(1)} visibility`);
  bullets.push(obs.auroraVisible ? "Aurora appears to be visible" : "Aurora not clearly visible");
  return bullets;
}

export function CameraCard({ camera, now, visionEnabled }: { camera: NearbyCamera | undefined; now: string; visionEnabled: boolean }) {
  if (!camera) {
    return (
      <section aria-labelledby="camera-title" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="camera-title" className="text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
          Live conditions
        </h2>
        <p className="mt-2 text-sm text-ink-muted">No useful road camera within 30 km. The recommendation relies on the forecast alone.</p>
      </section>
    );
  }
  const { camera: cam, observation: obs } = camera;
  const direction = camera.metadata.directionDegrees !== undefined ? DIRECTION_NAME[camera.metadata.directionDegrees] : undefined;

  return (
    <section aria-labelledby="camera-title" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="p-5 pb-4">
        <h2 id="camera-title" className="text-xs font-semibold tracking-[0.2em] text-aurora-300 uppercase">
          Live conditions
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink">
          <CameraIcon aria-hidden className="h-4 w-4 text-ink-subtle" />
          Road camera · {cam.name} · {camera.distanceKm} km away
        </p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {direction ? `Looking ${direction} · ` : ""}
          {camera.imageUpdatedAt ? `Updated ${formatRelative(camera.imageUpdatedAt, now)}` : "Update time unknown"}
        </p>
      </div>
      <Image
        src={cameraImageSrc(cam)}
        alt={`Latest image from the ${cam.name} road camera${direction ? `, looking ${direction}` : ""}`}
        width={640}
        height={480}
        unoptimized
        className="aspect-[4/3] w-full bg-night-900 object-cover"
      />
      <div className="p-5 pt-4">
        {obs ? (
          <>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles aria-hidden className="h-4 w-4 text-dusk-300" />
              AI analysis
            </h3>
            {obs.summary && <p className="mt-1.5 text-sm text-ink-muted">{obs.summary}</p>}
            <ul className="mt-2 grid gap-1 text-sm text-ink-muted sm:grid-cols-2">
              {analysisBullets(obs).map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            {visionEnabled ? "Automatic analysis runs at night on fresh images." : "Automatic camera analysis is turned off."} The image is shown for reference.
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
          Camera analysis is supplementary. Road cameras often point at the road, are poorly exposed at night and can miss aurora entirely, so
          a camera that sees no aurora never lowers the score.
          {!cam.imageUrl.startsWith("/") && " Image © Icelandic Road and Coastal Administration, CC BY 4.0."}
        </p>
      </div>
    </section>
  );
}
