const JOB_FLAG: Record<string, string> = {
  FETCH_FEED: "rss_ingestion",
  DISCOVER_TAVILY: "tavily_discovery",
  CRAWL_WATCHLIST: "crawl_watchlists",
  EXTRACT_DOCUMENT: "automatic_extraction",
  CLUSTER_SOURCE: "story_clustering",
  SCORE_STORY: "story_clustering",
  RESEARCH_STORY: "tavily_discovery",
  EXTRACT_CLAIMS: "automatic_extraction",
  GENERATE_ARTICLE: "article_generation",
  VERIFY_EDITED_ARTICLE: "article_generation",
  VERIFY_CORRECTION: "article_generation",
  QUALITY_CHECK: "article_generation",
  SYNC_AVEIRO: "aveiro_sync",
  GENERATE_NEWSLETTER: "newsletter_generation",
  GENERATE_SOCIAL: "social_generation",
};

export function operationalFlagForJob(jobType: string): string | null {
  return JOB_FLAG[jobType] ?? null;
}

export function isJobAllowedByFlags(jobType: string, flags: Record<string, boolean>, globalPause: boolean, manual = false): boolean {
  if (manual) return true;
  if (globalPause) return false;
  const flag = operationalFlagForJob(jobType);
  return flag ? flags[flag] !== false : true;
}
