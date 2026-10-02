import Link from "next/link";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-xs leading-relaxed text-ink-subtle ${className}`}>
      <p>
        Aurora recommendations are probabilistic and never guarantee visibility. Always check{" "}
        <a className="underline decoration-line-strong underline-offset-2 hover:text-ink-muted" href="https://umferdin.is/en" target="_blank" rel="noreferrer">
          umferdin.is
        </a>{" "}
        and{" "}
        <a className="underline decoration-line-strong underline-offset-2 hover:text-ink-muted" href="https://safetravel.is" target="_blank" rel="noreferrer">
          safetravel.is
        </a>{" "}
        before driving at night.
      </p>
      <p className="mt-2">
        Aurora forecast: Icelandic Meteorological Office · Roads &amp; webcams: Icelandic Road and Coastal Administration (CC BY 4.0) ·
        Weather: Open-Meteo · Routing &amp; maps: OSRM, OpenFreeMap, © OpenStreetMap contributors ·{" "}
        <Link href="/about" className="underline decoration-line-strong underline-offset-2 hover:text-ink-muted">
          Sources &amp; method
        </Link>
      </p>
    </footer>
  );
}
