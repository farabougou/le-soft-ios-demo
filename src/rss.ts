import { Platform } from 'react-native';
import { BRAND, officialUrl } from './config';
import { extractImages, imageUrl, parseFeed, parseKiosk } from './content';
import { Article } from './types';

export async function fetchText(url: string, timeout = 12000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/json, text/html, text/xml', 'Cache-Control': 'no-cache',
        // Lets the WordPress plugin remove subscription offers from feeds and pages read by the iOS app.
        ...(Platform.OS === 'ios' ? { 'X-LeSoft-App': 'ios' } : {}) } });
    if (!response.ok) throw Object.assign(new Error(`Site indisponible (${response.status})`), { status: response.status });
    return await response.text();
  } finally { clearTimeout(timer); }
}

export async function fetchArticles(): Promise<Article[]> {
  const articles = parseFeed(await fetchText(BRAND.feedUrl));
  if (!articles.length) throw new Error('Le site n’a pas renvoyé d’articles.');
  return articles;
}

export async function fetchEditions(): Promise<Article[]> {
  const editions = parseKiosk(await fetchText(BRAND.kioskUrl));
  if (!editions.length) throw new Error('Le kiosque est temporairement indisponible.');
  return editions;
}

export async function enrichArticleImages(articles: Article[], onImage: (article: Article) => void, signal?: AbortSignal): Promise<void> {
  const pending = articles.filter((article) => !article.image);
  if (!pending.length || signal?.aborted) return;
  const resolved = new Set<string>();
  // Optional REST images. The app still works when a membership plugin disables REST.
  try {
    const json = JSON.parse(await fetchText(`${BRAND.siteUrl}/wp-json/wp/v2/posts?per_page=40&_embed=wp:featuredmedia`, 6000));
    if (Array.isArray(json) && !signal?.aborted) {
      for (const post of json) {
        const link = officialUrl(post.link || '');
        const article = pending.find((item) => item.link === link);
        const media = post._embedded?.['wp:featuredmedia']?.[0];
        const candidates = [media?.media_details?.sizes?.large?.source_url, media?.source_url]
          .map((url) => imageUrl(url)).filter((url): url is string => Boolean(url));
        if (article && candidates.length) {
          resolved.add(article.id);
          onImage({ ...article, image: candidates[0], imageCandidates: [...new Set(candidates)] });
        }
      }
    }
  } catch { /* Page metadata is the fallback when REST is unavailable. */ }
  // The host's firewall blocks bursts (HTTP 503/429), which also breaks the reader: stay small and stop when told to.
  const remaining = pending.filter((article) => !resolved.has(article.id)).slice(0, 10);
  let index = 0;
  let throttled = false;
  await Promise.all(Array.from({ length: Math.min(2, remaining.length) }, async () => {
    while (index < remaining.length && !signal?.aborted && !throttled) {
      const article = remaining[index++];
      try {
        const html = await fetchText(article.link, 8000);
        const imageCandidates = extractImages(html, article.link);
        if (imageCandidates.length && !signal?.aborted) {
          onImage({ ...article, image: imageCandidates[0], imageCandidates });
        }
      } catch (error) {
        // Otherwise keep a small placeholder if the publisher has no cover image.
        if ([429, 503].includes((error as { status?: number }).status ?? 0)) throttled = true;
      }
    }
  }));
}
