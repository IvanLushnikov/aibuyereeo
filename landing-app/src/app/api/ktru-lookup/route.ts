import { NextResponse } from "next/server";

const KTRU_API_URL = "http://ktru.services.persis.ru/api/Ktru/GetKtru";
const DEFAULT_PARAMS = {
  IncludeChars: "true",
  Limit: "20",
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

type KtruItem = {
  код: string;
  наименование: string;
  наименованиеОКПД?: string;
  характеристики?: KtruCharacteristic[];
  стандарты?: KtruStandard[];
  актуален?: boolean;
  являетсяШаблоном?: boolean;
};

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
    type: characteristic.тип === 1 ? "количественная" : "качественная",
    values,
    isRequired: characteristic.обязательнаКПрименению === true,
  };
}

function transformItems(items: KtruItem[]) {
  return items
    .filter((item) => item?.актуален && item?.являетсяШаблоном !== true)
    .map((item) => {
      const required: Array<{ title: string; type: string; values: string[] }> = [];
      const optional: Array<{ title: string; type: string; values: string[] }> = [];

      for (const characteristic of item.характеристики ?? []) {
        const normalized = normalizeCharacteristic(characteristic);
        if (!normalized) continue;

        if (normalized.isRequired) {
          required.push(normalized);
        } else {
          optional.push(normalized);
        }
      }

      return {
        code: item.код,
        name: item.наименование,
        okpdName: item.наименованиеОКПД ?? null,
        link: `https://zakupki44fz.ru/app/okpd2/${item.код}`,
        characteristics: {
          required,
          optional,
        },
        standards: (item.стандарты ?? []).map((standard) => standard.названиеДокумента),
      };
    });
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

