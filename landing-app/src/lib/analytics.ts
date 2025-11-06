import { ensureClientId } from "./client-id";

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

    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

