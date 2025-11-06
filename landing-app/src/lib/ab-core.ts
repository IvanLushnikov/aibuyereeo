import type { ExperimentDefinition } from "./ab-config";

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0; // uint32
}

/**
 * Детеминированно распределяет clientId по вариантам эксперимента с учетом весов
 */
export function assignVariantDeterministic(
  clientId: string,
  experiment: ExperimentDefinition
): string {
  const salt = experiment.salt ?? "";
  const variants = experiment.variants && experiment.variants.length > 0
    ? experiment.variants
    : [{ name: "control", weight: 1 }];

  const weights = variants.map((v) => (typeof v.weight === "number" && v.weight > 0 ? v.weight : 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const input = `${salt}|${experiment.id}|${clientId}`;
  const bucket = fnv1a(input) % totalWeight;

  let acc = 0;
  for (let index = 0; index < variants.length; index++) {
    acc += weights[index];
    if (bucket < acc) return variants[index].name;
  }
  return variants[0].name;
}


