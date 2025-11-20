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

function sanitizeText(value: unknown, maxLength: number): string {
  // Строгая проверка: если не строка или null/undefined, возвращаем пустую строку
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    // Пытаемся преобразовать в строку, но если это объект/массив - возвращаем пустую строку
    if (typeof value === "object") {
      return "";
    }
    return String(value).trim().slice(0, maxLength);
  }
  // Убираем все пробелы и проверяем, что осталось не пусто
  const trimmed = value.trim();
  return trimmed.slice(0, maxLength);
}

function validatePayload(data: Partial<FeedbackPayload>) {
  const errors: string[] = [];

  // Строгая валидация: проверяем тип и наличие значений ДО санитизации
  const rawName = data.name;
  const rawEmail = data.email;
  const rawRole = data.role;

  // Проверяем, что обязательные поля присутствуют и не null/undefined
  if (rawName === null || rawName === undefined || (typeof rawName === "string" && rawName.trim().length === 0)) {
    errors.push("name is required and cannot be empty");
  }
  if (rawEmail === null || rawEmail === undefined || (typeof rawEmail === "string" && rawEmail.trim().length === 0)) {
    errors.push("email is required and cannot be empty");
  }
  if (rawRole === null || rawRole === undefined || (typeof rawRole === "string" && rawRole.trim().length === 0)) {
    errors.push("role is required and cannot be empty");
  }

  // Санитизируем только если нет ошибок
  const name = sanitizeText(data.name, 200);
  const email = sanitizeText(data.email, 320);
  const phone = sanitizeText(data.phone ?? "", 32);
  const role = sanitizeText(data.role, 200);
  const comment = sanitizeText(data.comment ?? "", 2000);

  // Дополнительная проверка после санитизации
  if (name && name.trim().length === 0) {
    errors.push("name cannot be only whitespace");
  }
  if (email && (email.trim().length === 0 || !EMAIL_REGEX.test(email))) {
    errors.push("email is invalid");
  }
  if (role && role.trim().length === 0) {
    errors.push("role cannot be only whitespace");
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

  // Логируем источник запроса для отладки
  const clientIp = request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const referer = request.headers.get("referer") || "unknown";
  
  console.log("[Feedback] Request received:", {
    ip: clientIp,
    userAgent: userAgent.slice(0, 100),
    referer: referer.slice(0, 200),
    timestamp: new Date().toISOString(),
  });

  let data: unknown;
  try {
    data = await request.json();
  } catch (error) {
    console.error("[Feedback] Failed to parse JSON", error, {
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!data || typeof data !== "object") {
    console.error("[Feedback] Invalid body type:", typeof data, {
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
    });
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  // Логируем входящие данные для отладки
  const rawName = String((data as any).name || "");
  const rawEmail = String((data as any).email || "");
  const rawRole = String((data as any).role || "");
  
  console.log("[Feedback] Received data:", {
    hasName: !!rawName && rawName.trim().length > 0,
    hasEmail: !!rawEmail && rawEmail.trim().length > 0,
    hasRole: !!rawRole && rawRole.trim().length > 0,
    nameLength: rawName.length,
    emailLength: rawEmail.length,
    roleLength: rawRole.length,
    nameValue: rawName.slice(0, 50),
    emailValue: rawEmail.slice(0, 50),
    roleValue: rawRole.slice(0, 50),
    ip: clientIp,
    userAgent: userAgent.slice(0, 100),
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
  if (!payload.name || payload.name.trim().length === 0) {
    console.error("[Feedback] CRITICAL: name is empty or whitespace", {
      name: payload.name,
      nameLength: payload.name?.length,
    });
    return NextResponse.json(
      { error: "Name is required and cannot be empty" },
      { status: 400 }
    );
  }

  if (!payload.email || payload.email.trim().length === 0) {
    console.error("[Feedback] CRITICAL: email is empty or whitespace", {
      email: payload.email,
      emailLength: payload.email?.length,
    });
    return NextResponse.json(
      { error: "Email is required and cannot be empty" },
      { status: 400 }
    );
  }

  if (!payload.role || payload.role.trim().length === 0) {
    console.error("[Feedback] CRITICAL: role is empty or whitespace", {
      role: payload.role,
      roleLength: payload.role?.length,
    });
    return NextResponse.json(
      { error: "Role is required and cannot be empty" },
      { status: 400 }
    );
  }

  // Финальная проверка перед отправкой в webhook
  const finalName = payload.name.trim();
  const finalEmail = payload.email.trim();
  const finalRole = payload.role.trim();

  if (finalName.length === 0 || finalEmail.length === 0 || finalRole.length === 0) {
    console.error("[Feedback] CRITICAL: Fields are empty after trim", {
      nameLength: finalName.length,
      emailLength: finalEmail.length,
      roleLength: finalRole.length,
    });
    return NextResponse.json(
      { error: "Required fields cannot be empty" },
      { status: 400 }
    );
  }

  const submittedAt = new Date().toISOString();

  // Структура payload для n8n: данные в корне объекта (n8n использует $json.body ?? $json)
  const webhookPayload = {
    type: "feedback_form",
    submittedAt,
    name: finalName,
    email: finalEmail,
    phone: payload.phone?.trim() || undefined,
    role: finalRole,
    comment: payload.comment?.trim() || undefined,
    clientId: payload.clientId,
    sessionId: payload.sessionId,
    // Дублируем в body для совместимости с n8n (если он ожидает $json.body)
    body: {
      name: finalName,
      email: finalEmail,
      phone: payload.phone?.trim() || undefined,
      role: finalRole,
      comment: payload.comment?.trim() || undefined,
    },
  };

  // Финальная проверка перед отправкой в webhook
  if (!webhookPayload.name || !webhookPayload.email || !webhookPayload.role) {
    console.error("[Feedback] CRITICAL: Webhook payload has empty required fields", {
      webhookPayload,
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
      referer: referer.slice(0, 200),
    });
    return NextResponse.json(
      { error: "Cannot send empty data to webhook" },
      { status: 500 }
    );
  }

  // Дополнительная проверка: убеждаемся, что значения не состоят только из пробелов или спецсимволов
  if (webhookPayload.name.trim().length === 0 || 
      webhookPayload.email.trim().length === 0 || 
      webhookPayload.role.trim().length === 0) {
    console.error("[Feedback] CRITICAL: Fields are empty after final trim", {
      name: webhookPayload.name,
      email: webhookPayload.email,
      role: webhookPayload.role,
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
    });
    return NextResponse.json(
      { error: "Required fields cannot be empty" },
      { status: 400 }
    );
  }

  // Логируем данные перед отправкой в webhook
  console.log("[Feedback] Sending to webhook:", {
    name: webhookPayload.name,
    email: webhookPayload.email,
    role: webhookPayload.role,
    hasPhone: !!webhookPayload.phone,
    hasComment: !!webhookPayload.comment,
    nameLength: webhookPayload.name.length,
    emailLength: webhookPayload.email.length,
    roleLength: webhookPayload.role.length,
    ip: clientIp,
    userAgent: userAgent.slice(0, 100),
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

  // АБСОЛЮТНАЯ ФИНАЛЬНАЯ ПРОВЕРКА перед отправкой в webhook
  // Это последний рубеж защиты от пустых заявок
  if (!webhookPayload.name || 
      webhookPayload.name.trim().length === 0 ||
      !webhookPayload.email || 
      webhookPayload.email.trim().length === 0 ||
      !webhookPayload.role || 
      webhookPayload.role.trim().length === 0) {
    console.error("[Feedback] BLOCKED: Attempted to send empty data to webhook", {
      payload: JSON.stringify(webhookPayload),
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
      referer: referer.slice(0, 200),
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Cannot send empty data to webhook - all required fields must be filled" },
      { status: 400 }
    );
  }

  try {
    // ФИНАЛЬНАЯ ПРОВЕРКА: убеждаемся, что данные действительно не пустые перед отправкой
    // Это последний рубеж защиты - даже если что-то проскочило выше
    const finalCheckName = String(webhookPayload.name || "").trim();
    const finalCheckEmail = String(webhookPayload.email || "").trim();
    const finalCheckRole = String(webhookPayload.role || "").trim();
    
    if (finalCheckName.length === 0 || finalCheckEmail.length === 0 || finalCheckRole.length === 0) {
      console.error("[Feedback] FINAL BLOCK: Empty data detected right before webhook call", {
        name: finalCheckName,
        email: finalCheckEmail,
        role: finalCheckRole,
        nameLength: finalCheckName.length,
        emailLength: finalCheckEmail.length,
        roleLength: finalCheckRole.length,
        ip: clientIp,
        userAgent: userAgent.slice(0, 100),
        fullPayload: JSON.stringify(webhookPayload),
      });
      return NextResponse.json(
        { error: "Cannot send empty data to webhook - validation failed at final check" },
        { status: 400 }
      );
    }
    
    // Логируем полный payload перед отправкой (для отладки)
    console.log("[Feedback] Final payload being sent to webhook:", JSON.stringify(webhookPayload, null, 2));
    console.log("[Feedback] Webhook URL:", webhookUrl.replace(/\/[^\/]*$/, '/***')); // Скрываем последнюю часть URL
    
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


