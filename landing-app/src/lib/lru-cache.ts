/**
 * Простой LRU (Least Recently Used) cache для ограничения размера хранилища
 * Автоматически удаляет самые старые записи при превышении лимита
 */

type CacheEntry<T> = {
  value: T;
  lastUsed: number;
};

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    
    // Обновляем время последнего использования (LRU)
    entry.lastUsed = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
    // Если ключ уже существует, обновляем значение
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastUsed = Date.now();
      return;
    }

    // Если достигнут лимит, удаляем самые старые записи
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      lastUsed: Date.now(),
    });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Удаляет самые старые записи (50% от лимита)
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    // Сортируем по времени последнего использования
    entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    
    // Удаляем 50% самых старых записей
    const toRemove = Math.ceil(this.maxSize * 0.5);
    for (let i = 0; i < toRemove && entries.length > 0; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  // Очищает записи старше указанного времени (в миллисекундах)
  cleanupOlderThan(maxAge: number): number {
    const now = Date.now();
    const keysToDelete: K[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastUsed > maxAge) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    return keysToDelete.length;
  }
}




