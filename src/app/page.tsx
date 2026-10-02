import { CloudSun, Navigation, Route } from "lucide-react";

import { SkyBackground } from "@/components/brand/sky-background";
import { Wordmark } from "@/components/brand/wordmark";
import { LocationForm } from "@/components/home/location-form";
import { TonightGlance } from "@/components/home/tonight-glance";
import { SiteFooter } from "@/components/site-footer";
import { getTonightGlance } from "@/features/recommendations/service";

/** Regenerated every 15 minutes, matching the aurora forecast cache — the page itself stays static. */
export const revalidate = 900;

const STEPS = [
  { icon: CloudSun, title: "Sky, hour by hour", body: "Cloud cover, darkness and aurora activity for 40+ safe viewing spots across Iceland." },
  { icon: Route, title: "Your drive and the roads", body: "Spots you can't reach in time, or with unsafe roads, drop out of the ranking." },
  { icon: Navigation, title: "One clear plan", body: "Where to go, when to leave, and directions — no account needed." },
];

export default async function HomePage() {
  const glance = await getTonightGlance();
  return (
    <main className="relative flex min-h-dvh flex-col">
      <SkyBackground />
      <header className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-10 sm:pt-8">
        <Wordmark />
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium tracking-wide text-aurora-300">Northern Lights · Iceland</p>
        <h1 className="mt-3 text-[2.75rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-[3.5rem]">Chase clearer skies.</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-pretty text-ink-muted">
          Tell us where you are. We&apos;ll find the best nearby place to see the Northern Lights tonight — and tell you when to leave.
        </p>
        <TonightGlance glance={glance} />
        <LocationForm className="mt-8" />
      </section>

      <section aria-labelledby="how-title" className="mx-auto w-full max-w-md px-6 pb-10 sm:max-w-4xl">
        <h2 id="how-title" className="text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
          How it works
        </h2>
        <ol className="mt-4 grid gap-5 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-aurora-300" />
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <SiteFooter className="mx-auto w-full max-w-md px-6 pb-8 sm:max-w-4xl" />
    </main>
  );
}
