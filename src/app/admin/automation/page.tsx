import { getGlobalAutomationConfig } from "@/lib/db/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createWatchlist, toggleGlobalPause, updateFeatureFlag } from "../actions";
export const dynamic='force-dynamic';

export default async function Automation(){
  const [config,db]=await Promise.all([getGlobalAutomationConfig(),Promise.resolve(createAdminSupabaseClient())]);
  const [{data:runs},{data:failures},{count:deadCount},{data:watchlists}]=await Promise.all([
    db.from('automation_runs').select('*').order('started_at',{ascending:false}).limit(30),
    db.from('job_runs').select('id,job_type,status,error_message,updated_at').in('status',['FAILED','DEAD_LETTER']).order('updated_at',{ascending:false}).limit(20),
    db.from('dead_letters').select('id',{count:'exact',head:true}).is('resolved_at',null),
    db.from('source_watchlists').select('*').order('created_at',{ascending:false}).limit(100),
  ]);
  const paused=Boolean(config.config['automation.global_pause']);
  const latestSuccess=(runs??[]).find((r:any)=>r.status==='SUCCEEDED');
  const latestFailure=(runs??[]).find((r:any)=>r.status==='FAILED');
  return <>
    <div className="admin-head"><div><p className="eyebrow">CONTROL CENTER</p><h1>Automation</h1><p>Global pause overrides all automated workers. Manual editorial actions remain explicit and audited.</p></div><form action={toggleGlobalPause}><input type="hidden" name="paused" value={paused?'false':'true'}/><button className={paused?'':'danger-button'}>{paused?'Resume all automation':'PAUSE ALL AUTOMATION'}</button></form></div>
    <div className="metric-grid"><div className="metric-card"><span>State</span><strong>{paused?'PAUSED':'ACTIVE'}</strong></div><div className="metric-card"><span>Last success</span><strong>{latestSuccess?new Date(latestSuccess.finished_at??latestSuccess.started_at).toLocaleString('en-IN'):'—'}</strong></div><div className="metric-card"><span>Last failure</span><strong>{latestFailure?new Date(latestFailure.finished_at??latestFailure.started_at).toLocaleString('en-IN'):'—'}</strong></div><div className="metric-card"><span>Dead letters</span><strong>{deadCount??0}</strong></div></div>
    <section className="admin-section"><h2>Feature controls</h2><div className="flag-grid">{Object.entries(config.flags).map(([key,value])=><form className="metric-card" action={updateFeatureFlag} key={key}><input type="hidden" name="key" value={key}/><input type="hidden" name="enabled" value={value?'false':'true'}/><span>{key}</span><strong>{value?'ON':'OFF'}</strong><button className="small">{value?'Disable':'Enable'}</button></form>)}</div></section>
    <section className="admin-section"><h2>Add discovery watchlist</h2><form className="editor-form compact" action={createWatchlist}><label>Name<input name="name" required placeholder="AI product launches"/></label><label>Kind<select name="kind" defaultValue="TAVILY_QUERY"><option>TAVILY_QUERY</option><option>CRAWL_URL</option></select></label><label>Search query<input name="query" placeholder="AI product launch startup India"/></label><label>Crawl URL<input name="url" type="url" placeholder="https://company.com/newsroom"/></label><label>Instructions<textarea name="instructions" placeholder="Return press releases and product announcements"/></label><label>Interval minutes<input name="intervalMinutes" type="number" min="5" max="10080" step="1" defaultValue="30"/></label><button>Create watchlist</button></form></section>
    <section className="admin-section"><h2>Watchlists</h2><div className="admin-table">{(watchlists??[]).map((w:any)=>{const next=new Date((w.last_run_at?Date.parse(w.last_run_at):Date.now())+Number(w.interval_minutes)*60_000);return <div key={w.id}><span>{w.name}</span><span>{w.kind} · {w.enabled?'enabled':'disabled'}</span><span>Next eligible {next.toLocaleString('en-IN')}</span></div>})}</div></section>
    <section className="admin-section"><h2>Recent automation runs</h2><div className="admin-table">{(runs??[]).map((r:any)=><div key={r.id}><span>{r.automation}</span><span>{r.status}</span><span>{r.items_processed} items · {r.error_message??''}</span></div>)}</div></section>
    <section className="admin-section"><h2>Recent failures</h2><div className="admin-table">{(failures??[]).length?(failures??[]).map((r:any)=><div key={r.id}><span>{r.job_type}</span><span>{r.status}</span><span>{r.error_message??'No error message'}</span></div>):<p className="empty-state">No recent failures.</p>}</div></section>
  </>;
}
