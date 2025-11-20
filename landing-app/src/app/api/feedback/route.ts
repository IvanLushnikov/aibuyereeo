import { NextResponse } from "next/server";
import { appendEventLog } from "@/lib/log-service";

type FeedbackPayload = {
  name: string;
  email: string;
  phone?: string;
  role: string;
  comment?: string;
  clientId?: string;
  sessionId?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = Number(process.env.FEEDBACK_TIMEOUT_MS ?? 15000);

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function validatePayload(data: Partial<FeedbackPayload>) {
  const errors: string[] = [];

  const name = sanitizeText(data.name, 200);
  const email = sanitizeText(data.email, 320);
  const phone = sanitizeText(data.phone ?? "", 32);
  const role = sanitizeText(data.role, 200);
  const comment = sanitizeText(data.comment ?? "", 2000);

  if (!name) {
    errors.push("name is required");
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push("email is invalid");
  }
  if (!role) {
    errors.push("role is required");
  }

  return {
    errors,
    payload: {
      name,
      email,
      phone: phone || undefined,
      role,
      comment,
      clientId: sanitizeText(data.clientId ?? "", 512) || undefined,
      sessionId: sanitizeText(data.sessionId ?? "", 512) || undefined,
    },
  };
}

export async function POST(request: Request) {
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("[Feedback] FEEDBACK_WEBHOOK_URL is not configured");
    return NextResponse.json(
      { error: "Feedback webhook is not configured" },
      { status: 500 }
    );
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch (error) {
    console.error("[Feedback] Failed to parse JSON", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!data || typeof data !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  // Логируем входящие данные для отладки
  console.log("[Feedback] Received data:", {
    hasName: !!(data as any).name,
    hasEmail: !!(data as any).email,
    hasRole: !!(data as any).role,
    nameLength: String((data as any).name || "").length,
    emailLength: String((data as any).email || "").length,
    roleLength: String((data as any).role || "").length,
  });

  const { errors, payload } = validatePayload(data as Partial<FeedbackPayload>);

  if (errors.length > 0) {
    console.error("[Feedback] Validation failed:", errors, "Payload:", JSON.stringify(payload));
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 }
    );
  }

  // Дополнительная проверка: убеждаемся, что обязательные поля не пустые
  if (!payload.name || !payload.email || !payload.role) {
    console.error("[Feedback] Critical validation: empty required fields", {
      name: payload.name,
      email: payload.email,
      role: payload.role,
    });
    return NextResponse.json(
      { error: "Required fields are missing" },
      { status: 400 }
    );
  }

  const submittedAt = new Date().toISOString();

  const webhookPayload = {
    type: "feedback_form",
    submittedAt,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    role: payload.role,
    comment: payload.comment,
    clientId: payload.clientId,
    sessionId: payload.sessionId,
  };

  // Логируем данные перед отправкой в webhook
  console.log("[Feedback] Sending to webhook:", {
    name: webhookPayload.name,
    email: webhookPayload.email,
    role: webhookPayload.role,
    hasPhone: !!webhookPayload.phone,
    hasComment: !!webhookPayload.comment,
  });

  await appendEventLog({
    timestamp: submittedAt,
    clientId: payload.clientId,
    sessionId: payload.sessionId,
    event: "feedback_submitted",
    payload: {
      name: payload.name,
      role: payload.role,
      hasComment: Boolean(payload.comment),
    },
  }).catch((error) => {
    console.warn("[Feedback] Failed to append event log", error);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[Feedback] Webhook failed", response.status, text);
      return NextResponse.json(
        { error: "Webhook request failed", status: response.status },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Feedback] Error calling webhook", errorMessage);
    const status = errorMessage.includes("aborted") ? 504 : 500;
    return NextResponse.json(
      { error: "Failed to deliver feedback", message: errorMessage },
      { status }
    );
  } finally {
    clearTimeout(timeout);
  }
}


