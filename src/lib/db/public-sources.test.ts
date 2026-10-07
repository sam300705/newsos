import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { getPublishedSources } from "./public-sources";

describe("public source boundary", () => {
  it("keeps document IDs and primary-source classification for the trust panel", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ document_id: "doc", story_id: "story", relationship: "PRIMARY_EVIDENCE", canonical_url: "https://example.test", title: "Source", published_at: null, source_name: "Example", source_domain: "example.test", source_type: "PRIMARY" }], error: null });
    const rows = await getPublishedSources({ rpc } as unknown as SupabaseClient, ["story"]);
    expect(rpc).toHaveBeenCalledWith("get_published_sources", { p_story_ids: ["story"] });
    expect(rows[0]?.document_id).toBe("doc");
    expect(rows[0]?.source_documents.sources.source_type).toBe("PRIMARY");
    expect(rows[0]?.source_documents).not.toHaveProperty("content_text");
  });
  it("propagates failed RPCs instead of showing zero sources", async () => {
    const error = new Error("denied");
    await expect(getPublishedSources({ rpc: vi.fn().mockResolvedValue({ data: null, error }) } as unknown as SupabaseClient, ["story"])).rejects.toThrow("denied");
  });
  it("bounds requests to 100 story IDs", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await getPublishedSources({ rpc } as unknown as SupabaseClient, Array.from({ length: 150 }, (_, i) => `${i}`));
    expect(rpc.mock.calls[0]?.[1].p_story_ids).toHaveLength(100);
  });
});
