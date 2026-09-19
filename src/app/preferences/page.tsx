import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FEED_FOCUS_VALUES, validateFeedFocus } from "@/core/ranking";
import { savePreferences } from "./actions";

export const dynamic = "force-dynamic";

const LABELS: Record<(typeof FEED_FOCUS_VALUES)[number], { title: string; description: string }> = {
  balanced: { title: "Balanced", description: "Mix followed companies, topics, recency and story quality." },
  latest: { title: "Latest first", description: "Give substantially more weight to fresh verified stories." },
  topics: { title: "Topics first", description: "Prioritize stories matching topics you explicitly follow." },
  companies: { title: "Companies first", description: "Prioritize companies you explicitly follow." },
};

export default async function PreferencesPage() {
  const db = await createServerSupabaseClient();
  const { data: claims } = await db.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data } = await db.from("user_preferences").select("preferences").eq("user_id", userId).maybeSingle();
  let feedFocus: (typeof FEED_FOCUS_VALUES)[number] = "balanced";
  try {
    const preferences = (data?.preferences ?? {}) as Record<string, unknown>;
    feedFocus = validateFeedFocus(preferences.feedFocus ?? "balanced");
  } catch {
    feedFocus = "balanced";
  }

  return (
    <main className="page-shell narrow">
      <div className="page-title">
        <p className="eyebrow">EXPLICIT PERSONALIZATION</p>
        <h1>Preferences</h1>
        <p>NewsOS uses the choices you make here and the topics/companies you follow. It does not need a hidden behavioral profile to rank your Following feed.</p>
      </div>

      <section className="section">
        <h2>Feed focus</h2>
        <form action={savePreferences} className="preference-form">
          <div className="topic-grid">
            {FEED_FOCUS_VALUES.map((focus) => (
              <label className={`topic-card ${feedFocus === focus ? "selected" : ""}`} key={focus}>
                <div>
                  <strong>{LABELS[focus].title}</strong>
                  <p>{LABELS[focus].description}</p>
                </div>
                <input type="radio" name="feedFocus" value={focus} defaultChecked={feedFocus === focus} />
              </label>
            ))}
          </div>
          <div className="button-row preference-actions">
            <button type="submit">Save preferences</button>
            <Link href="/following">Open Following feed</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
