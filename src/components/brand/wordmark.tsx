import Link from "next/link";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2.5 rounded-md text-[13px] font-semibold tracking-[0.42em] text-ink ${className}`}
      aria-label="Aurora — home"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <defs>
          <linearGradient id="wordmark-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#3fd59a" />
            <stop offset="0.6" stopColor="#8fd3f4" />
            <stop offset="1" stopColor="#b9a8f5" />
          </linearGradient>
        </defs>
        <path d="M3 19c2.5-7 6-11 9-11s6.5 4 9 11" fill="none" stroke="url(#wordmark-g)" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 19c1.6-4.2 3.3-6.4 5-6.4s3.4 2.2 5 6.4" fill="none" stroke="url(#wordmark-g)" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      </svg>
      AURORA
    </Link>
  );
}
