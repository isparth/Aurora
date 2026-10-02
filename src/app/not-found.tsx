import Link from "next/link";

import { SkyBackground } from "@/components/brand/sky-background";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <SkyBackground intensity="subtle" />
      <div className="max-w-sm text-center">
        <p className="text-sm text-aurora-300">404</p>
        <h1 className="mt-2 text-xl font-semibold">We couldn&apos;t find that place</h1>
        <p className="mt-2 text-sm text-ink-muted">It may not be one of our curated viewing spots.</p>
        <Link href="/" className={buttonClass({ variant: "aurora", className: "mt-5" })}>
          Find tonight&apos;s best spot
        </Link>
      </div>
    </main>
  );
}
