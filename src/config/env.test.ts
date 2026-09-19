import { describe, expect, it } from "vitest";
import { EnvValidationError, validatePublicEnv, validateServerEnv } from "./env";

describe("environment validation", () => {
  it("accepts a valid public Supabase configuration with safe defaults", () => {
    expect(
      validatePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
      siteUrl: "http://localhost:3000",
      brandName: "NewsOS",
      publisherName: undefined,
      contactEmail: undefined,
    });
  });

  it("rejects a missing public Supabase key", () => {
    expect(() =>
      validatePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
    ).toThrow(EnvValidationError);
  });

  it("rejects a server client configuration without a server secret", () => {
    expect(() =>
      validateServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("never returns the server secret from public validation", () => {
    const result = validatePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      SUPABASE_SECRET_KEY: "sb_secret_should_not_escape",
    });

    expect(result).not.toHaveProperty("supabaseSecretKey");
  });
});
