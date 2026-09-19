import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { getPublicEnv } from "@/config/env";
import "./globals.css";

const publicEnv = getPublicEnv();
export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: publicEnv.brandName, template: `%s | ${publicEnv.brandName}` },
  description: "Trust-first business and technology news intelligence with claim-level provenance.",
  openGraph: { type: "website", siteName: publicEnv.brandName },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: publicEnv.publisherName ?? publicEnv.brandName,
    url: publicEnv.siteUrl,
    ...(publicEnv.contactEmail ? { email: publicEnv.contactEmail } : {}),
  };
  return <html lang="en"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
    <SiteHeader />
    {children}
    <footer className="footer">
      <div><strong>{publicEnv.brandName}</strong><p>Trust-first technology and business intelligence.</p><NewsletterSignup /></div>
      <nav><a href="/about">About</a><a href="/editorial-policy">Editorial Policy</a><a href="/corrections">Corrections</a><a href="/contact">Contact</a></nav>
    </footer>
  </body></html>;
}
