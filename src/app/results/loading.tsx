import { SkyBackground } from "@/components/brand/sky-background";

const Bar = ({ className }: { className: string }) => <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;

export default function ResultsLoading() {
  return (
    <main className="relative min-h-dvh" aria-busy="true">
      <SkyBackground intensity="subtle" />
      <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(440px,540px)_1fr]">
        <div className="mx-auto w-full max-w-xl px-5 pt-5 sm:px-8">
          <Bar className="h-6 w-28" />
          <p className="mt-8 text-sm text-aurora-300" role="status">
            Checking clouds, aurora activity, darkness and roads…
          </p>
          <Bar className="mt-3 h-8 w-3/4" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Bar className="h-16" />
            <Bar className="h-16" />
            <Bar className="h-16" />
          </div>
          <Bar className="mt-5 h-14" />
          <div className="mt-5 space-y-4 rounded-2xl border border-line p-5">
            <Bar className="h-4 w-24" />
            <Bar className="h-7 w-2/3" />
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 animate-pulse rounded-full bg-white/[0.06]" />
              <Bar className="h-10 w-28" />
            </div>
            <Bar className="h-16" />
            <Bar className="h-24" />
          </div>
          <div className="mt-8 space-y-3">
            <Bar className="h-14" />
            <Bar className="h-14" />
            <Bar className="h-14" />
          </div>
        </div>
        <div className="hidden h-dvh animate-pulse border-l border-line bg-night-900 lg:block" />
      </div>
    </main>
  );
}
