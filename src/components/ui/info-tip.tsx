"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Small "what does this mean?" disclosure. Opens on tap/click, closes on Escape or a tap elsewhere. */
export function InfoTip({ term, children, align = "center" }: { term: string; children: ReactNode; align?: "center" | "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const position = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What does “${term}” mean?`}
        onClick={() => setOpen((o) => !o)}
        className="-m-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:text-ink"
      >
        <Info aria-hidden className="h-3.5 w-3.5" />
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        className={`absolute top-full z-40 mt-1 w-64 rounded-xl border border-line-strong bg-night-800 p-3 text-left text-xs leading-relaxed font-normal tracking-normal text-ink-muted normal-case shadow-2xl ${position}`}
      >
        <span className="mb-1 block font-semibold text-ink">{term}</span>
        {children}
      </span>
    </span>
  );
}
