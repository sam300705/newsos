import Link from "next/link";
import { getPublishedArticles } from "@/lib/db/public-repository";
export const dynamic = "force-dynamic";
export const metadata = { title: "Latest" };
export default async function LatestPage(){ let rows:any[]=[]; try{rows=await getPublishedArticles(100)}catch{} return <main className="page-shell narrow"><div className="page-title"><p className="eyebrow">LIVE PUBLICATION</p><h1>Latest</h1></div><div className="list-stack">{rows.map(a=><Link key={a.id} className="list-story" href={`/story/${a.slug}`}><div><span className="story-meta">{a.category ?? "News"}</span><h2>{a.headline}</h2><p>{a.summary}</p></div><time>{a.published_at ? new Date(a.published_at).toLocaleDateString("en-IN") : ""}</time></Link>)}</div>{!rows.length&&<p className="empty-state">No published stories yet.</p>}</main>}
