import { getPublicEnv } from "@/config/env";
export const metadata = { title: "Contact" };
export default function Contact() {
  const env = getPublicEnv();
  return <main className="content-page">
    <p className="eyebrow">CONTACT</p>
    <h1>Contact {env.brandName}</h1>
    {env.contactEmail
      ? <p>For editorial questions, correction requests, or general contact, email <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.</p>
      : <p>A production contact address has not yet been configured. This is tracked as a manual launch requirement rather than replaced with a fake address.</p>}
  </main>;
}
