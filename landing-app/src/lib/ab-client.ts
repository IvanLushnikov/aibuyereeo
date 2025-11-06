"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureClientId } from "./client-id";
import { trackEvent } from "./analytics";
import { getExperimentDefinition } from "./ab-config";
import { assignVariantDeterministic } from "./ab-core";

function getLocalStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalStorageItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function getSessionStorageItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionStorageItem(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/**
 * Разбирает overrides из query-параметра `_ab=exp:variant,exp2:variant2`
 */
function parseAbOverridesFromQuery(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("_ab");
    if (!raw) return result;
    for (const part of raw.split(",")) {
      const [exp, variant] = part.split(":");
      if (exp && variant) {
        result[exp.trim()] = variant.trim();
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/**
 * Применяет overrides и сохраняет их в localStorage
 */
function applyQueryOverrides(): Record<string, string> {
  const overrides = parseAbOverridesFromQuery();
  for (const [exp, variant] of Object.entries(overrides)) {
    setLocalStorageItem(`ab_override_${exp}`, variant);
  }
  return overrides;
}

function resolveVariant(experimentId: string, clientId: string): string {
  const override = getLocalStorageItem(`ab_override_${experimentId}`);
  if (override && override.trim()) return override;

  const fixed = getLocalStorageItem(`ab_assign_${experimentId}`);
  if (fixed && fixed.trim()) return fixed;

  const def = getExperimentDefinition(experimentId);
  if (!def) return "control";
  const assigned = assignVariantDeterministic(clientId, def);
  setLocalStorageItem(`ab_assign_${experimentId}`, assigned);
  return assigned;
}

export function trackAbConversion(experimentId: string, payload?: Record<string, unknown>): void {
  trackEvent("ab_conversion", { experimentId, ...payload });
}

/**
 * Хук возвращает назначенный вариант эксперимента и функцию трекинга конверсии.
 */
export function useExperiment(
  experimentId: string
): { variant: string | null; trackConversion: (payload?: Record<string, unknown>) => void } {
  const [variant, setVariant] = useState<string | null>(null);
  const exposureSentRef = useRef(false);

  const clientId = useMemo(() => (typeof window !== "undefined" ? ensureClientId() : ""), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    applyQueryOverrides();
    const assigned = resolveVariant(experimentId, clientId || ensureClientId());
    setVariant(assigned);
  }, [experimentId, clientId]);

  useEffect(() => {
    if (!variant) return;
    if (exposureSentRef.current) return;

    const exposureKey = `ab_exposed_${experimentId}`;
    const alreadyExposed = getSessionStorageItem(exposureKey);
    if (alreadyExposed) {
      exposureSentRef.current = true;
      return;
    }

    trackEvent("ab_exposure", { experimentId, variant });
    setSessionStorageItem(exposureKey, "1");
    exposureSentRef.current = true;
  }, [experimentId, variant]);

  const trackConversion = (payload?: Record<string, unknown>) => trackAbConversion(experimentId, payload);

  return { variant, trackConversion };
}


