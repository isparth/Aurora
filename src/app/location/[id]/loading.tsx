import { SkyBackground } from "@/components/brand/sky-background";

const Bar = ({ className }: { className: string }) => <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;

export default function LocationLoading() {
  return (
    <main className="relative min-h-dvh" aria-busy="true">
      <SkyBackground intensity="subtle" />
      <div className="mx-auto max-w-5xl px-5 pt-5 sm:px-8">
        <Bar className="h-6 w-24" />
        <p className="mt-8 text-sm text-aurora-300" role="status">
          Scoring tonight hour by hour…
        </p>
        <Bar className="mt-3 h-9 w-2/3 max-w-md" />
        <Bar className="mt-4 h-12 w-48" />
        <Bar className="mt-6 h-20" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <Bar className="h-64" />
          <Bar className="h-64" />
        </div>
      </div>
    </main>
  );
}
