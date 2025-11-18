import { NextResponse } from "next/server";

const KTRU_API_URL = "http://ktru.services.persis.ru/api/Ktru/GetKtru";
const DEFAULT_PARAMS = {
  IncludeChars: "true",
  Limit: "10",
  Page: "1",
  WithActualKtrusOnly: "true",
};

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

const FIELD_SEPARATOR = "   ";
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
    return `${min}–${max}`;
  }
  if (min !== undefined && min !== null) {
    return `≥ ${min}`;
  }
  if (max !== undefined && max !== null) {
    return `≤ ${max}`;
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
  const sections: string[] = [];

  const headerParts = [item.code, item.name];
  if (item.okpdName) {
    headerParts.push(item.okpdName);
  }
  sections.push(headerParts.join(FIELD_SEPARATOR));

  const formatGroup = (label: string, list: NormalizedCharacteristic[]) => {
    if (!list.length) return null;
    const entries = list.map((characteristic) => {
      const values = characteristic.values.join(", ");
      return `${characteristic.title} = ${values}`;
    });
    return `${label}: ${entries.join(" | ")}`;
  };

  const requiredGroup = formatGroup("обязательные", item.characteristics.required);
  if (requiredGroup) {
    sections.push(requiredGroup);
  }

  if (options.includeOptional) {
    const optionalGroup = formatGroup("необязательные", item.characteristics.optional);
    if (optionalGroup) {
      sections.push(optionalGroup);
    }
  }

  return sections.join(" || ");
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

    const rawName =
      typeof payload.productName === "string"
        ? payload.productName
        : typeof payload.query === "string"
          ? payload.query
          : "";
    const productName = rawName.trim();
    const tokens = tokenize(productName);

    if (!productName) {
      return NextResponse.json(
        { error: "Поле productName обязательно и должно содержать название товара." },
        { status: 400 },
      );
    }

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
    const items = Array.isArray(data) ? (data as KtruItem[]) : [];
    const transformed = transformItems(items);
    const filtered =
      tokens.length === 0
        ? transformed
        : transformed.filter(
            (item) => matchesTokens(item.name, tokens) || matchesTokens(item.okpdName, tokens),
          );
    const itemsToReturn = filtered.length ? filtered : transformed;

    if (shape === "plain") {
      return NextResponse.json({ items: itemsToReturn.map((item) => item.plain) });
    }

    if (shape === "optional") {
      const codeParam =
        typeof payload.code === "string"
          ? payload.code.trim()
          : url.searchParams.get("code")?.trim() ?? "";

      if (!codeParam) {
        return NextResponse.json(
          { error: "Для shape=optional требуется параметр code." },
          { status: 400 },
        );
      }

      const targetItem =
        itemsToReturn.find((item) => item.code === codeParam) ??
        transformed.find((item) => item.code === codeParam);

      if (!targetItem) {
        return NextResponse.json(
          { error: "Код КТРУ не найден для текущего запроса." },
          { status: 404 },
        );
      }

      const total = targetItem.characteristics.optional.length;
      const start = Math.min(startIndex, total);
      const end = Math.min(start + OPTIONAL_CHUNK_SIZE, total);
      const chunk = targetItem.characteristics.optional.slice(start, end);

      return NextResponse.json({
        code: targetItem.code,
        name: targetItem.name,
        okpdName: targetItem.okpdName,
        chunk: {
          start,
          end,
          size: OPTIONAL_CHUNK_SIZE,
          total,
          hasMore: end < total,
          nextStart: end < total ? end : null,
          items: chunk,
        },
      });
    }

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

