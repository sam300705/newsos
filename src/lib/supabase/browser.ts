"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/config/env";

export function getBrowserSupabaseClient() {
  const env = getPublicEnv();
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
