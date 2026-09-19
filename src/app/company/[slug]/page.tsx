import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/db/public-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toggleCompanyFollow } from "@/app/preferences/actions";

export const dynamic = "force-dynamic";

const relationIs = (relationship: unknown, names: string[]) => names.includes(String(relationship ?? "").toUpperCase());
const eventIs = (eventType: unknown, names: string[]) => names.includes(String(eventType ?? "").toUpperCase());

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCompanyBySlug(slug).catch(() => null);
  if (!data) {
    notFound();
    throw new Error("Unreachable after notFound");
  }

  const name = (data.company as any).entities?.canonical_name ?? slug;
  const aliases = (data.company as any).entities?.aliases ?? [];
  const relations = data.relations ?? [];
  const timeline = data.timeline ?? [];
  const founders = relations.filter((row: any) => relationIs(row.relationship, ["FOUNDER", "CO_FOUNDER", "FOUNDED_BY"]));
  const products = relations.filter((row: any) => relationIs(row.relationship, ["PRODUCT", "BUILDS", "OWNS_PRODUCT"]) || row.entities?.entity_type === "PRODUCT");
  const acquisitions = timeline.filter((row: any) => eventIs(row.event_type, ["ACQUISITION", "ACQUIRED", "M&A"]));
  const leadershipChanges = timeline.filter((row: any) => eventIs(row.event_type, ["LEADERSHIP_CHANGE", "EXECUTIVE_APPOINTMENT", "EXECUTIVE_DEPARTURE"]));

  let following = false;
  try {
    const db = await createServerSupabaseClient();
    const { data: claims } = await db.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (uid) {
      const { data: follow } = await db.from("user_company_follows").select("company_id").eq("user_id", uid).eq("company_id", data.company.id).maybeSingle();
      following = Boolean(follow);
    }
  } catch {}

  return (
    <main className="page-shell narrow">
      <div className="company-hero">
        <p className="eyebrow">COMPANY INTELLIGENCE</p>
        <h1>{name}</h1>
        <p>{data.company.overview ?? "Verified company intelligence is assembled from published NewsOS stories."}</p>
        <form className="article-action" action={toggleCompanyFollow}>
          <input type="hidden" name="companyId" value={data.company.id} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="following" value={following ? "true" : "false"} />
          <button>{following ? "Unfollow company" : "Follow company"}</button>
        </form>
        <div className="company-facts">
          {data.company.industry && <span>{data.company.industry}</span>}
          {data.company.headquarters && <span>{data.company.headquarters}</span>}
          {data.company.official_domain && <span>{data.company.official_domain}</span>}
          {data.company.last_verified_at && <span>Last verified {new Date(data.company.last_verified_at).toLocaleDateString("en-IN")}</span>}
        </div>
        {aliases.length > 0 && <p><strong>Also known as:</strong> {aliases.join(", ")}</p>}
      </div>

      {(founders.length > 0 || products.length > 0) && (
        <section className="section">
          <h2>Company facts</h2>
          <div className="data-grid">
            {founders.length > 0 && <div className="metric-card"><span>Founders</span><strong>{founders.map((row: any) => row.entities?.canonical_name).filter(Boolean).join(", ")}</strong></div>}
            {products.length > 0 && <div className="metric-card"><span>Products</span><strong>{products.map((row: any) => row.entities?.canonical_name).filter(Boolean).join(", ")}</strong></div>}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Verified timeline</h2>
        <div className="timeline">{timeline.length ? timeline.map((event: any) => <div key={event.id}><time>{new Date(event.event_at).toLocaleDateString("en-IN")}</time><div><strong>{event.headline}</strong><p>{event.event_type}</p></div></div>) : <p>No verified timeline events yet.</p>}</div>
      </section>

      {acquisitions.length > 0 && <section className="section"><h2>Acquisitions</h2><div className="timeline">{acquisitions.map((event: any) => <div key={event.id}><time>{new Date(event.event_at).toLocaleDateString("en-IN")}</time><div><strong>{event.headline}</strong></div></div>)}</div></section>}
      {leadershipChanges.length > 0 && <section className="section"><h2>Leadership changes</h2><div className="timeline">{leadershipChanges.map((event: any) => <div key={event.id}><time>{new Date(event.event_at).toLocaleDateString("en-IN")}</time><div><strong>{event.headline}</strong></div></div>)}</div></section>}

      <section className="section">
        <h2>Funding</h2>
        <div className="data-grid">{data.funding.length ? data.funding.map((round: any) => <div className="metric-card" key={round.id}><span>{round.round_type ?? "Funding round"}</span><strong>{round.amount ? `${round.currency ?? ""} ${Number(round.amount).toLocaleString()}` : "Amount not disclosed"}</strong><small>{round.announced_at ?? ""}</small>{Array.isArray(round.investors) && round.investors.length > 0 && <small>Investors: {round.investors.map((i: any) => typeof i === "string" ? i : i?.name).filter(Boolean).join(", ")}</small>}</div>) : <p>No verified funding rounds yet.</p>}</div>
      </section>

      <section className="section">
        <h2>Relationships</h2>
        <div className="list-stack">{relations.length ? relations.map((row: any) => <div className="list-story" key={row.id}><div><strong>{row.relationship}</strong><p>{row.entities?.canonical_name} · {row.entities?.entity_type}</p></div></div>) : <p>No verified relationships yet.</p>}</div>
      </section>

      <section className="section">
        <h2>Sources</h2>
        <div className="sources">{data.sources.length ? data.sources.map((source: any) => <a href={source.canonical_url} target="_blank" rel="noreferrer" key={source.id}><strong>{source.title ?? source.canonical_url}</strong><span>{source.sources?.domain} · {source.sources?.source_type}</span></a>) : <p>No public sources linked yet.</p>}</div>
      </section>
    </main>
  );
}
