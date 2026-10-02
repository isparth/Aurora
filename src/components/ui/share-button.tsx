"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { buttonClass } from "./button";

type State = "idle" | "copied" | "failed";
const LABEL: Record<State, string> = { idle: "Share plan", copied: "Link copied", failed: "Couldn't copy the link" };

/** Shares the plan with travel companions (native share sheet on phones, copy link elsewhere). */
export function ShareButton({ title, text, className = "" }: { title: string; text: string; className?: string }) {
  const [state, setState] = useState<State>("idle");

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, text, url }).catch(() => undefined);
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(`${text} ${url}`);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <button type="button" onClick={share} className={buttonClass({ variant: "ghost", size: "md", className })}>
      {state === "copied" ? <Check aria-hidden className="h-4 w-4 text-aurora-300" /> : <Share2 aria-hidden className="h-4 w-4" />}
      <span aria-live="polite">{LABEL[state]}</span>
    </button>
  );
}
