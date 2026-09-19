import Link from "next/link";
import { getPublishedArticles } from "@/lib/db/public-repository";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let articles: any[] = [];
  try { articles = await getPublishedArticles(18); } catch { /* unconfigured environment shows an honest empty state */ }
  const lead = articles[0]; const rest = articles.slice(1);
  return <main className="page-shell"><section className="hero-grid"><div className="hero-copy"><p className="eyebrow">VERIFIED TECHNOLOGY & BUSINESS INTELLIGENCE</p><h1>Fast news.<br/><span>Traceable facts.</span></h1><p className="dek">NewsOS clusters duplicate reporting, verifies atomic claims against source evidence, and publishes with visible provenance.</p></div>{lead ? <Link className="lead-card" href={`/story/${lead.slug}`}><span className="pill">{lead.category ?? "Latest"}</span><h2>{lead.headline}</h2><p>{lead.summary}</p><small>{lead.published_at ? new Date(lead.published_at).toLocaleDateString("en-IN") : ""}</small></Link> : <div className="lead-card empty"><span className="pill">SYSTEM READY</span><h2>No published stories yet</h2><p>Connect the dedicated Supabase project and run the ingestion workers. The site intentionally does not fabricate placeholder news.</p></div>}</section><section className="section"><div className="section-head"><h2>Latest intelligence</h2><Link href="/latest">View all →</Link></div><div className="story-grid">{rest.map((a)=><Link className="story-card" key={a.id} href={`/story/${a.slug}`}><span className="story-meta">{a.category ?? "News"}</span><h3>{a.headline}</h3><p>{a.summary}</p><span className="read-link">Read verified story →</span></Link>)}</div></section></main>;
}
