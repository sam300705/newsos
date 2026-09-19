import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole, StaffRole } from "@/domain/types";

export async function getCurrentUserAndRole(): Promise<{ userId: string; role: AppRole } | null> {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || !userId) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return profile?.role ? { userId, role: profile.role as AppRole } : null;
}

export async function requireStaff(allowed: StaffRole[] = ["OWNER","ADMIN","EDITOR","REVIEWER"]) {
  const session = await getCurrentUserAndRole();
  if (!session) {
    redirect("/login");
    throw new Error("Unreachable after authentication redirect");
  }
  if (!allowed.includes(session.role as StaffRole)) {
    redirect("/");
    throw new Error("Unreachable after authorization redirect");
  }
  return session;
}
