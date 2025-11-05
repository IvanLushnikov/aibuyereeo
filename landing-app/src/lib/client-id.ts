import { v4 as uuid } from "uuid";

const CLIENT_ID_KEY = "ktro_agent_id";
const CLIENT_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 дней

/**
 * Получает или создает clientId с безопасной обработкой localStorage
 * Использует fallback на cookie или memory storage если localStorage недоступен
 */
export function ensureClientId(): string {
  if (typeof window === "undefined") {
    // SSR - возвращаем временный ID
    return uuid();
  }

  // Пытаемся получить из localStorage
  try {
    const stored = window.localStorage.getItem(CLIENT_ID_KEY);
    if (stored && stored.trim()) {
      return stored;
    }
  } catch (error) {
    // localStorage недоступен (private mode, etc.)
    console.warn("[ClientId] localStorage недоступен, используем cookie fallback:", error);
    
    // Пытаемся получить из cookie
    const cookieValue = getCookie(CLIENT_ID_KEY);
    if (cookieValue && cookieValue.trim()) {
      return cookieValue;
    }
  }

  // Генерируем новый ID
  const generated = uuid();
  
  if (!generated || !generated.trim()) {
    // Fallback если uuid не сработал
    const fallback = `client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    setClientIdFallback(fallback);
    return fallback;
  }

  // Сохраняем в localStorage и cookie
  try {
    window.localStorage.setItem(CLIENT_ID_KEY, generated);
  } catch (error) {
    console.warn("[ClientId] Не удалось сохранить в localStorage:", error);
  }
  
  setCookie(CLIENT_ID_KEY, generated, CLIENT_ID_COOKIE_MAX_AGE);
  return generated;
}

/**
 * Устанавливает clientId в cookie
 */
function setCookie(name: string, value: string, maxAge: number): void {
  try {
    document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn("[ClientId] Не удалось установить cookie:", error);
  }
}

/**
 * Получает значение cookie
 */
function getCookie(name: string): string | null {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
  } catch (error) {
    console.warn("[ClientId] Не удалось прочитать cookie:", error);
  }
  return null;
}

/**
 * Fallback: сохраняет в memory storage (только для текущей сессии)
 */
const memoryStorage = new Map<string, string>();

function setClientIdFallback(value: string): void {
  memoryStorage.set(CLIENT_ID_KEY, value);
  setCookie(CLIENT_ID_KEY, value, CLIENT_ID_COOKIE_MAX_AGE);
}

/**
 * Получает clientId из memory storage (fallback)
 */
function getClientIdFallback(): string | null {
  return memoryStorage.get(CLIENT_ID_KEY) || null;
}

/**
 * Получает clientId с безопасным fallback для всех случаев
 * Используется в компонентах для гарантированного получения ID
 */
export function getClientId(): string {
  if (typeof window === "undefined") {
    // SSR - возвращаем временный ID
    return uuid();
  }

  // Пытаемся получить из localStorage
  try {
    const stored = window.localStorage.getItem(CLIENT_ID_KEY);
    if (stored && stored.trim()) {
      return stored;
    }
  } catch (error) {
    // localStorage недоступен - продолжаем с fallback
  }

  // Пытаемся получить из cookie
  const cookieValue = getCookie(CLIENT_ID_KEY);
  if (cookieValue && cookieValue.trim()) {
    return cookieValue;
  }

  // Пытаемся получить из memory storage
  const memoryValue = getClientIdFallback();
  if (memoryValue && memoryValue.trim()) {
    return memoryValue;
  }

  // Генерируем новый ID
  return ensureClientId();
}

