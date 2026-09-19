import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getGlobalAutomationConfig } from "@/lib/db/admin-repository";
import { OpenAICompatibleProvider } from "@/lib/ai/provider";
import { validateAnswerCitations } from "@/core/ask-news";
import { getActivePrompt, renderPrompt } from "@/lib/ai/prompts";
export const runtime='nodejs';
export async function POST(request:Request){
  const config=await getGlobalAutomationConfig();
  if(!config.flags.ask_the_news)return NextResponse.json({error:'Ask the News is disabled'},{status:404});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const articleId=String(body?.articleId??'').slice(0,100);
  const question=String(body?.question??'').trim().slice(0,1000);
  if(!articleId||!question)return NextResponse.json({error:'articleId and question are required'},{status:400});
  const db=createAdminSupabaseClient();
  const {data:article}=await db.from('articles').select('id,story_id,headline,status').eq('id',articleId).in('status',['PUBLISHED','CORRECTED']).maybeSingle();
  if(!article)return NextResponse.json({error:'Article not found'},{status:404});
  const {data:claims}=await db.from('claims').select('id,claim_text,status,confidence,claim_evidence(document_id,stance,source_documents(canonical_url,title))').eq('story_id',article.story_id).in('status',['SUPPORTED','MULTI_SOURCE_SUPPORTED','PRIMARY_SOURCE_VERIFIED']).gte('confidence',70);
  const safeClaims=(claims??[]).filter((c:any)=>!(c.claim_evidence??[]).some((e:any)=>e.stance==='CONTRADICTS'));
  const allowedSources=[...new Set(safeClaims.flatMap((c:any)=>(c.claim_evidence??[]).filter((e:any)=>e.stance==='SUPPORTS').map((e:any)=>e.document_id)))];
  const context=safeClaims.map((c:any)=>`CLAIM ${c.id}: ${c.claim_text}\nSOURCES: ${(c.claim_evidence??[]).filter((e:any)=>e.stance==='SUPPORTS').map((e:any)=>`${e.document_id} ${e.source_documents?.canonical_url}`).join(', ')}`).join('\n\n');
  if(!safeClaims.length)return NextResponse.json({answer:'The verified corpus does not establish an answer to that question.',citationSourceIds:[]});
  const promptVersion=await getActivePrompt('ask_news');
  const provider=new OpenAICompatibleProvider();
  const result=await provider.generateJson<any>({system:promptVersion.system,prompt:renderPrompt(promptVersion.user,{articleTitle:article.headline,question,context}),schemaName:'ask_news_v1'});
  await db.from('llm_usage').insert({provider:result.provider,model:result.model,input_tokens:result.usage.inputTokens,output_tokens:result.usage.outputTokens,estimated_cost_usd:result.estimatedCostUsd});
  if(!validateAnswerCitations(result.value.citationSourceIds??[],allowedSources as string[]))return NextResponse.json({error:'Model returned an invalid citation set'},{status:502});
  return NextResponse.json({answer:result.value.answer,citationSourceIds:result.value.citationSourceIds});
}
