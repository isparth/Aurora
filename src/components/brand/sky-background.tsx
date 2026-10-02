/** Decorative northern-sky backdrop: soft aurora glow, faint stars. Hidden from assistive tech. */
export function SkyBackground({ intensity = "full" }: { intensity?: "full" | "subtle" }) {
  const glow = intensity === "full" ? "opacity-100" : "opacity-45";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night-950">
      <div className="starfield absolute inset-0 opacity-60" />
      <div className={`absolute -top-[30%] left-[-20%] h-[85vh] w-[140%] ${glow}`}>
        <div
          className="h-full w-full animate-aurora-drift blur-3xl"
          style={{
            background:
              "radial-gradient(40% 55% at 30% 45%, rgb(63 213 154 / 0.34), transparent 70%), radial-gradient(35% 45% at 62% 35%, rgb(143 211 244 / 0.2), transparent 70%), radial-gradient(30% 40% at 80% 55%, rgb(185 168 245 / 0.16), transparent 70%)",
          }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[55vh] bg-gradient-to-t from-night-950 via-night-950/85 to-transparent" />
    </div>
  );
}
