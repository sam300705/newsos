import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/require-role";
export const dynamic='force-dynamic';
export default async function AdminLayout({children}:{children:ReactNode}){const session=await requireStaff(); return <div className="admin-shell"><aside className="admin-nav"><div><span className="eyebrow">LIVE NEWSROOM</span><h2>NewsOS</h2><small>{session.role}</small></div><nav><Link href="/admin">Overview</Link><Link href="/admin/stories">Stories</Link><Link href="/admin/articles">Articles</Link><Link href="/admin/claims">Claims</Link><Link href="/admin/sources">Sources</Link><Link href="/admin/companies">Companies</Link><Link href="/admin/automation">Automation</Link><Link href="/admin/analytics">Analytics</Link><Link href="/admin/costs">Costs</Link><Link href="/admin/settings">Settings</Link><Link href="/">Public site ↗</Link></nav></aside><section className="admin-content">{children}</section></div>}
