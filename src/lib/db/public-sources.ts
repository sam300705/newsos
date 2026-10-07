import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

// Only this typed read boundary is exposed. Raw documents keep staff-only RLS.
export async function getPublishedSources(client: SupabaseClient, storyIds: string[]) {
  const typed = client as SupabaseClient<Database>;
  const { data, error } = await typed.rpc("get_published_sources", { p_story_ids: storyIds.slice(0, 100) });
  if (error) throw error;
  return (data ?? []).map(row => {
    if (!row.document_id || !row.canonical_url) throw new Error("Published source metadata is incomplete");
    return {
      story_id: row.story_id,
      document_id: row.document_id,
      relationship: row.relationship,
      source_documents: {
        id: row.document_id,
        canonical_url: row.canonical_url,
        title: row.title,
        published_at: row.published_at,
        sources: { name: row.source_name, domain: row.source_domain, source_type: row.source_type },
      },
    };
  });
}
