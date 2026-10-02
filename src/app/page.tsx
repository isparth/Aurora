import { SkyBackground } from "@/components/brand/sky-background";
import { Wordmark } from "@/components/brand/wordmark";
import { LocationForm } from "@/components/home/location-form";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col">
      <SkyBackground />
      <header className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-10 sm:pt-8">
        <Wordmark />
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14">
        <p className="text-sm font-medium tracking-wide text-aurora-300">Northern Lights · Iceland</p>
        <h1 className="mt-3 text-[2.75rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-[3.5rem]">
          Chase clearer skies.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-pretty text-ink-muted">
          Tell us where you are. We&apos;ll find the best nearby place to see the Northern Lights tonight — and tell you when to
          leave.
        </p>
        <LocationForm className="mt-10" />
      </section>

      <SiteFooter className="mx-auto w-full max-w-md px-6 pb-8" />
    </main>
  );
}
