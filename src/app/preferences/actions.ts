"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateFeedFocus } from "@/core/ranking";

async function currentUser() {
  const db = await createServerSupabaseClient();
  const { data, error } = await db.auth.getClaims();
  const id = data?.claims?.sub;
  if (error || !id) redirect("/login");
  return { db, userId: id };
}

const val = (fd: FormData, name: string) => {
  const value = String(fd.get(name) ?? "").trim();
  if (!value) throw new Error(`${name} required`);
  return value;
};

export async function savePreferences(fd: FormData) {
  const { db, userId } = await currentUser();
  const feedFocus = validateFeedFocus(fd.get("feedFocus"));
  const { error } = await db.from("user_preferences").upsert(
    { user_id: userId, preferences: { feedFocus }, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("Could not save preferences");
  revalidatePath("/preferences");
  revalidatePath("/following");
}

export async function toggleTopicFollow(fd: FormData) {
  const { db, userId } = await currentUser();
  const topicId = val(fd, "topicId");
  const following = String(fd.get("following")) === "true";
  if (following) {
    await db.from("user_topic_follows").delete().eq("user_id", userId).eq("topic_id", topicId);
  } else {
    await db.from("user_topic_follows").upsert({ user_id: userId, topic_id: topicId }, { onConflict: "user_id,topic_id" });
  }
  revalidatePath("/following");
}

export async function toggleCompanyFollow(fd: FormData) {
  const { db, userId } = await currentUser();
  const companyId = val(fd, "companyId");
  const slug = String(fd.get("slug") ?? "");
  const following = String(fd.get("following")) === "true";
  if (following) {
    await db.from("user_company_follows").delete().eq("user_id", userId).eq("company_id", companyId);
  } else {
    await db.from("user_company_follows").upsert({ user_id: userId, company_id: companyId }, { onConflict: "user_id,company_id" });
  }
  revalidatePath("/following");
  if (slug) revalidatePath(`/company/${slug}`);
}

export async function toggleSavedArticle(fd: FormData) {
  const { db, userId } = await currentUser();
  const articleId = val(fd, "articleId");
  const slug = String(fd.get("slug") ?? "");
  const saved = String(fd.get("saved")) === "true";
  if (saved) {
    await db.from("saved_articles").delete().eq("user_id", userId).eq("article_id", articleId);
  } else {
    await db.from("saved_articles").upsert({ user_id: userId, article_id: articleId }, { onConflict: "user_id,article_id" });
  }
  revalidatePath("/saved");
  if (slug) revalidatePath(`/story/${slug}`);
}
