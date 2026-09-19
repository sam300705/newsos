const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSubscriptionInput(input: unknown): { email: string; website: string } {
  const row = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const email = String(row.email ?? "").trim().toLowerCase();
  const website = String(row.website ?? "").trim().slice(0, 500);
  if (!EMAIL.test(email) || email.length > 254) throw new Error("Enter a valid email address");
  return { email, website };
}
