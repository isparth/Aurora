"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

const PANEL_WIDTH = 256;
const EDGE = 8;

/**
 * Small "what does this mean?" disclosure. Opens on tap/click, closes on Escape or a tap elsewhere,
 * and is positioned to stay fully on screen, even on a 320 px phone.
 */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
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

  const toggle = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect && !open) {
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * EDGE);
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, EDGE), window.innerWidth - EDGE - width);
      setStyle({ width, left: left - rect.left });
    }
    setOpen((o) => !o);
  };

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What does “${term}” mean?`}
        onClick={toggle}
        className="-m-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-subtle hover:text-ink"
      >
        <Info aria-hidden className="h-3.5 w-3.5" />
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        style={style}
        className="absolute top-full z-40 mt-1 rounded-xl border border-line-strong bg-night-800 p-3 text-left text-xs leading-relaxed font-normal tracking-normal text-ink-muted normal-case shadow-2xl"
      >
        <span className="mb-1 block font-semibold text-ink">{term}</span>
        {children}
      </span>
    </span>
  );
}
