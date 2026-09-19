import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface PromptTemplate { system: string; user: string; id: string; version: number; }
export async function getActivePrompt(name: string): Promise<PromptTemplate> {
  const db=createAdminSupabaseClient();
  const {data,error}=await db.from('prompt_versions').select('id,version,template').eq('prompt_name',name).eq('active',true).order('version',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error; if(!data)throw new Error(`No active prompt version for ${name}`);
  let parsed:any; try{parsed=JSON.parse(data.template)}catch{throw new Error(`Prompt ${name} v${data.version} is not valid JSON`)}
  if(typeof parsed.system!=='string'||typeof parsed.user!=='string')throw new Error(`Prompt ${name} v${data.version} must contain system and user strings`);
  return {system:parsed.system,user:parsed.user,id:data.id,version:data.version};
}
export function renderPrompt(template:string, variables:Record<string,string>):string {return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_m,key)=>variables[key]??'');}
