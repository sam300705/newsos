export function sanitizeSearchQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[%_,()'"\\]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
