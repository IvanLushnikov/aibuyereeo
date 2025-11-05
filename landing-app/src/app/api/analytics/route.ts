import { NextResponse } from "next/server";
import { appendEventLog } from "@/lib/log-service";
import { RateLimiter } from "@/lib/rate-limit";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "cta_click",
  "chat_open",
  "chat_message_sent",
  "chat_message_received",
  "chat_error",
  "feedback_submitted",
]);

// Rate limiting для analytics: максимум 100 событий в минуту на clientId
const analyticsRateLimiter = new RateLimiter(
  Number(process.env.ANALYTICS_RATE_LIMIT_MAX ?? 100),
  Number(process.env.ANALYTICS_RATE_LIMIT_WINDOW_SEC ?? 60) * 1000,
  Number(process.env.ANALYTICS_RATE_LIMIT_STORE_SIZE ?? 5000)
);

let cleanupCounter = 0;

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[Analytics] JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      console.error("[Analytics] Invalid body type:", typeof body);
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const event = typeof body?.event === "string" ? body.event : undefined;

    if (!event || !ALLOWED_EVENTS.has(event)) {
      console.error("[Analytics] Invalid event:", event, "Allowed events:", Array.from(ALLOWED_EVENTS));
      return NextResponse.json(
        { error: `invalid event. Allowed: ${Array.from(ALLOWED_EVENTS).join(", ")}` },
        { status: 400 }
      );
    }

    const clientId = typeof body?.clientId === "string" && body.clientId.trim() ? body.clientId.trim() : undefined;
    const sessionId = typeof body?.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : undefined;
    let payload = typeof body?.payload === "object" && body?.payload ? body.payload : undefined;

    // clientId не обязателен, но если передан - должен быть валидным
    if (body?.clientId !== undefined && !clientId) {
      console.warn("[Analytics] Empty clientId provided, continuing without it");
    }

    // Rate limiting для analytics (только если есть clientId)
    if (clientId) {
      cleanupCounter++;
      if (cleanupCounter % 100 === 0) {
        analyticsRateLimiter.cleanup();
      }

      if (analyticsRateLimiter.isLimited(clientId)) {
        console.warn(`[Analytics] Rate limit exceeded for clientId: ${clientId.slice(0, 8)}...`);
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
    }

    // Ограничение размера payload для предотвращения проблем с памятью
    const MAX_PAYLOAD_SIZE = 100 * 1024; // 100KB
    if (payload) {
      const payloadString = JSON.stringify(payload);
      if (payloadString.length > MAX_PAYLOAD_SIZE) {
        console.warn("[Analytics] Payload too large, truncating:", payloadString.length);
        // Ограничиваем размер payload
        payload = { 
          _truncated: true,
          _originalSize: payloadString.length,
          ...Object.fromEntries(Object.entries(payload).slice(0, 10)) // Оставляем только первые 10 полей
        };
      }
    }

    await appendEventLog({
      timestamp: new Date().toISOString(),
      clientId,
      sessionId,
      event,
      payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Analytics] endpoint error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid payload" },
      { status: 400 }
    );
  }
}

