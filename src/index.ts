import { TavilyService } from './services/tavily';
import { GeminiService } from './services/gemini';
import { AveiroService } from './services/aveiro';

async function runPipeline() {
  console.log('--- Starting NewsOS Ingestion Pipeline ---');

  const query = 'AI developer tools OR agent frameworks OR LLM infrastructure news';

  try {
    console.log(`[Pipeline] Fetching news from Tavily for query: "${query}"...`);
    const tavilyResponse = await TavilyService.searchAIWeb(query);

    const results = tavilyResponse.results;
    if (results.length === 0) {
      console.log('[Pipeline] No results found from Tavily. Exiting.');
      return;
    }

    console.log(`[Pipeline] Found ${results.length} articles from Tavily. Processing...`);
    const candidateUrls = results.map(r => r.url);

    let successCount = 0;
    let failureCount = 0;

    for (const result of results) {
      try {
        console.log(`\n[Pipeline] Processing: ${result.title}`);

        // Dedup check before synthesizing
        const alreadyPublished = await AveiroService.isAlreadyPublished(result.url); // Use URL for initial dedup
        if (alreadyPublished) {
           console.log(`[Pipeline] Article with URL "${result.url}" already processed. Skipping.`);
           continue;
        }

        // Transform & Extract
        const digest = await GeminiService.synthesizeArticle(result, candidateUrls);

        // Publish to Aveiro
        const published = await AveiroService.publishDraft(digest);

        if (published) {
          successCount++;
        }
      } catch (error) {
        failureCount++;
        console.error(`[Pipeline] Failed to process article "${result.title}":`, error);
        // Continue to the next article despite failure
      }
    }

    console.log('\n--- Pipeline Execution Summary ---');
    console.log(`Total Found: ${results.length}`);
    console.log(`Successfully Published: ${successCount}`);
    console.log(`Failed/Skipped: ${failureCount + (results.length - successCount - failureCount)}`);
    console.log('----------------------------------');

  } catch (error) {
    console.error('[Pipeline] Critical Error in Pipeline Runner:', error);
    process.exit(1);
  }
}

// Start pipeline
runPipeline();
