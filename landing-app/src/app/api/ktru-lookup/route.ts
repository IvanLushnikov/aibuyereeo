import { NextResponse } from "next/server";

const KTRU_API_URL = "http://ktru.services.persis.ru/api/Ktru/GetKtru";
const DEFAULT_PARAMS = {
  IncludeChars: "true",
  Limit: "20", // Увеличили до 20 по просьбе пользователя
  Page: "1",
  WithActualKtrusOnly: "true",
};

// In-memory кэш для результатов поиска КТРУ
type CacheEntry = {
  data: KtruItem[];
  timestamp: number;
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
const MAX_CACHE_SIZE = 1000; // Максимум 1000 записей в кэше
const cache = new Map<string, CacheEntry>();

// Очистка старых записей из кэша
function cleanupCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
  
  // Если кэш все еще слишком большой, удаляем самые старые записи
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = cache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove && entries.length > 0; i++) {
      cache.delete(entries[i][0]);
    }
  }
}

type KtruValue = {
  текстовоеОписание?: string | null;
  минимальноеЗначение?: number | null;
  максимальноеЗначение?: number | null;
};

type KtruCharacteristic = {
  наименование: string;
  тип: number;
  значения?: KtruValue[];
  обязательнаКПрименению?: boolean;
};

type KtruStandard = {
  названиеДокумента: string;
};

type NormalizedCharacteristic = {
  title: string;
  values: string[];
};

type KtruItem = {
  код: string;
  наименование: string;
  наименованиеОКПД?: string;
  характеристики?: KtruCharacteristic[];
  стандарты?: KtruStandard[];
  актуален?: boolean;
  являетсяШаблоном?: boolean;
};

type TransformedItem = {
  code: string;
  name: string;
  okpdName: string | null;
  characteristics: {
    required: NormalizedCharacteristic[];
    optional: NormalizedCharacteristic[];
  };
};

type ItemWithPlain = TransformedItem & {
  plain: string;
};

const OPTIONAL_KEY_PREFIX = "o";
const OPTIONAL_CHUNK_SIZE = 5;

function buildQuery(productName: string) {
  const params = new URLSearchParams({ ProductName: productName, ...DEFAULT_PARAMS });
  return `${KTRU_API_URL}?${params.toString()}`;
}

function formatValue(value?: KtruValue | null) {
  if (!value) return null;
  if (value.текстовоеОписание) {
    return value.текстовоеОписание.trim();
  }

  const min = value.минимальноеЗначение;
  const max = value.максимальноеЗначение;

  if (min !== undefined && min !== null && max !== undefined && max !== null) {
    return `${min}-${max}`; // Заменили тире на дефис для экономии
  }
  if (min !== undefined && min !== null) {
    return `>${min}`; // Заменили "≥ " на ">" для краткости
  }
  if (max !== undefined && max !== null) {
    return `<${max}`; // Заменили "≤ " на "<" для краткости
  }
  return null;
}

function normalizeCharacteristic(characteristic: KtruCharacteristic) {
  const values = (characteristic.значения ?? [])
    .map((value) => formatValue(value))
    .filter((value): value is string => Boolean(value));

  if (!values.length) {
    return null;
  }

  return {
    title: characteristic.наименование,
    values,
  };
}

function transformItems(items: KtruItem[]): ItemWithPlain[] {
  return items
    .filter((item) => item?.актуален && item?.являетсяШаблоном !== true)
    .map((item) => {
      const required: Array<{ title: string; values: string[] }> = [];
      const optional: Array<{ title: string; values: string[] }> = [];

      for (const characteristic of item.характеристики ?? []) {
        const normalized = normalizeCharacteristic(characteristic);
        if (!normalized) continue;

        if (characteristic.обязательнаКПрименению) {
          required.push(normalized);
        } else {
          optional.push(normalized);
        }
      }

      const transformedItem: TransformedItem = {
        code: item.код,
        name: item.наименование,
        okpdName: item.наименованиеОКПД ?? null,
        characteristics: {
          required,
          optional,
        },
      };

      return {
        ...transformedItem,
        plain: formatPlain(transformedItem, { includeOptional: false }),
      };
    });
}

function formatPlain(
  item: TransformedItem,
  options: { includeOptional?: boolean } = {},
) {
  // ULTRA-LIGHT FORMAT: "CODE | Param1: Val1, Val2 | Param2: Val3"
  const parts: string[] = [item.code];

  // Добавляем имя, но обрезаем если слишком длинное
  // const shortName = item.name.length > 30 ? item.name.substring(0, 30) + "..." : item.name;
  // parts.push(shortName); 
  // Решили вообще убрать имя, так как оно часто дублирует запрос. Оставим только если характеристик нет.

  const requiredList = item.characteristics.required;
  
  if (requiredList.length > 0) {
     const params = requiredList.map(c => {
        // Упрощаем названия характеристик (можно добавить маппинг, но пока просто берем как есть)
        // Например "Размер диагонали экрана" -> "Диагональ" (сложно автоматизировать без словаря)
        return `${c.title}: ${c.values.join(",")}`;
     }).join(" | ");
     parts.push(params);
  } else {
     // Если нет обязательных характеристик, тогда добавляем имя, чтобы хоть что-то было понятно
     parts.push(item.name);
  }

  return parts.join(" | ");
}

function compressOptionalCharacteristics(items: ItemWithPlain[]) {
  const valueToKey = new Map<string, string>();
  const dictionary: Record<string, string> = {};
  let counter = 1;

  const assignKey = (value: string) => {
    if (valueToKey.has(value)) {
      return valueToKey.get(value)!;
    }
    const key = `${OPTIONAL_KEY_PREFIX}${counter++}`;
    valueToKey.set(value, key);
    dictionary[key] = value;
    return key;
  };

  const compressedItems = items.map((item) => ({
    ...item,
    characteristics: {
      required: item.characteristics.required,
      optional: item.characteristics.optional.map((characteristic) => ({
        title: characteristic.title,
        values: characteristic.values.map((value) => assignKey(value)),
      })),
    },
  }));

  return { compressedItems, dictionary };
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesTokens(text: string | null, tokens: string[]) {
  if (!text) return false;
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      productName?: unknown;
      query?: unknown;
      shape?: unknown;
      code?: unknown;
      start?: unknown;
      offset?: unknown;
    };

    const code = typeof payload.code === "string" ? payload.code.trim() : "";
    
    const rawName =
      typeof payload.productName === "string"
        ? payload.productName
        : typeof payload.query === "string"
          ? payload.query
          : "";
          
    let productName = rawName.trim();

    // Если имя не передано, но передан код — ищем по коду
    if (!productName && code) {
      productName = code;
    }

    if (!productName) {
      return NextResponse.json(
        { error: "Поле productName или code обязательно." },
        { status: 400 },
      );
    }

    const tokens = tokenize(productName);

    const url = new URL(request.url);
    const shapeParam = url.searchParams.get("shape");
    const bodyShape = typeof payload.shape === "string" ? payload.shape : undefined;
    const shape = (bodyShape ?? shapeParam ?? "").toLowerCase();
    const startParam =
      coerceNumber(payload.start) ??
      coerceNumber(payload.offset) ??
      coerceNumber(url.searchParams.get("start")) ??
      coerceNumber(url.searchParams.get("offset")) ??
      0;
    const startIndex = Math.max(0, Math.floor(startParam));

    // Проверяем кэш перед запросом к API
    const cacheKey = `lookup:${productName.toLowerCase().trim()}`;
    cleanupCache(); // Периодическая очистка старых записей
    const cached = cache.get(cacheKey);
    let items: KtruItem[];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Используем кэшированные данные
      items = cached.data;
      console.log(`[ktru-lookup] Использован кэш для: ${productName}`);
    } else {
      // Делаем запрос к API
      const response = await fetch(buildQuery(productName), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return NextResponse.json(
          {
            error: "Не удалось получить данные КТРУ",
            status: response.status,
            detail: errorText || undefined,
          },
          { status: 502 },
        );
      }

      const data = (await response.json()) as unknown;
      items = Array.isArray(data) ? (data as KtruItem[]) : [];
      
      // Сохраняем в кэш
      cache.set(cacheKey, { data: items, timestamp: Date.now() });
      console.log(`[ktru-lookup] Данные закэшированы для: ${productName}`);
    }
    const transformed = transformItems(items);
    const filtered =
      tokens.length === 0
        ? transformed
        : transformed.filter(
            (item) => matchesTokens(item.name, tokens) || matchesTokens(item.okpdName, tokens),
          );
    const itemsToReturn = filtered.length ? filtered : transformed;

    // 1. Plain format (summary for search)
    if (shape === "plain") {
      return NextResponse.json({ items: itemsToReturn.map((item) => item.plain) });
    }

    // 2. Full/Details format (specific item with full details)
    if (shape === "full") {
      // Если передан code, ищем конкретно его, иначе берем первый релевантный
      const targetItem = code 
        ? (itemsToReturn.find(i => i.code === code) || transformed.find(i => i.code === code))
        : itemsToReturn[0];

      if (!targetItem) {
        return NextResponse.json(
          { error: "Код КТРУ не найден." },
          { status: 404 }
        );
      }

      // Отдаем чистый JSON без сжатия, но ограничиваем список характеристик (макс 10)
      const limitedOptional = targetItem.characteristics.optional.slice(0, 10);

      return NextResponse.json({
        code: targetItem.code,
        name: targetItem.name,
        okpdName: targetItem.okpdName,
        mandatory_characteristics: targetItem.characteristics.required,
        optional_characteristics: limitedOptional,
      });
    }

    // 3. Chunked optional (legacy)
    if (shape === "optional") {
      // ... старый код для совместимости ...
      const codeParam = code || url.searchParams.get("code")?.trim() || "";
       if (!codeParam) return NextResponse.json({ error: "code required" }, { status: 400 });
       
       const targetItem = itemsToReturn.find(i => i.code === codeParam) || transformed.find(i => i.code === codeParam);
       if (!targetItem) return NextResponse.json({ error: "not found" }, { status: 404 });

      const total = targetItem.characteristics.optional.length;
      const start = Math.min(startIndex, total);
      const end = Math.min(start + OPTIONAL_CHUNK_SIZE, total);
      const chunk = targetItem.characteristics.optional.slice(start, end);

      return NextResponse.json({
        code: targetItem.code,
        chunk: {
            items: chunk,
            hasMore: end < total
        }
      });
    }

    // 4. Default (compressed list)
    const { compressedItems, dictionary } = compressOptionalCharacteristics(itemsToReturn);

    return NextResponse.json({
      items: compressedItems,
      optionalDictionary: dictionary,
    });
  } catch (error) {
    console.error("[ktru-lookup] error", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка при обработке запроса." },
      { status: 500 },
    );
  }
}
