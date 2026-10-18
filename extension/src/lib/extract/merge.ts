import type { DraftValues } from "../draft";
import type { FieldSource, Layer } from "./types";

type Key = keyof DraftValues;

const SALARY_KEYS = ["salaryMin", "salaryMax", "currency", "salaryPeriod"] as const satisfies Key[];
const isSalaryKey = (key: Key): boolean => (SALARY_KEYS as readonly Key[]).includes(key);

export type Merged = {
  values: Partial<DraftValues>;
  guessed: Key[];
  sources: Partial<Record<Key, FieldSource>>;
};

/**
 * Combines layers, most trusted first: each field takes the first non-empty
 * value. The salary fields move as a group (from the first layer with an
 * amount), so a minimum from one source never pairs with another's period.
 */
export function mergeLayers(layers: Layer[]): Merged {
  const values: Partial<Record<Key, unknown>> = {};
  const guessed = new Set<Key>();
  const sources: Partial<Record<Key, FieldSource>> = {};
  const take = (layer: Layer, key: Key) => {
    values[key] = layer.values[key];
    sources[key] = layer.source;
    if (layer.guessed?.includes(key)) guessed.add(key);
  };

  for (const layer of layers) {
    for (const key of Object.keys(layer.values) as Key[]) {
      const value = layer.values[key];
      if (isSalaryKey(key) || typeof value !== "string" || !value.trim() || key in values) continue;
      take(layer, key);
    }
  }
  const salaryLayer = layers.find((layer) => layer.values.salaryMin || layer.values.salaryMax);
  if (salaryLayer) for (const key of SALARY_KEYS) if (salaryLayer.values[key]) take(salaryLayer, key);

  return { values: values as Partial<DraftValues>, guessed: [...guessed], sources };
}
