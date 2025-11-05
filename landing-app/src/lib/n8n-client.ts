/**
 * Клиент для работы с n8n webhook
 * Включает: retry логику, circuit breaker, валидацию
 */

type N8NPayload = {
  clientId: string;
  message: string;
  history: Array<{ role: "user" | "agent"; content: string }>;
  meta?: Record<string, unknown>;
  receivedAt: string;
  requestId?: string;
};

type N8NResponse = {
  reply?: string;
  answer?: string;
  text?: string;
  message?: string;
};

type CircuitBreakerState = 'closed' | 'open' | 'half-open';

// Глобальный экземпляр circuit breaker (singleton) для всех запросов
let globalCircuitBreaker: CircuitBreaker | null = null;

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = 'closed';
  
  private readonly FAILURE_THRESHOLD = 5;
  private readonly TIMEOUT = 60000; // 1 минута
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.TIMEOUT) {
        this.state = 'half-open';
        console.log('[CircuitBreaker] Переход в half-open состояние');
      } else {
        throw new Error('Circuit breaker is open - n8n недоступен');
      }
    }
    
    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        console.log('[CircuitBreaker] Переход в closed состояние - n8n восстановлен');
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.FAILURE_THRESHOLD) {
        this.state = 'open';
        console.error(`[CircuitBreaker] Переход в open состояние после ${this.failures} ошибок`);
      }
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

export class N8NClient {
  private circuitBreaker: CircuitBreaker;
  private webhookUrl: string;
  private secret?: string;
  private timeoutMs: number;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 1000; // 1 секунда
  private readonly MAX_PAYLOAD_SIZE = 50 * 1024; // 50KB

  constructor(webhookUrl: string, secret?: string, timeoutMs: number = 25000) {
    this.webhookUrl = webhookUrl;
    this.secret = secret;
    this.timeoutMs = Math.max(5000, Math.min(60000, timeoutMs)); // Валидация timeout
    
    // Используем глобальный circuit breaker (singleton) для всех запросов
    if (!globalCircuitBreaker) {
      globalCircuitBreaker = new CircuitBreaker();
    }
    this.circuitBreaker = globalCircuitBreaker;
  }
  
  // Статический метод для сброса circuit breaker (для тестирования)
  static resetCircuitBreaker(): void {
    if (globalCircuitBreaker) {
      globalCircuitBreaker.reset();
    }
  }

  /**
   * Валидация размера payload
   */
  private validatePayloadSize(payload: N8NPayload): void {
    const payloadSize = new Blob([JSON.stringify(payload)]).size;
    
    if (payloadSize > this.MAX_PAYLOAD_SIZE) {
      // Пытаемся обрезать history
      const trimmedPayload = {
        ...payload,
        history: payload.history.slice(-5), // Оставляем последние 5 сообщений
      };
      
      const newSize = new Blob([JSON.stringify(trimmedPayload)]).size;
      if (newSize > this.MAX_PAYLOAD_SIZE) {
        throw new Error(`Payload too large: ${payloadSize} bytes (max ${this.MAX_PAYLOAD_SIZE})`);
      }
      
      // Заменяем payload на обрезанный
      Object.assign(payload, trimmedPayload);
      console.warn(`[N8NClient] Payload обрезан с ${payloadSize} до ${newSize} bytes`);
    }
  }

  /**
   * Отправка запроса с retry логикой
   */
  private async fetchWithRetry(
    payload: N8NPayload,
    controller: AbortController
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const fetchStartTime = Date.now();
        
        const response = await fetch(this.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.secret ? { "x-n8n-secret": this.secret } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const fetchTime = Date.now() - fetchStartTime;
        
        // Логируем метрики
        console.log(`[N8NClient] Запрос к n8n (попытка ${attempt + 1}/${this.MAX_RETRIES + 1}):`, {
          status: response.status,
          latency: `${fetchTime}ms`,
          requestId: payload.requestId,
        });

        // Для 5xx ошибок делаем retry (кроме последней попытки)
        if (response.status >= 500 && attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * (attempt + 1);
          console.warn(`[N8NClient] Повторная попытка через ${delay}ms (статус ${response.status})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Для 4xx ошибок не делаем retry
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // AbortError не ретраим
        if (lastError.name === 'AbortError' || controller.signal.aborted) {
          throw lastError;
        }

        // Для остальных ошибок делаем retry (кроме последней попытки)
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * (attempt + 1);
          console.warn(`[N8NClient] Повторная попытка через ${delay}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Unknown error');
  }

  /**
   * Отправка сообщения в n8n
   */
  async sendMessage(payload: N8NPayload): Promise<{ reply: string; status: "ok" | "error" }> {
    // Генерируем requestId если не передан
    if (!payload.requestId) {
      payload.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Валидация размера payload
    this.validatePayloadSize(payload);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.circuitBreaker.execute(() => 
        this.fetchWithRetry(payload, controller)
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage = `Ошибка n8n (статус ${response.status})`;
        
        try {
          const errorData = JSON.parse(errorBody);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Используем дефолтное сообщение
        }

        // Для 404 добавляем информацию о том, что workflow может быть неактивен
        if (response.status === 404) {
          errorMessage = `404: ${errorMessage}. Возможно, workflow не активирован в n8n.`;
        } else if (response.status === 500) {
          errorMessage = `500: ${errorMessage}. Проверьте настройки workflow в n8n.`;
        }

        console.error(`[N8NClient] Ошибка от n8n (статус ${response.status}):`, {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody.slice(0, 500),
          errorMessage,
        });

        throw new Error(errorMessage);
      }

      // Парсим ответ
      const responseText = await response.text();
      
      // Детальное логирование для отладки
      console.log("[N8NClient] Ответ от n8n (первые 500 символов):", responseText.slice(0, 500));
      console.log("[N8NClient] Длина ответа:", responseText.length);
      console.log("[N8NClient] Content-Type:", response.headers.get("content-type"));
      
      let data: N8NResponse;
      
      try {
        data = JSON.parse(responseText);
        console.log("[N8NClient] Распарсенный JSON:", JSON.stringify(data).slice(0, 500));
      } catch (parseError) {
        console.error("[N8NClient] Ошибка парсинга ответа от n8n:", parseError);
        console.error("[N8NClient] Сырой ответ:", responseText.slice(0, 500));
        throw new Error("n8n вернул не-JSON ответ");
      }

      // Извлекаем reply из разных возможных полей
      // n8n может возвращать ответ в разных форматах:
      // 1. { reply: "..." } - напрямую
      // 2. [{ reply: "..." }] - массив (если n8n возвращает массив)
      // 3. { output: { reply: "..." } } - в обертке
      // 4. { data: { reply: "..." } } - в обертке
      // 5. Просто строка (если n8n настроен неправильно)
      let rawReply: string | null = null;
      
      // Если пришел массив, берем первый элемент
      if (Array.isArray(data)) {
        console.log("[N8NClient] Ответ от n8n - массив, берем первый элемент");
        if (data.length > 0 && data[0] && typeof data[0] === "object") {
          data = data[0] as N8NResponse;
        } else {
          throw new Error("n8n вернул пустой массив");
        }
      }
      
      if (typeof data === "string") {
        // Если n8n вернул просто строку
        rawReply = data;
      } else if (data && typeof data === "object") {
        // Проверяем разные варианты структуры
        rawReply = data.reply || data.answer || data.text || data.message || null;
        
        // Если не нашли в корне, проверяем вложенные объекты
        if (!rawReply) {
          const output = (data as any).output || (data as any).data || (data as any).body;
          if (output && typeof output === "object") {
            // Если output тоже массив, берем первый элемент
            if (Array.isArray(output) && output.length > 0) {
              rawReply = output[0].reply || output[0].answer || output[0].text || output[0].message || null;
            } else if (output && typeof output === "object") {
              rawReply = output.reply || output.answer || output.text || output.message || null;
            }
          }
        }
      }
      
      console.log("[N8NClient] Извлеченный reply:", rawReply ? rawReply.slice(0, 200) : "null");

      // Проверяем, что ответ валиден
      if (!rawReply || typeof rawReply !== "string") {
        console.error("[N8NClient] Не удалось извлечь reply из ответа n8n:");
        console.error("[N8NClient] Структура данных:", JSON.stringify(data, null, 2).slice(0, 1000));
        console.error("[N8NClient] Доступные ключи:", Object.keys(data || {}));
        throw new Error(`n8n вернул пустой или невалидный ответ. Структура: ${JSON.stringify(data).slice(0, 200)}`);
      }

      // Проверяем, что это не необработанный шаблон n8n
      if (rawReply.includes("{{") && rawReply.includes("}}")) {
        throw new Error("n8n вернул необработанный шаблон (проверьте настройки 'Respond to Webhook')");
      }

      if (rawReply.trim().length === 0) {
        throw new Error("n8n вернул пустой ответ");
      }

      return {
        reply: rawReply,
        status: "ok",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Проверяем состояние circuit breaker
      if (this.circuitBreaker.getState() === 'open') {
        throw new Error("n8n временно недоступен (circuit breaker открыт)");
      }

      throw error;
    }
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

