import { NextResponse } from "next/server";

const KTRU_API_URL = "http://ktru.services.persis.ru/api/Ktru/GetKtru";
const DEFAULT_PARAMS = {
  IncludeChars: "true",
  Limit: "15",
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

const FIELD_SEPARATOR = "   ";

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

function transformItems(items: KtruItem[]) {
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
        plain: formatPlain(transformedItem),
      };
    });
}

function formatPlain(item: TransformedItem) {
  const tokens: string[] = [];

  const pushToken = (value?: string | null) => {
    if (!value) return;
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized) {
      tokens.push(normalized);
    }
  };

  pushToken("code");
  pushToken(item.code);
  pushToken("name");
  pushToken(item.name);
  if (item.okpdName) {
    pushToken("okpdName");
    pushToken(item.okpdName);
  }

  const addGroup = (label: string, list: NormalizedCharacteristic[]) => {
    if (!list.length) return;
    pushToken(label);

    for (const characteristic of list) {
      pushToken("title");
      pushToken(characteristic.title);
      if (characteristic.values.length) {
        pushToken("values");
        for (const value of characteristic.values) {
          pushToken(value);
        }
      }
    }
  };

  if (item.characteristics.required.length || item.characteristics.optional.length) {
    pushToken("characteristics");
    addGroup("required", item.characteristics.required);
    addGroup("optional", item.characteristics.optional);
  }

  return tokens.join(FIELD_SEPARATOR);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      productName?: unknown;
      query?: unknown;
    };

    const rawName =
      typeof payload.productName === "string"
        ? payload.productName
        : typeof payload.query === "string"
          ? payload.query
          : "";
    const productName = rawName.trim();

    if (!productName) {
      return NextResponse.json(
        { error: "Поле productName обязательно и должно содержать название товара." },
        { status: 400 },
      );
    }

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

    return NextResponse.json({ items: transformed });
  } catch (error) {
    console.error("[ktru-lookup] error", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка при обработке запроса." },
      { status: 500 },
    );
  }
}

