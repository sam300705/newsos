const MAX_JSON_LENGTH = 4000;
const MAX_DEPTH = 4;
const MAX_KEYS = 30;
const MAX_ARRAY_ITEMS = 30;
const MAX_STRING = 500;

function clean(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[depth-limit]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, MAX_STRING);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => clean(item, depth + 1));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      if (["function", "symbol", "undefined", "bigint"].includes(typeof item)) continue;
      result[key.slice(0, 100)] = clean(item, depth + 1);
    }
    return result;
  }
  return undefined;
}

export function sanitizeAnalyticsMetadata(value: unknown): Record<string, unknown> {
  const initial = value && typeof value === "object" && !Array.isArray(value) ? clean(value, 0) : {};
  const result = (initial && typeof initial === "object" && !Array.isArray(initial) ? initial : {}) as Record<string, unknown>;
  if (JSON.stringify(result).length <= MAX_JSON_LENGTH) return result;

  const bounded: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(result)) {
    bounded[key] = item;
    if (JSON.stringify(bounded).length > MAX_JSON_LENGTH) {
      delete bounded[key];
      break;
    }
  }
  return bounded;
}
