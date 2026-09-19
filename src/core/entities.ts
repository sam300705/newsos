const CORPORATE_SUFFIXES = /\b(incorporated|inc|limited|ltd|llc|plc|corp|corporation|pvt|private)\b\.?/gi;

export function normalizeEntityName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(CORPORATE_SUFFIXES, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface ExtractedEntity {
  name: string;
  type: string;
  confidence: number;
  sourceId: string;
}

export interface EntityAggregate {
  canonicalName: string;
  type: string;
  aliases: string[];
  confidence: number;
  sourceIds: string[];
}

export function aggregateEntities(input: ExtractedEntity[]): EntityAggregate[] {
  const map = new Map<string, EntityAggregate>();
  for (const item of input) {
    if (item.confidence < 0 || item.confidence > 1) throw new Error("Entity confidence must be between 0 and 1");
    const canonicalName = normalizeEntityName(item.name);
    const key = `${item.type.toLowerCase()}:${canonicalName}`;
    const existing = map.get(key) ?? {
      canonicalName,
      type: item.type,
      aliases: [],
      confidence: 0,
      sourceIds: [],
    };
    if (!existing.aliases.includes(item.name)) existing.aliases.push(item.name);
    if (!existing.sourceIds.includes(item.sourceId)) existing.sourceIds.push(item.sourceId);
    existing.confidence = Math.max(existing.confidence, item.confidence);
    map.set(key, existing);
  }
  return [...map.values()];
}
