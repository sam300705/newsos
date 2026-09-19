import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeAnalyticsMetadata } from "@/core/analytics";

const ALLOWED=new Set(['ARTICLE_VIEW','READ_COMPLETE','SEARCH','ASK_NEWS','NEWSLETTER_SIGNUP']);
export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const eventType=String(body?.eventType??'');
  if(!ALLOWED.has(eventType))return NextResponse.json({error:'Invalid event type'},{status:400});
  const articleId=body?.articleId?String(body.articleId).slice(0,100):null;
  const anonymousId=body?.anonymousId?String(body.anonymousId).slice(0,100):null;
  const metadata=sanitizeAnalyticsMetadata(body?.metadata);
  let userId:null|string=null;
  try{const userDb=await createServerSupabaseClient(); const {data}=await userDb.auth.getClaims(); userId=data?.claims?.sub??null;}catch{}
  const db=createAdminSupabaseClient();
  const {error}=await db.from('analytics_events').insert({event_type:eventType,article_id:articleId,user_id:userId,anonymous_id:anonymousId,metadata});
  if(error)return NextResponse.json({error:'Unable to record event'},{status:500});
  return new NextResponse(null,{status:204});
}
