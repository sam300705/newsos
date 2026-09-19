import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeSubscriptionInput } from "@/core/subscription";

export async function POST(request:Request){
  const length=Number(request.headers.get('content-length')??0);
  if(Number.isFinite(length)&&length>4096)return NextResponse.json({error:'Request too large'},{status:413});
  const body=await request.json().catch(()=>null);
  let input:{email:string;website:string};
  try{input=normalizeSubscriptionInput(body)}catch{return NextResponse.json({error:'Enter a valid email address'},{status:400})}
  if(input.website)return NextResponse.json({ok:true});
  const db=createAdminSupabaseClient();
  const {error}=await db.from('subscriptions').upsert({email:input.email,status:'ACTIVE',cadence:'DAILY',updated_at:new Date().toISOString()},{onConflict:'email'});
  if(error)return NextResponse.json({error:'Unable to subscribe right now'},{status:500});
  await db.from('analytics_events').insert({event_type:'NEWSLETTER_SIGNUP',metadata:{domain:input.email.split('@')[1]??null}});
  return NextResponse.json({ok:true});
}
