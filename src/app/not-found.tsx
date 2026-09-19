import Link from "next/link";

export default function NotFound() {
  return (
    <main className="content-page">
      <p className="eyebrow">404</p>
      <h1>That page isn’t in the newsroom.</h1>
      <p>The story may have moved, been unpublished, or the address may be incorrect.</p>
      <Link className="button-link" href="/latest">Browse latest stories</Link>
    </main>
  );
}
