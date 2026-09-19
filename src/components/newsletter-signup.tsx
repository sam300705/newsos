"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMsg("");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const body = await response.json().catch(() => ({}));
      setMsg(response.ok ? "Subscribed." : String(body.error ?? "Unable to subscribe."));
      if (response.ok) {
        setEmail("");
        setWebsite("");
      }
    } catch {
      setMsg("Unable to subscribe right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="newsletter-form" onSubmit={submit} aria-busy={submitting}>
      <label>
        <span>Daily verified tech brief</span>
        <div>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
          <button disabled={submitting}>{submitting ? "Subscribing…" : "Subscribe"}</button>
        </div>
      </label>
      <label className="hp" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>
      <small aria-live="polite">{msg}</small>
    </form>
  );
}
