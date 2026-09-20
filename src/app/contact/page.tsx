import { getPublicEnv } from "@/config/env";
export const metadata = { title: "Contact" };

export default function Contact() {
  const env = getPublicEnv();
  return (
    <main className="content-page">
      <p className="eyebrow">CONTACT</p>
      <h1>Contact {env.brandName}</h1>
      <p>
        Use this channel for editorial questions, correction requests, source concerns, or general contact.
        Submissions are handled through the publication&apos;s hosting platform and are not exposed publicly.
      </p>

      <form
        className="editor-form contact-form"
        name="newsos-contact"
        method="POST"
        data-netlify="true"
        data-netlify-honeypot="website"
        action="/contact?submitted=1"
      >
        <input type="hidden" name="form-name" value="newsos-contact" />
        <label className="visually-hidden" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label>
          Name
          <input name="name" maxLength={120} required />
        </label>
        <label>
          Email
          <input name="email" type="email" maxLength={320} required />
        </label>
        <label>
          Topic
          <select name="topic" defaultValue="general">
            <option value="general">General</option>
            <option value="correction">Correction request</option>
            <option value="source">Source / evidence concern</option>
            <option value="privacy">Privacy</option>
            <option value="partnership">Partnership</option>
          </select>
        </label>
        <label>
          Message
          <textarea name="message" rows={8} maxLength={5000} required />
        </label>
        <button type="submit">Send message</button>
      </form>

      {env.contactEmail ? (
        <p className="muted">You can also email <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.</p>
      ) : (
        <p className="muted">The secure contact form above is the primary editorial contact channel.</p>
      )}
    </main>
  );
}
