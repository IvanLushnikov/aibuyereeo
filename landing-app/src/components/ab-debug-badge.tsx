"use client";

import { experiments } from "@/lib/ab-config";
import { useExperiment } from "@/lib/ab-client";

function isAbDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("_abdebug") || params.get("debug") === "ab";
  } catch {
    return false;
  }
}

function variantLetter(expId: string, variantName: string | null): string {
  if (!variantName) return "?";
  const exp = experiments.find((e) => e.id === expId);
  const index = exp?.variants.findIndex((v) => v.name === variantName) ?? -1;
  if (index < 0) return "?";
  // A, B, C ...
  return String.fromCharCode("A".charCodeAt(0) + index);
}

export function AbDebugBadge() {
  if (!isAbDebugEnabled()) return null;

  // Важно: количество экспериментов фиксировано на уровне конфигурации,
  // поэтому использование хуков внутри .map детерминистично.
  const items = experiments.map((exp) => {
    const { variant } = useExperiment(exp.id);
    const letter = variantLetter(exp.id, variant);
    return { id: exp.id, variant, letter };
  });

  return (
    <div className="fixed bottom-3 left-3 z-[9999] rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-[11px] text-white/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.4)]">
      <div className="mb-1 font-semibold tracking-wide text-white/80">AB‑debug</div>
      <div className="flex flex-col gap-0.5">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
              {it.letter}
            </span>
            <span className="text-white/70">{it.id}:</span>
            <span className="font-medium text-white">{it.variant ?? "…"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


