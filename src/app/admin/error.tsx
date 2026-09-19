"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-error" role="alert">
      <p className="eyebrow">NEWSROOM ERROR</p>
      <h1>Newsroom data couldn’t be loaded.</h1>
      <p>No editorial action was taken. Retry the request or return to the overview.</p>
      <div className="button-row">
        <button onClick={() => reset()}>Retry</button>
        <a className="button-link secondary" href="/admin">Overview</a>
      </div>
    </section>
  );
}
