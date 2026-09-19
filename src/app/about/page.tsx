import { getPublicEnv } from "@/config/env";
export const metadata = { title: "About" };
export default function About() {
  const env = getPublicEnv();
  return <main className="content-page">
    <p className="eyebrow">ABOUT {env.brandName.toUpperCase()}</p>
    <h1>A newsroom built around evidence.</h1>
    <p>{env.brandName} is a technology and business publication designed to keep the structured story record—not an AI-generated article—as the source of truth. Reports from multiple publishers are clustered into one story, factual claims are linked to evidence, and corrections are preserved.</p>
    <h2>How AI is used</h2>
    <p>AI assists with extraction, classification, claim drafting and article generation. Publication gates and source provenance are deterministic where possible. High-risk categories always require human editorial review.</p>
    <h2>Publisher</h2>
    {env.publisherName ? <p>{env.publisherName} operates {env.brandName}.</p> : <p>Publisher legal ownership is not yet configured. This is a launch requirement and is intentionally not fabricated.</p>}
    <h2>Contact</h2>
    {env.contactEmail ? <p><a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a></p> : <p>A production editorial contact address is not yet configured and must be added before public launch.</p>}
  </main>;
}
