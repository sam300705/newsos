import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/config/env";

export function createAdminSupabaseClient() {
  const env = getServerEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
