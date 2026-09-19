"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="content-page">
      <p className="eyebrow">TEMPORARY ERROR</p>
      <h1>We couldn’t load this page.</h1>
      <p>The publication is safe; this request failed before the page could finish loading.</p>
      <div className="button-row">
        <button onClick={() => reset()}>Try again</button>
        <Link className="button-link secondary" href="/">Return home</Link>
      </div>
    </main>
  );
}
