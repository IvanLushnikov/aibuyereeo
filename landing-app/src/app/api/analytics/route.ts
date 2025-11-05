import { NextResponse } from "next/server";
import { appendEventLog } from "@/lib/log-service";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "cta_click",
  "chat_open",
  "chat_message_sent",
  "chat_message_received",
  "chat_error",
  "feedback_submitted",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = typeof body?.event === "string" ? body.event : undefined;

    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: "invalid event" }, { status: 400 });
    }

    const clientId = typeof body?.clientId === "string" ? body.clientId : undefined;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : undefined;
    const payload = typeof body?.payload === "object" && body?.payload ? body.payload : undefined;

    await appendEventLog({
      timestamp: new Date().toISOString(),
      clientId,
      sessionId,
      event,
      payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics endpoint error", error);
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
}

