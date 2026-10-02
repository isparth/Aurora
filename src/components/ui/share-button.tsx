"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { buttonClass } from "./button";

/** Shares the plan with travel companions (native share sheet on phones, copy link elsewhere). */
export function ShareButton({ title, text, className = "" }: { title: string; text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, text, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button type="button" onClick={share} className={buttonClass({ variant: "ghost", size: "md", className })}>
      {copied ? <Check aria-hidden className="h-4 w-4 text-aurora-300" /> : <Share2 aria-hidden className="h-4 w-4" />}
      <span aria-live="polite">{copied ? "Link copied" : "Share plan"}</span>
    </button>
  );
}
