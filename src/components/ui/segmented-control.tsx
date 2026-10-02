"use client";

import { useRef, type KeyboardEvent } from "react";

export type SegmentOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * Accessible single-choice control (WAI-ARIA radio group with roving focus). Arrow keys select
 * immediately by default; set `activateOnArrow={false}` when a change is expensive (e.g. it
 * triggers a new search), so arrows only move focus and Enter/Space confirms.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  activateOnArrow = true,
  className = "",
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  activateOnArrow?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    refs.current[next]?.focus();
    if (activateOnArrow) onChange(options[next].value);
  };

  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-xl border border-line bg-surface p-1 ${className}`}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => !selected && onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center transition-colors ${
              selected ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink"
            } disabled:opacity-60`}
          >
            <span className="text-sm font-medium">{option.label}</span>
            {option.hint && <span className="text-[11px] text-ink-subtle">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
