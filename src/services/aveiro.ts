import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { ArticleDigest } from './gemini';

export class AveiroService {
  private static CACHE_FILE = path.join(process.cwd(), '.publish_cache.json');
  private static URL_CACHE_FILE = path.join(process.cwd(), '.url_cache.json');
  private static BASE_URL = 'https://www.aveiro.app/api/v1';

  private static async getPublishedCache(cacheFile: string): Promise<Set<string>> {
    try {
      const data = await fs.readFile(cacheFile, 'utf-8');
      const items: string[] = JSON.parse(data);
      return new Set(items);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return new Set();
      }
      console.warn(`[Aveiro] Failed to read cache file ${cacheFile}, proceeding with empty cache:`, error);
      return new Set();
    }
  }

  private static async saveToCache(item: string, cacheFile: string): Promise<void> {
    const cached = await this.getPublishedCache(cacheFile);
    cached.add(item);
    await fs.writeFile(cacheFile, JSON.stringify(Array.from(cached), null, 2));
  }

  static async isAlreadyPublished(url: string): Promise<boolean> {
     const publishedUrls = await this.getPublishedCache(this.URL_CACHE_FILE);
     return publishedUrls.has(url);
  }

  static async publishDraft(article: ArticleDigest): Promise<boolean> {
    const publishedSlugs = await this.getPublishedCache(this.CACHE_FILE);

    if (publishedSlugs.has(article.slug)) {
      console.log(`[Aveiro] Article with slug "${article.slug}" already published. Skipping.`);
      return false;
    }

    const payload = {
      title: article.title,
      slug: article.slug,
      content: `
# Summary
${article.summary}

# Architectural Breakdown
${article.architecturalBreakdown}

# Key Takeaways
${article.keyTakeaways.map(t => `- ${t}`).join('\n')}

[Source](${article.sourceUrl})
      `.trim(),
      tags: article.tags,
      status: 'draft',
    };

    try {
      const response = await fetch(`${this.BASE_URL}/sites/${env.AVEIRO_SITE_ID}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AVEIRO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`[Aveiro] Failed to publish draft: ${response.status} ${response.statusText}`);
      }

      await this.saveToCache(article.slug, this.CACHE_FILE);
      await this.saveToCache(article.sourceUrl, this.URL_CACHE_FILE); // Save original URL to avoid resynthesizing
      console.log(`[Aveiro] Successfully published draft: ${article.title}`);
      return true;
    } catch (error) {
      console.error(`[Aveiro] Publishing error for slug "${article.slug}":`, error);
      throw error;
    }
  }
}
