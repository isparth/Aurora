"use client";

import { Loader2, MapPin, Mountain, Navigation2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { PlaceSuggestion } from "@/features/geocoding/search";

const KIND_ICON = { town: MapPin, place: Navigation2, spot: Mountain } as const;

/** WAI-ARIA combobox with list autocomplete. Selection is explicit: typing clears it. */
export function LocationCombobox({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  value: PlaceSuggestion | null;
  onChange: (place: PlaceSuggestion | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value?.name ?? "");
  const [dirty, setDirty] = useState(false);
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  const trimmed = query.trim();
  const visible = dirty && trimmed.length >= 2 ? options : [];
  const showList = open && visible.length > 0;

  useEffect(() => {
    if (!dirty || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const json = (await res.json()) as { results?: PlaceSuggestion[] };
        const results = res.ok ? (json.results ?? []) : [];
        setOptions(results);
        setActive(results.length > 0 ? 0 : -1);
        setOpen(true);
        setSearchFailed(!res.ok);
      } catch {
        if (!controller.signal.aborted) {
          setOptions([]);
          setSearchFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, dirty]);

  const choose = (place: PlaceSuggestion) => {
    onChange(place);
    setQuery(place.name);
    setDirty(false);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (visible.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + delta + visible.length) % visible.length);
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(visible[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
      <input
        ref={inputRef}
        id="location-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Town, hotel or address in Iceland"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDirty(true);
          setOpen(true);
          if (value) onChange(null);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => dirty && setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`h-14 w-full rounded-xl border bg-night-900/80 pr-12 pl-12 text-base text-ink placeholder:text-ink-subtle backdrop-blur-md transition-colors outline-none focus:border-aurora-300/70 focus:bg-night-800 ${
          invalid ? "border-danger/70" : "border-line-strong"
        }`}
      />
      <div className="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center">
        {loading ? (
          <Loader2 aria-hidden className="mr-2.5 h-5 w-5 animate-spin text-ink-subtle" />
        ) : (
          query && (
            <button
              type="button"
              aria-label="Clear location"
              disabled={disabled}
              onClick={() => {
                setQuery("");
                setDirty(true);
                onChange(null);
                inputRef.current?.focus();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-subtle hover:bg-white/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Location suggestions"
        className={`absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-line-strong bg-night-800/95 p-1.5 backdrop-blur-xl ${
          showList ? "" : "hidden"
        }`}
      >
        {visible.map((option, index) => {
          const Icon = KIND_ICON[option.kind];
          return (
            <li
              key={option.id}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${index === active ? "bg-white/8" : ""}`}
            >
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink-subtle" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{option.name}</span>
                <span className="block truncate text-xs text-ink-subtle">{option.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {dirty && trimmed.length >= 2 && !loading
          ? searchFailed
            ? "Search is unavailable right now."
            : `${visible.length} suggestion${visible.length === 1 ? "" : "s"} available.`
          : ""}
      </p>
    </div>
  );
}
