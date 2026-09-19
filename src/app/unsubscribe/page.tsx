"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
export default function UnsubscribePage(){
  const params=useSearchParams(); const token=params.get('token')??''; const [status,setStatus]=useState('');
  async function unsubscribe(){setStatus('Working…'); const r=await fetch('/api/unsubscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}); const j=await r.json().catch(()=>({})); setStatus(r.ok?'You are unsubscribed.':String(j.error??'Unable to unsubscribe.'));}
  return <main className="page-shell narrow"><div className="page-title"><p className="eyebrow">EMAIL PREFERENCES</p><h1>Unsubscribe</h1><p>Stop future NewsOS newsletter delivery for this subscription.</p></div><button onClick={unsubscribe} disabled={!token}>Unsubscribe</button><p aria-live="polite">{status}</p></main>;
}
