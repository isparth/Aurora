const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2";

const variants = {
  primary: "bg-ink text-night-950 hover:bg-white active:bg-ink-muted",
  aurora: "bg-aurora-300 text-night-950 hover:bg-aurora-200 active:bg-aurora-400",
  glass: "border border-line-strong bg-surface-raised text-ink backdrop-blur-md hover:bg-white/10 active:bg-white/15",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-5 text-base",
} as const;

export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
}: { variant?: keyof typeof variants; size?: keyof typeof sizes; block?: boolean; className?: string } = {}) {
  return [base, variants[variant], sizes[size], block ? "w-full" : "", className].filter(Boolean).join(" ");
}
