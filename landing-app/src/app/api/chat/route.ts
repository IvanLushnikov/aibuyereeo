import { NextResponse } from "next/server";
import { appendChatLog } from "@/lib/log-service";

type ChatHistoryItem = {
  role: "user" | "agent";
  content: string;
};

const FALLBACK_REPLY =
  "Семён сейчас перегружен. Попробуйте отправить запрос ещё раз через минуту.";

type RateState = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateState>();
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_SEC ?? 3600) * 1000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 20);

function isRateLimited(clientId: string) {
  const now = Date.now();
  const state = rateLimitStore.get(clientId);

  if (!state || now - state.windowStart > WINDOW_MS) {
    rateLimitStore.set(clientId, { count: 1, windowStart: now });
    return false;
  }

  if (state.count >= MAX_REQUESTS) {
    return true;
  }

  state.count += 1;
  rateLimitStore.set(clientId, state);
  return false;
}

export async function POST(request: Request) {
  const receivedAt = new Date();

  try {
    const body = await request.json();
    const clientId = String(body?.clientId ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const history: ChatHistoryItem[] = Array.isArray(body?.history)
      ? (body.history as ChatHistoryItem[])
          .filter((item: ChatHistoryItem) => item && item.content && item.role)
          .map((item: ChatHistoryItem) => ({
            role: item.role === "agent" ? "agent" : "user",
            content: String(item.content).slice(0, 4000),
          }))
      : [];
    const meta = typeof body?.meta === "object" && body?.meta ? body.meta : undefined;

    if (!clientId || !message) {
      return NextResponse.json(
        { error: "clientId and message are required" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    if (isRateLimited(clientId)) {
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: FALLBACK_REPLY,
        status: "error",
        meta: { reason: "rate_limit" },
      });
      return NextResponse.json(
        {
          reply: FALLBACK_REPLY,
          status: "error",
          reason: "rate_limit",
        },
        { status: 429 }
      );
    }

    await appendChatLog({
      timestamp: receivedAt.toISOString(),
      clientId,
      direction: "user",
      message,
      status: "ok",
      meta,
    });

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_SECRET;

    if (!webhookUrl) {
      await appendChatLog({
        timestamp: new Date().toISOString(),
        clientId,
        direction: "agent",
        message: FALLBACK_REPLY,
        status: "fallback",
      });
      return NextResponse.json(
        {
          reply: FALLBACK_REPLY,
          latencyMs: 0,
          status: "fallback",
        },
        { status: 200 }
      );
    }

    const startedAt = Date.now();
    const timeoutMs = Number(process.env.CHAT_TIMEOUT_MS ?? 25000);

    let replyText = FALLBACK_REPLY;
    let status: "ok" | "fallback" | "error" = "fallback";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-n8n-secret": secret } : {}),
        },
        body: JSON.stringify({ clientId, message, history, meta, receivedAt: receivedAt.toISOString() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`n8n webhook failed with status ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      replyText =
        typeof data?.reply === "string"
          ? data.reply
          : typeof data?.answer === "string"
            ? data.answer
            : FALLBACK_REPLY;
      status = replyText === FALLBACK_REPLY ? "fallback" : "ok";
    } catch (error) {
      console.error("chat webhook error", error);
      const isTimeout = error instanceof Error && error.name === "AbortError";
      status = isTimeout ? "error" : "error";
      replyText = isTimeout 
        ? "Семён слишком долго думает. Попробуйте ещё раз или переформулируйте вопрос."
        : FALLBACK_REPLY;
    }

    const latencyMs = Date.now() - startedAt;

    await appendChatLog({
      timestamp: new Date().toISOString(),
      clientId,
      direction: "agent",
      message: replyText,
      latencyMs,
      status,
      meta,
    });

    return NextResponse.json(
      {
        reply: replyText,
        latencyMs,
        status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("chat endpoint error", error);
    return NextResponse.json(
      { error: "invalid request" },
      { status: 400 }
    );
  }
}

