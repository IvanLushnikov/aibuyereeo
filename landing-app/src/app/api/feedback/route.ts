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
  
  // Удаляем невидимые символы и проверяем, что осталось что-то реальное
  const cleaned = trimmed.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
  if (cleaned.length === 0) {
    return "";
  }
  
  return cleaned.slice(0, maxLength);
}

/**
 * Проверка, что строка не является "пустой" (только пробелы, дефисы, спецсимволы)
 */
function isEffectivelyEmpty(str: string): boolean {
  if (!str || typeof str !== "string") {
    return true;
  }
  
  const trimmed = str.trim();
  if (trimmed.length === 0) {
    return true;
  }
  
  // Проверяем, что строка не состоит только из дефисов, подчеркиваний, точек и пробелов
  const cleaned = trimmed.replace(/[-_\.\s\u200B-\u200D\uFEFF\u00A0]/g, '');
  if (cleaned.length === 0) {
    return true;
  }
  
  // Проверяем на невалидные значения
  const lower = trimmed.toLowerCase();
  const invalidValues = ["-", "—", "_", ".", "нет", "empty", "undefined", "null", "n/a", "na", ""];
  if (invalidValues.includes(lower)) {
    return true;
  }
  
  return false;
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
  } else if (isEffectivelyEmpty(name)) {
    errors.push("name contains only invalid characters");
  }

  // ЖЁСТКАЯ проверка email
  if (email.length === 0) {
    errors.push("email is required and cannot be empty");
  } else if (isEffectivelyEmpty(email)) {
    errors.push("email contains only invalid characters");
  } else if (!isValidEmail(email)) {
    errors.push("email format is invalid");
  }

  // ЖЁСТКАЯ проверка роли
  if (role.length === 0) {
    errors.push("role is required and cannot be empty");
  } else if (isEffectivelyEmpty(role)) {
    errors.push("role contains only invalid characters");
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

  // КРИТИЧЕСКАЯ ПРОВЕРКА: блокируем пустые данные ДО всех преобразований
  // Проверяем сырые данные сразу после парсинга
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const raw = rawData as Record<string, unknown>;
    const rawName = String(raw.name || "").trim();
    const rawEmail = String(raw.email || "").trim();
    const rawRole = String(raw.role || "").trim();
    
    // Блокируем если данные явно пустые или содержат только спецсимволы
    if (rawName.length === 0 || 
        rawName.length < 2 ||
        isEffectivelyEmpty(rawName) ||
        rawEmail.length === 0 ||
        rawEmail.length < 5 ||
        isEffectivelyEmpty(rawEmail) ||
        !isValidEmail(rawEmail) ||
        rawRole.length === 0 ||
        isEffectivelyEmpty(rawRole) ||
        !ALLOWED_ROLES.includes(rawRole)) {
      console.error(`[Feedback:${requestId}] BLOCKED: Raw data validation failed (before normalization)`, {
        rawName,
        rawEmail,
        rawRole,
        rawNameLength: rawName.length,
        rawEmailLength: rawEmail.length,
        rawRoleLength: rawRole.length,
        ip: clientIp,
        userAgent: userAgent.slice(0, 100),
      });
      return NextResponse.json(
        { error: "Invalid form data - empty or invalid values detected" },
        { status: 400 }
      );
    }
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
  // ВАЖНО: гарантируем, что все обязательные поля точно заполнены (не undefined, не null, не пустые)
  const webhookName = payload.name.trim();
  const webhookEmail = payload.email.trim().toLowerCase();
  const webhookRole = payload.role.trim();
  
  // ФИНАЛЬНАЯ проверка перед формированием webhookPayload
  if (!webhookName || webhookName.length < 2) {
    console.error(`[Feedback:${requestId}] BLOCKED: name is invalid before webhook`, {
      name: webhookName,
      nameLength: webhookName?.length || 0,
    });
    return NextResponse.json(
      { error: "Invalid name" },
      { status: 400 }
    );
  }
  
  if (!webhookEmail || webhookEmail.length < 5 || !isValidEmail(webhookEmail)) {
    console.error(`[Feedback:${requestId}] BLOCKED: email is invalid before webhook`, {
      email: webhookEmail,
      emailLength: webhookEmail?.length || 0,
    });
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }
  
  if (!webhookRole || webhookRole.length === 0 || !ALLOWED_ROLES.includes(webhookRole)) {
    console.error(`[Feedback:${requestId}] BLOCKED: role is invalid before webhook`, {
      role: webhookRole,
      roleLength: webhookRole?.length || 0,
    });
    return NextResponse.json(
      { error: "Invalid role" },
      { status: 400 }
    );
  }

  const webhookPayload = {
    type: "feedback_form",
    submittedAt,
    name: webhookName,
    email: webhookEmail,
    phone: payload.phone?.trim() || undefined,
    role: webhookRole,
    comment: payload.comment?.trim() || undefined,
    clientId: payload.clientId?.trim() || undefined,
    sessionId: payload.sessionId?.trim() || undefined,
    // Дублируем в body для совместимости с n8n условием
    body: {
      name: webhookName,
      email: webhookEmail,
      phone: payload.phone?.trim() || undefined,
      role: webhookRole,
      comment: payload.comment?.trim() || undefined,
    },
  };

  // КРИТИЧЕСКАЯ ПРОВЕРКА перед отправкой в webhook: блокируем пустые, дефисы, и невалидные значения
  const nameTrimmed = String(webhookPayload.name || "").trim();
  const emailTrimmed = String(webhookPayload.email || "").trim();
  const roleTrimmed = String(webhookPayload.role || "").trim();
  
  const isNameInvalid = 
    !webhookPayload.name || 
    nameTrimmed.length < 2 ||
    isEffectivelyEmpty(nameTrimmed);
    
  const isEmailInvalid = 
    !webhookPayload.email || 
    emailTrimmed.length < 5 ||
    isEffectivelyEmpty(emailTrimmed) ||
    !isValidEmail(emailTrimmed);
    
  const isRoleInvalid = 
    !webhookPayload.role || 
    roleTrimmed.length === 0 ||
    isEffectivelyEmpty(roleTrimmed) ||
    !ALLOWED_ROLES.includes(roleTrimmed);
  
  if (isNameInvalid || isEmailInvalid || isRoleInvalid) {
    console.error(`[Feedback:${requestId}] BLOCKED: Invalid/Empty data before webhook`, {
      name: webhookPayload.name,
      email: webhookPayload.email,
      role: webhookPayload.role,
      nameLength: webhookPayload.name?.length || 0,
      emailLength: webhookPayload.email?.length || 0,
      roleLength: webhookPayload.role?.length || 0,
      isNameInvalid,
      isEmailInvalid,
      isRoleInvalid,
      ip: clientIp,
      userAgent: userAgent.slice(0, 100),
    });
    return NextResponse.json(
      { error: "Invalid form data - cannot send empty or invalid data to webhook" },
      { status: 400 }
    );
  }
  
  // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: убеждаемся, что body объект тоже валиден
  if (!webhookPayload.body || 
      !webhookPayload.body.name || 
      webhookPayload.body.name.trim().length < 2 ||
      !webhookPayload.body.email || 
      webhookPayload.body.email.trim().length < 5 ||
      !isValidEmail(webhookPayload.body.email) ||
      !webhookPayload.body.role || 
      webhookPayload.body.role.trim().length === 0 ||
      !ALLOWED_ROLES.includes(webhookPayload.body.role)) {
    console.error(`[Feedback:${requestId}] BLOCKED: body object is invalid`, {
      body: webhookPayload.body,
      ip: clientIp,
    });
    return NextResponse.json(
      { error: "Invalid body data structure" },
      { status: 400 }
    );
  }

  // Логируем успешную валидацию
  console.log(`[Feedback:${requestId}] Validated payload (ready for webhook):`, {
    name: webhookPayload.name,
    email: webhookPayload.email,
    role: webhookPayload.role,
    hasPhone: !!webhookPayload.phone,
    hasComment: !!webhookPayload.comment,
    nameLength: webhookPayload.name.length,
    emailLength: webhookPayload.email.length,
    roleLength: webhookPayload.role.length,
    bodyName: webhookPayload.body.name,
    bodyEmail: webhookPayload.body.email,
    bodyRole: webhookPayload.body.role,
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
    // ПОСЛЕДНЯЯ ПРОВЕРКА: перед отправкой убеждаемся, что данные не пустые
    const preSendCheck = {
      name: String(webhookPayload.name || "").trim(),
      email: String(webhookPayload.email || "").trim(),
      role: String(webhookPayload.role || "").trim(),
      bodyName: String(webhookPayload.body?.name || "").trim(),
      bodyEmail: String(webhookPayload.body?.email || "").trim(),
      bodyRole: String(webhookPayload.body?.role || "").trim(),
    };
    
    if (preSendCheck.name.length < 2 || 
        preSendCheck.email.length < 5 || 
        !isValidEmail(preSendCheck.email) ||
        preSendCheck.role.length === 0 ||
        preSendCheck.bodyName.length < 2 ||
        preSendCheck.bodyEmail.length < 5 ||
        !isValidEmail(preSendCheck.bodyEmail) ||
        preSendCheck.bodyRole.length === 0) {
      console.error(`[Feedback:${requestId}] BLOCKED: Pre-send validation failed`, {
        preSendCheck,
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "Data validation failed before sending to webhook" },
        { status: 400 }
      );
    }

    // КРИТИЧЕСКАЯ ПРОВЕРКА: перед JSON.stringify убеждаемся, что данные не пустые
    // Это последний рубеж защиты - проверяем реальные значения, которые будут отправлены
    const finalName = String(webhookPayload.name || "").trim();
    const finalEmail = String(webhookPayload.email || "").trim();
    const finalRole = String(webhookPayload.role || "").trim();
    const finalBodyName = String(webhookPayload.body?.name || "").trim();
    const finalBodyEmail = String(webhookPayload.body?.email || "").trim();
    const finalBodyRole = String(webhookPayload.body?.role || "").trim();
    
    if (finalName.length < 2 || 
        finalEmail.length < 5 || 
        !isValidEmail(finalEmail) ||
        finalRole.length === 0 ||
        !ALLOWED_ROLES.includes(finalRole) ||
        finalBodyName.length < 2 ||
        finalBodyEmail.length < 5 ||
        !isValidEmail(finalBodyEmail) ||
        finalBodyRole.length === 0 ||
        !ALLOWED_ROLES.includes(finalBodyRole)) {
      console.error(`[Feedback:${requestId}] BLOCKED: Final validation before JSON.stringify failed`, {
        finalName,
        finalEmail,
        finalRole,
        finalBodyName,
        finalBodyEmail,
        finalBodyRole,
        nameLength: finalName.length,
        emailLength: finalEmail.length,
        roleLength: finalRole.length,
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "Data validation failed - cannot serialize invalid data" },
        { status: 400 }
      );
    }
    
    // Проверяем, что после JSON.stringify данные не потерялись
    const serializedPayload = JSON.stringify(webhookPayload);
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(serializedPayload);
    } catch (e) {
      console.error(`[Feedback:${requestId}] BLOCKED: Failed to parse serialized payload`, e);
      return NextResponse.json(
        { error: "Failed to serialize payload" },
        { status: 500 }
      );
    }
    
    // Проверяем распарсенные данные
    const parsedName = String(parsedPayload.name || "").trim();
    const parsedEmail = String(parsedPayload.email || "").trim();
    const parsedRole = String(parsedPayload.role || "").trim();
    const parsedBodyName = String(parsedPayload.body?.name || "").trim();
    const parsedBodyEmail = String(parsedPayload.body?.email || "").trim();
    const parsedBodyRole = String(parsedPayload.body?.role || "").trim();
    
    if (parsedName.length < 2 || 
        parsedEmail.length < 5 || 
        !isValidEmail(parsedEmail) ||
        parsedRole.length === 0 ||
        !ALLOWED_ROLES.includes(parsedRole) ||
        parsedBodyName.length < 2 ||
        parsedBodyEmail.length < 5 ||
        !isValidEmail(parsedBodyEmail) ||
        parsedBodyRole.length === 0 ||
        !ALLOWED_ROLES.includes(parsedBodyRole)) {
      console.error(`[Feedback:${requestId}] BLOCKED: Parsed payload validation failed`, {
        parsedName,
        parsedEmail,
        parsedRole,
        parsedBodyName,
        parsedBodyEmail,
        parsedBodyRole,
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "Serialized payload validation failed" },
        { status: 400 }
      );
    }

    // ПОСЛЕДНЯЯ КРИТИЧЕСКАЯ ПРОВЕРКА: перед fetch убеждаемся что данные реально не пустые
    // Проверяем что значения не состоят только из пробелов, дефисов и спецсимволов
    const actualName = finalName.replace(/[\s\-_\.\u200B-\u200D\uFEFF\u00A0]/g, '');
    const actualEmail = finalEmail.replace(/[\s\-_\.\u200B-\u200D\uFEFF\u00A0]/g, '');
    const actualBodyName = finalBodyName.replace(/[\s\-_\.\u200B-\u200D\uFEFF\u00A0]/g, '');
    const actualBodyEmail = finalBodyEmail.replace(/[\s\-_\.\u200B-\u200D\uFEFF\u00A0]/g, '');
    
    if (actualName.length < 2 || 
        actualEmail.length < 5 || 
        !isValidEmail(finalEmail) ||
        actualBodyName.length < 2 ||
        actualBodyEmail.length < 5 ||
        !isValidEmail(finalBodyEmail)) {
      console.error(`[Feedback:${requestId}] BLOCKED: Final character check failed before fetch`, {
        actualName,
        actualEmail,
        actualBodyName,
        actualBodyEmail,
        finalName,
        finalEmail,
        finalBodyName,
        finalBodyEmail,
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "Data contains only invalid characters" },
        { status: 400 }
      );
    }

    console.log(`[Feedback:${requestId}] Sending to webhook:`, {
      webhookUrl: webhookUrl.replace(/\/[^\/]*$/, '/***'),
      payloadSize: serializedPayload.length,
      name: finalName,
      email: finalEmail,
      role: finalRole,
      bodyName: finalBodyName,
      bodyEmail: finalBodyEmail,
      bodyRole: finalBodyRole,
      actualNameLength: actualName.length,
      actualEmailLength: actualEmail.length,
    });
    
    // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ: полный payload для диагностики пустых заявок
    console.log(`[Feedback:${requestId}] FULL WEBHOOK PAYLOAD (для диагностики):`, JSON.stringify(webhookPayload, null, 2));

    // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ: выводим полный payload для отладки
    console.log(`[Feedback:${requestId}] ===== FULL WEBHOOK PAYLOAD (что отправляется в n8n) =====`);
    console.log(`[Feedback:${requestId}]`, JSON.stringify(webhookPayload, null, 2));
    console.log(`[Feedback:${requestId}] ===== КОНЕЦ PAYLOAD =====`);
    console.log(`[Feedback:${requestId}] ВАЖНО: В n8n используйте один из путей для извлечения данных:`);
    console.log(`[Feedback:${requestId}]   - $json.name, $json.email, $json.role (верхний уровень)`);
    console.log(`[Feedback:${requestId}]   - $json.body.name, $json.body.email, $json.body.role (в объекте body)`);
    
    // ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА: проверяем, что данные не потерялись при сериализации
    const parsedCheck = JSON.parse(serializedPayload);
    console.log(`[Feedback:${requestId}] PAYLOAD AFTER JSON PARSE CHECK:`, {
      rootName: parsedCheck.name,
      rootEmail: parsedCheck.email,
      rootRole: parsedCheck.role,
      bodyName: parsedCheck.body?.name,
      bodyEmail: parsedCheck.body?.email,
      bodyRole: parsedCheck.body?.role,
      allKeys: Object.keys(parsedCheck),
      bodyKeys: parsedCheck.body ? Object.keys(parsedCheck.body) : [],
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: serializedPayload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Логируем ответ от webhook для диагностики
    const responseText = await response.text().catch(() => "");
    console.log(`[Feedback:${requestId}] Webhook response:`, {
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.slice(0, 1000),
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      console.error(`[Feedback:${requestId}] Webhook failed:`, {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.slice(0, 500),
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
