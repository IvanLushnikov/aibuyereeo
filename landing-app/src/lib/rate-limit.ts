import { LRUCache } from "./lru-cache";

type RateLimitState = {
  count: number;
  windowStart: number;
};

/**
 * Универсальный rate limiter с LRU cache
 */
export class RateLimiter {
  private store: LRUCache<string, RateLimitState>;
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowMs: number, maxStoreSize: number = 10000) {
    this.store = new LRUCache(maxStoreSize);
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Проверяет, превышен ли лимит для указанного ключа
   * @returns true если лимит превышен, false если запрос разрешен
   */
  isLimited(key: string): boolean {
    const now = Date.now();
    const state = this.store.get(key);

    if (!state || now - state.windowStart > this.windowMs) {
      // Новое окно - сбрасываем счетчик
      this.store.set(key, { count: 1, windowStart: now });
      return false;
    }

    if (state.count >= this.maxRequests) {
      return true;
    }

    // Увеличиваем счетчик и обновляем запись
    state.count += 1;
    this.store.set(key, state);
    return false;
  }

  /**
   * Очищает записи старше окна времени
   */
  cleanup(): number {
    return this.store.cleanupOlderThan(this.windowMs);
  }

  /**
   * Получает текущее количество запросов для ключа
   */
  getCount(key: string): number {
    const state = this.store.get(key);
    if (!state) return 0;
    const now = Date.now();
    if (now - state.windowStart > this.windowMs) {
      return 0; // Окно истекло
    }
    return state.count;
  }
}


