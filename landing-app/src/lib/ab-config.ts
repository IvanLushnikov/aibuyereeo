export type AbVariant = {
  name: string;
  weight?: number; // по умолчанию 1
};

export type ExperimentDefinition = {
  id: string;
  variants: AbVariant[];
  salt?: string; // дополнительная соль для стабильного хэширования
};

// Стартовая конфигурация экспериментов.
// Добавляйте новые элементы в этот массив.
export const experiments: ExperimentDefinition[] = [
  {
    id: "cta_text",
    variants: [
      { name: "control", weight: 1 },
      { name: "alt", weight: 1 },
    ],
  },
  {
    id: "features_to_form",
    variants: [
      { name: "features", weight: 1 }, // вариант A — как сейчас (список «Что умеет…»)
      { name: "form", weight: 1 },     // вариант B — вместо блока показываем форму
    ],
  },
];

export function getExperimentDefinition(experimentId: string): ExperimentDefinition | undefined {
  return experiments.find((exp) => exp.id === experimentId);
}


