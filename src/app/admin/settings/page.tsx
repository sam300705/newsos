import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateAppConfig, updateFeatureFlag } from "../actions";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const db = createAdminSupabaseClient();
  const [{ data: prompts }, { data: configs }, { data: flags }] = await Promise.all([
    db.from("prompt_versions").select("prompt_name,version,provider,model,active,created_at").order("prompt_name").order("version", { ascending: false }),
    db.from("app_config").select("*").order("key"),
    db.from("feature_flags").select("*").order("key"),
  ]);

  return <>
    <div className="admin-head"><div><p className="eyebrow">SYSTEM CONFIGURATION</p><h1>Settings</h1><p>Only OWNER and ADMIN can change global flags or validated configuration.</p></div></div>
    <section className="admin-section"><h2>Prompt versions</h2><div className="admin-table">{(prompts ?? []).map((p: any) => <div key={`${p.prompt_name}:${p.version}`}><span>{p.prompt_name} v{p.version}</span><span>{p.active ? "ACTIVE" : "inactive"}</span><span>{p.provider ?? "provider-neutral"} / {p.model ?? "configured at runtime"}</span></div>)}</div></section>
    <section className="admin-section"><h2>Feature flags</h2><div className="source-admin-grid">{(flags ?? []).map((flag: any) => <form className="source-admin-card" action={updateFeatureFlag} key={flag.key}><input type="hidden" name="key" value={flag.key}/><div><strong>{flag.key}</strong><small>{flag.description}</small></div><input type="hidden" name="enabled" value={flag.enabled ? "false" : "true"}/><button>{flag.enabled ? "Disable" : "Enable"}</button><small>Current: {flag.enabled ? "ON" : "OFF"}</small></form>)}</div></section>
    <section className="admin-section"><h2>Validated configuration</h2><div className="source-admin-grid">{(configs ?? []).map((config: any) => <form className="source-admin-card" action={updateAppConfig} key={config.key}><input type="hidden" name="key" value={config.key}/><div><strong>{config.key}</strong><small>{config.description}</small></div><label>JSON value<textarea name="value" defaultValue={JSON.stringify(config.value, null, 2)} rows={7} required/></label><button>Validate & save</button></form>)}</div></section>
  </>;
}
