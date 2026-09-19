import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { summarizeAutonomyDecisions } from "@/core/autonomy-analytics";

export const dynamic = "force-dynamic";

type AnalyticsRow = { event_type: string; article_id: string | null; metadata: unknown; created_at: string };
type AutonomyRow = { system_decision: string; editor_decision: string | null; created_at: string };

export default async function Analytics() {
  const db = createAdminSupabaseClient();
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const [{ data: events, error: eventError }, { data: autonomyRows, error: autonomyError }] = await Promise.all([
    db.from("analytics_events").select("event_type,article_id,metadata,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    db.from("autonomy_decisions").select("system_decision,editor_decision,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (eventError) throw eventError;
  if (autonomyError) throw autonomyError;

  const rows: AnalyticsRow[] = (events ?? []) as AnalyticsRow[];
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.event_type] = (acc[row.event_type] ?? 0) + 1;
    return acc;
  }, {});
  const autonomy = summarizeAutonomyDecisions(((autonomyRows ?? []) as AutonomyRow[]).map((row) => ({
    systemDecision: row.system_decision,
    editorDecision: row.editor_decision,
  })));

  return <>
    <div className="admin-head">
      <div>
        <p className="eyebrow">READER + EDITORIAL SIGNALS</p>
        <h1>Analytics</h1>
        <p>Privacy-conscious product events and shadow-autonomy quality signals. No advertising profile is built here.</p>
      </div>
    </div>
    <div className="metric-grid">
      <div className="metric-card"><span>Article views</span><strong>{counts.ARTICLE_VIEW ?? 0}</strong></div>
      <div className="metric-card"><span>Read completions</span><strong>{counts.READ_COMPLETE ?? 0}</strong></div>
      <div className="metric-card"><span>Searches</span><strong>{counts.SEARCH ?? 0}</strong></div>
      <div className="metric-card"><span>Ask the News</span><strong>{counts.ASK_NEWS ?? 0}</strong></div>
      <div className="metric-card"><span>Newsletter signups</span><strong>{counts.NEWSLETTER_SIGNUP ?? 0}</strong></div>
      <div className="metric-card"><span>Shadow decisions reviewed</span><strong>{autonomy.reviewed}</strong></div>
      <div className="metric-card"><span>System/editor disagreements</span><strong>{autonomy.disagreements}</strong></div>
      <div className="metric-card"><span>Disagreement rate</span><strong>{(autonomy.disagreementRate * 100).toFixed(1)}%</strong></div>
    </div>
    <section className="admin-section">
      <h2>Recent product events</h2>
      <div className="admin-table">
        {rows.slice(0, 100).map((row, index) => <div key={`${row.created_at}-${index}`}>
          <span>{row.event_type}</span>
          <span>{row.article_id ?? "site"}</span>
          <span>{new Date(row.created_at).toLocaleString("en-IN")}</span>
        </div>)}
      </div>
    </section>
  </>;
}
