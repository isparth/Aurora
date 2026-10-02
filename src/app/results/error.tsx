"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SkyBackground } from "@/components/brand/sky-background";
import { buttonClass } from "@/components/ui/button";

export default function ResultsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <SkyBackground intensity="subtle" />
      <div role="alert" className="max-w-sm text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          We couldn&apos;t put tonight&apos;s recommendations together. This is usually temporary.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={() => retry()} className={buttonClass({ variant: "aurora" })}>
            Try again
          </button>
          <Link href="/" className={buttonClass({ variant: "glass" })}>
            Change location
          </Link>
        </div>
      </div>
    </main>
  );
}
