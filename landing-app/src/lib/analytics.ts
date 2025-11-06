import { ensureClientId } from "./client-id";

function getAbAssignmentsString(): string | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const pairs: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("ab_assign_")) {
        const exp = key.replace("ab_assign_", "");
        const variant = window.localStorage.getItem(key);
        if (variant && variant.trim()) {
          pairs.push(`${exp}:${variant}`);
        }
      }
    }
    return pairs.length ? pairs.join(",") : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Отправляет событие аналитики
 */
export async function trackEvent(event: string, payload?: Record<string, unknown>): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    
    const clientId = ensureClientId();
    if (!clientId || !clientId.trim()) {
      console.warn("[Analytics] Cannot track event: invalid clientId");
      return;
    }
    // Явные метки для Network: заголовки и query params
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const maybeExp = typeof payload?.experimentId === "string" ? String(payload?.experimentId) : undefined;
    const maybeVar = typeof (payload as any)?.variant === "string" ? String((payload as any)?.variant) : undefined;
    if ((event === "ab_exposure" || event === "ab_conversion") && maybeExp) {
      headers["X-AB-Experiment"] = maybeExp;
      if (maybeVar) headers["X-AB-Variant"] = maybeVar;
    }
    const allAssignments = getAbAssignmentsString();
    if (allAssignments) {
      headers["X-AB-Assignments"] = allAssignments;
    }

    const urlParams = new URLSearchParams();
    urlParams.set("e", event);
    if ((event === "ab_exposure" || event === "ab_conversion") && maybeExp) {
      urlParams.set("ab", `${maybeExp}${maybeVar ? ":" + maybeVar : ""}`);
    }
    if (allAssignments) {
      urlParams.set("abs", allAssignments);
    }
    const url = `/api/analytics?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId,
        event,
        payload,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn("[Analytics] API error:", response.status, errorData);
    }
  } catch (error) {
    // Не прерываем работу приложения из-за ошибок аналитики
    console.warn("[Analytics] track error:", error);
  }
}

/**
 * Удобный хелпер для человеко‑читаемых событий (описание действия как есть)
 * Пример: logEvent('нажал «Посмотреть, как работает» в первом экране', { location: 'hero' })
 */
export async function logEvent(description: string, payload?: Record<string, unknown>): Promise<void> {
  return trackEvent(description, payload);
}

