export const SOURCE_TYPES = [
  "PRIMARY",
  "REGULATOR",
  "MAINSTREAM_NEWS",
  "TRADE_PUBLICATION",
  "COMPANY_BLOG",
  "PRESS_RELEASE",
  "COMMUNITY",
  "UNKNOWN",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

const SOURCE_TYPE_SET = new Set<string>(SOURCE_TYPES);

export function validateSourceType(value: string): SourceType {
  if (!SOURCE_TYPE_SET.has(value)) throw new Error("Invalid source type");
  return value as SourceType;
}
