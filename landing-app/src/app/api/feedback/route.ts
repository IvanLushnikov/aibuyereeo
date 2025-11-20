import { NextResponse } from "next/server";
import { appendEventLog } from "@/lib/log-service";

// Типы данных
type FeedbackPayload = {
  name: string;
  email: string;
  phone?: string;
  role: string;
  comment?: string;
  clientId?: string;
  sessionId?: string;
};

// Константы
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = Number(process.env.FEEDBACK_TIMEOUT_MS ?? 15000);

// Разрешённые роли (защита от некорректных данных)
const ALLOWED_ROLES = [
  "Инициатор",
  "Закупщик",
  "Технический специалист",
  "Другое",
];

/**
 * Очистка и нормализация строки
 * @returns пустую строку если значение невалидно, иначе очищенную строку
 */
function normalizeString(value: unknown, maxLength: number): string {
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
 * Валидация email
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Валидация телефона (опциональное поле)
 */
function isValidPhone(phone: string): boolean {
  if (!phone || phone.trim().length === 0) {
    return true; // Пустой телефон - это нормально (опциональное поле)
  }
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{10,12}$/.test(digits);
}

/**
 * Основная функция валидации payload
 * ВОЗВРАЩАЕТ ОШИБКУ ПРИ ЛЮБЫХ ПУСТЫХ ОБЯЗАТЕЛЬНЫХ ПОЛЯХ
 */
function validatePayload(data: unknown): {
  isValid: boolean;
  errors: string[];
  payload?: FeedbackPayload;
} {
  const errors: string[] = [];

  // Проверка типа данных
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { isValid: false, errors: ["Request body must be a valid object"] };
  }

  const raw = data as Record<string, unknown>;

  // Нормализация и проверка обязательных полей
  const name = normalizeString(raw.name, 200);
  const email = normalizeString(raw.email, 320);
  const role = normalizeString(raw.role, 200);

  // ЖЁСТКАЯ проверка имени
  if (name.length === 0) {
    errors.push("name is required and cannot be empty");
  } else if (name.length < 2) {
    errors.push("name must be at least 2 characters");
  }

  // ЖЁСТКАЯ проверка email
  if (email.length === 0) {
    errors.push("email is required and cannot be empty");
  } else if (!isValidEmail(email)) {
    errors.push("email format is invalid");
  }

  // ЖЁСТКАЯ проверка роли
  if (role.length === 0) {
    errors.push("role is required and cannot be empty");
  } else if (!ALLOWED_ROLES.includes(role)) {
    errors.push(`role must be one of: ${ALLOWED_ROLES.join(", ")}`);
  }

  // Проверка телефона (если указан)
  const phone = normalizeString(raw.phone, 32);
  if (phone.length > 0 && !isValidPhone(phone)) {
    errors.push("phone format is invalid (expected +7XXXXXXXXXX or 10-12 digits)");
  }

  // Если есть ошибки - возвращаем их
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // ФИНАЛЬНАЯ проверка перед формированием payload
  // Ещё раз проверяем, что обязательные поля не пустые
  if (!name || name.trim().length === 0) {
    return { isValid: false, errors: ["CRITICAL: name is empty after normalization"] };
  }
  if (!email || email.trim().length === 0 || !isValidEmail(email)) {
    return { isValid: false, errors: ["CRITICAL: email is empty or invalid after normalization"] };
  }
  if (!role || role.trim().length === 0 || !ALLOWED_ROLES.includes(role)) {
    return { isValid: false, errors: ["CRITICAL: role is empty or invalid after normalization"] };
  }

  // Формируем payload
  const payload: FeedbackPayload = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: role.trim(),
    phone: phone.trim().length > 0 ? phone.trim() : undefined,
    comment: normalizeString(raw.comment, 2000) || undefined,
    clientId: normalizeString(raw.clientId, 512) || undefined,
    sessionId: normalizeString(raw.sessionId, 512) || undefined,
  };

  return { isValid: true, errors: [], payload };
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

  // Метаданные запроса для логирования
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

  // Парсинг JSON
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

  // Валидация
  const validation = validatePayload(rawData);

  if (!validation.isValid || !validation.payload) {
    console.error(`[Feedback:${requestId}] Validation failed:`, {
      errors: validation.errors,
      rawDataPreview: JSON.stringify(rawData).slice(0, 500),
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

  // АБСОЛЮТНАЯ ФИНАЛЬНАЯ ПРОВЕРКА перед отправкой в webhook
  // Эта проверка - последний рубеж защиты от пустых данных
  if (!payload.name || 
      payload.name.trim().length === 0 ||
      payload.name.trim().length < 2) {
    console.error(`[Feedback:${requestId}] BLOCKED: Invalid name`, {
      name: payload.name,
      nameLength: payload.name?.length || 0,
      ip: clientIp,
    });
    return NextResponse.json(
      { error: "Invalid name" },
      { status: 400 }
    );
  }

  if (!payload.email || 
      payload.email.trim().length === 0 ||
      !isValidEmail(payload.email)) {
    console.error(`[Feedback:${requestId}] BLOCKED: Invalid email`, {
      email: payload.email,
      emailLength: payload.email?.length || 0,
      ip: clientIp,
    });
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }

  if (!payload.role || 
      payload.role.trim().length === 0 ||
      !ALLOWED_ROLES.includes(payload.role)) {
    console.error(`[Feedback:${requestId}] BLOCKED: Invalid role`, {
      role: payload.role,
      roleLength: payload.role?.length || 0,
      ip: clientIp,
    });
    return NextResponse.json(
      { error: "Invalid role" },
      { status: 400 }
    );
  }

  const submittedAt = new Date().toISOString();

  // Формируем payload для n8n webhook
  const webhookPayload = {
    type: "feedback_form",
    submittedAt,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone?.trim() || undefined,
    role: payload.role.trim(),
    comment: payload.comment?.trim() || undefined,
    clientId: payload.clientId?.trim() || undefined,
    sessionId: payload.sessionId?.trim() || undefined,
    // Дублируем в body для совместимости
    body: {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || undefined,
      role: payload.role.trim(),
      comment: payload.comment?.trim() || undefined,
    },
  };

  // ЕЩЁ ОДНА ПРОВЕРКА перед отправкой в webhook
  const finalCheck = {
    name: String(webhookPayload.name || "").trim(),
    email: String(webhookPayload.email || "").trim(),
    role: String(webhookPayload.role || "").trim(),
  };

  if (finalCheck.name.length === 0 || 
      finalCheck.name.length < 2 ||
      finalCheck.email.length === 0 || 
      !isValidEmail(finalCheck.email) ||
      finalCheck.role.length === 0 ||
      !ALLOWED_ROLES.includes(finalCheck.role)) {
    console.error(`[Feedback:${requestId}] BLOCKED: Final check failed before webhook`, {
      name: finalCheck.name,
      email: finalCheck.email,
      role: finalCheck.role,
      nameLength: finalCheck.name.length,
      emailLength: finalCheck.email.length,
      roleLength: finalCheck.role.length,
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
      fullPayload: JSON.stringify(webhookPayload),
    });
    return NextResponse.json(
      { error: "Cannot send invalid data to webhook" },
      { status: 400 }
    );
  }

  // Логируем успешную валидацию
  console.log(`[Feedback:${requestId}] Validated payload:`, {
    name: finalCheck.name,
    email: finalCheck.email,
    role: finalCheck.role,
    hasPhone: !!webhookPayload.phone,
    hasComment: !!webhookPayload.comment,
    nameLength: finalCheck.name.length,
    emailLength: finalCheck.email.length,
    roleLength: finalCheck.role.length,
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

  // Отправка в webhook с таймаутом
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
