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

/**
 * Строгая проверка и очистка строкового значения
 * Возвращает пустую строку если значение невалидно
 */
function cleanString(value: unknown, maxLength: number): string {
  if (value === null || value === undefined) {
    return "";
  }
  
  if (typeof value !== "string") {
    return "";
  }
  
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  
  return trimmed.slice(0, maxLength);
}

/**
 * Проверка что строка не пустая после очистки
 */
function isNonEmptyString(value: unknown): boolean {
  const cleaned = cleanString(value, 10000);
  return cleaned.length > 0;
}

/**
 * Валидация payload - возвращает только валидные данные или ошибки
 */
function validateAndCleanPayload(data: unknown): { 
  isValid: boolean; 
  errors: string[]; 
  payload?: {
    name: string;
    email: string;
    phone?: string;
    role: string;
    comment?: string;
    clientId?: string;
    sessionId?: string;
  };
} {
  const errors: string[] = [];

  // Проверка что это объект
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { isValid: false, errors: ["Invalid request body"] };
  }

  const raw = data as Record<string, unknown>;

  // СТРОГАЯ проверка обязательных полей
  const name = cleanString(raw.name, 200);
  const email = cleanString(raw.email, 320);
  const role = cleanString(raw.role, 200);

  // Проверка name
  if (!isNonEmptyString(name)) {
    errors.push("name is required and cannot be empty");
  }

  // Проверка email
  if (!isNonEmptyString(email)) {
    errors.push("email is required and cannot be empty");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("email format is invalid");
  }

  // Проверка role
  if (!isNonEmptyString(role)) {
    errors.push("role is required and cannot be empty");
  }

  // Если есть ошибки - возвращаем их
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Все обязательные поля валидны - формируем payload
  const phone = cleanString(raw.phone, 32);
  const comment = cleanString(raw.comment, 2000);
  const clientId = cleanString(raw.clientId, 512);
  const sessionId = cleanString(raw.sessionId, 512);

  return {
    isValid: true,
    errors: [],
    payload: {
      name,
      email,
      phone: phone || undefined,
      role,
      comment: comment || undefined,
      clientId: clientId || undefined,
      sessionId: sessionId || undefined,
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

  // Логируем источник запроса
  const clientIp = request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const referer = request.headers.get("referer") || "unknown";
  
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[Feedback:${requestId}] Request received:`, {
    ip: clientIp,
    userAgent: userAgent.slice(0, 100),
    referer: referer.slice(0, 200),
    timestamp: new Date().toISOString(),
  });

  // Парсим JSON
  let rawData: unknown;
  try {
    rawData = await request.json();
  } catch (error) {
    console.error(`[Feedback:${requestId}] Failed to parse JSON:`, error);
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // Валидация и очистка данных
  const validation = validateAndCleanPayload(rawData);

  if (!validation.isValid || !validation.payload) {
    console.error(`[Feedback:${requestId}] Validation failed:`, {
      errors: validation.errors,
      rawData: JSON.stringify(rawData).slice(0, 500),
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
    });
    return NextResponse.json(
      { 
        error: "Validation failed", 
        details: validation.errors 
      },
      { status: 400 }
    );
  }

  const payload = validation.payload;

  // АБСОЛЮТНАЯ ФИНАЛЬНАЯ ПРОВЕРКА - если что-то не так, блокируем
  if (!payload.name || 
      payload.name.trim().length === 0 ||
      !payload.email || 
      payload.email.trim().length === 0 ||
      !EMAIL_REGEX.test(payload.email) ||
      !payload.role || 
      payload.role.trim().length === 0) {
    console.error(`[Feedback:${requestId}] CRITICAL: Final validation failed`, {
      name: payload.name,
      email: payload.email,
      role: payload.role,
      nameLength: payload.name?.length || 0,
      emailLength: payload.email?.length || 0,
      roleLength: payload.role?.length || 0,
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
    });
    return NextResponse.json(
      { error: "Required fields are missing or invalid" },
      { status: 400 }
    );
  }

  const submittedAt = new Date().toISOString();

  // Формируем payload для n8n
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
    // Дублируем в body для совместимости с n8n
    body: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      comment: payload.comment,
    },
  };

  // ЕЩЕ ОДНА ПРОВЕРКА перед отправкой
  const finalName = String(webhookPayload.name || "").trim();
  const finalEmail = String(webhookPayload.email || "").trim();
  const finalRole = String(webhookPayload.role || "").trim();

  if (finalName.length === 0 || 
      finalEmail.length === 0 || 
      !EMAIL_REGEX.test(finalEmail) ||
      finalRole.length === 0) {
    console.error(`[Feedback:${requestId}] BLOCKED: Empty data before webhook`, {
      name: finalName,
      email: finalEmail,
      role: finalRole,
      nameLength: finalName.length,
      emailLength: finalEmail.length,
      roleLength: finalRole.length,
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
      fullPayload: JSON.stringify(webhookPayload),
    });
    return NextResponse.json(
      { error: "Cannot send empty or invalid data to webhook" },
      { status: 400 }
    );
  }

  // Логируем успешную валидацию
  console.log(`[Feedback:${requestId}] Validated payload:`, {
    name: finalName,
    email: finalEmail,
    role: finalRole,
    hasPhone: !!webhookPayload.phone,
    hasComment: !!webhookPayload.comment,
    nameLength: finalName.length,
    emailLength: finalEmail.length,
    roleLength: finalRole.length,
  });

  // Логируем событие
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
    console.warn(`[Feedback:${requestId}] Failed to append event log:`, error);
  });

  // Отправляем в webhook
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    console.log(`[Feedback:${requestId}] Sending to webhook:`, {
      webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
      payloadSize: JSON.stringify(webhookPayload).length,
    });

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
      console.error(`[Feedback:${requestId}] Webhook failed:`, {
        status: response.status,
        statusText: response.statusText,
        responseText: text.slice(0, 500),
      });
      return NextResponse.json(
        { error: "Webhook request failed", status: response.status },
        { status: 502 }
      );
    }

    console.log(`[Feedback:${requestId}] Successfully sent to webhook`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    clearTimeout(timeout);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Feedback:${requestId}] Error calling webhook:`, errorMessage);
    const status = errorMessage.includes("aborted") ? 504 : 500;
    return NextResponse.json(
      { error: "Failed to deliver feedback", message: errorMessage },
      { status }
    );
  }
}
