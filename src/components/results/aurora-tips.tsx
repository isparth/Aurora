import { ChevronDown } from "lucide-react";

const TIPS: { title: string; body: string }[] = [
  { title: "Look north and be patient.", body: "The aurora comes and goes in waves — give it 30 to 60 minutes once you're there." },
  {
    title: "Let your eyes adjust.",
    body: "Switch off headlights and screens for 15–20 minutes. Faint aurora can look like a pale grey cloud; your phone camera often sees the green first.",
  },
  { title: "Photos:", body: "use your phone's night mode and rest it on something steady for a few seconds." },
  {
    title: "Stay safe.",
    body: "Park only in proper parking areas — never stop on the road or the hard shoulder to look up. Dress for wind and cold.",
  },
];

/** Short, practical advice for someone who has never seen the northern lights before. */
export function AuroraTips({ defaultOpen = false, className = "" }: { defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={`group rounded-xl border border-line bg-surface px-4 py-3 text-sm ${className}`}>
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-medium text-ink marker:hidden">
        First time chasing the northern lights?
        <ChevronDown aria-hidden className="h-4 w-4 text-ink-subtle transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-2.5 pb-1">
        {TIPS.map((t) => (
          <li key={t.title} className="leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">{t.title}</span> {t.body}
          </li>
        ))}
      </ul>
    </details>
  );
}
