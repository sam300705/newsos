import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const token=String(body?.token??'').trim();
  if(!UUID.test(token))return NextResponse.json({error:'Invalid unsubscribe link'},{status:400});
  const db=createAdminSupabaseClient();
  const {data,error}=await db.from('subscriptions').update({status:'UNSUBSCRIBED',updated_at:new Date().toISOString()}).eq('unsubscribe_token',token).select('id').maybeSingle();
  if(error)return NextResponse.json({error:'Unable to update subscription'},{status:500});
  return NextResponse.json({ok:true,changed:Boolean(data)});
}
