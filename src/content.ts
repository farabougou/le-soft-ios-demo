import { BRAND, officialUrl } from './config';
import { Article } from './types';

const entities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ugrave: 'ù',
  ocirc: 'ô', icirc: 'î', ccedil: 'ç', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', hellip: '…',
  ndash: '–', mdash: '—', bull: '•',
};

export function decode(value = ''): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);|&#x([0-9a-f]+);/gi, (match, dec, hex) => {
      const n = dec ? Number(dec) : parseInt(hex, 16);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    })
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match).trim();
}

export function stripHtml(value = ''): string {
  return decode(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function cleanExcerpt(value: string): string {
  return stripHtml(value)
    .split(/La suite est disponible|Pour le lire,?\s*Connectez|This content is for members only|Abonnez-vous|The post .+? first appeared on|\[\.\.\.\]/i)[0]
    .trim().slice(0, 230);
}

export function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

export function imageUrl(raw: string | undefined, base = BRAND.siteUrl): string | undefined {
  if (!raw) return;
  try {
    const url = new URL(decode(raw), base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:') return;
    if (/gravatar|\/(?:logo|cropped-logo)|pixel|tracking/i.test(url.toString())) return;
    return url.toString();
  } catch { return; }
}

function imagesFromTag(tag: string, base: string): string[] {
  const a = attributes(tag);
  const sources = (a['data-srcset'] || a.srcset || '').split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .sort((x, y) => parseInt(y[1] || '0', 10) - parseInt(x[1] || '0', 10))
    .map((entry) => entry[0]);
  return [a['data-lazy-src'], a['data-src'], ...sources, a.src, a.url]
    .map((x) => imageUrl(x, base)).filter((x): x is string => Boolean(x));
}

export function extractImages(html: string, base = BRAND.siteUrl): string[] {
  const decoded = decode(html);
  const meta: string[] = [];
  for (const tag of decoded.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attributes(tag);
    if (/^(og:image(?::secure_url)?|twitter:image(?::src)?)$/i.test(a.property || a.name || '')) {
      const url = imageUrl(a.content, base);
      if (url) meta.push(url);
    }
  }
  const tags = decoded.match(/<(?:img|media:content|media:thumbnail|enclosure)\b[^>]*>/gi) ?? [];
  const preferred = tags.filter((tag) => /wp-post-image|attachment-|featured|media:|enclosure/i.test(tag));
  const content = tags.filter((tag) => !/logo|avatar|banner|advert|gravatar/i.test(tag));
  return [...new Set([...meta, ...preferred.flatMap((t) => imagesFromTag(t, base)), ...content.flatMap((t) => imagesFromTag(t, base))])].slice(0, 5);
}

function tag(block: string, name: string): string {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '';
}

export function frDate(raw: string): string {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Bamako',
  }).format(date);
}

export function parseFeed(xml: string): Article[] {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, 40).flatMap((item) => {
    const title = stripHtml(tag(item, 'title'));
    const rawLink = decode(tag(item, 'link'));
    const link = rawLink ? officialUrl(rawLink) : undefined;
    if (!title || !link) return [];
    const description = tag(item, 'description');
    const body = tag(item, 'content:encoded');
    const categories = [...item.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)]
      .map((m) => stripHtml(m[1])).filter(Boolean);
    const imageCandidates = extractImages(item, link);
    const publishedAt = stripHtml(tag(item, 'pubDate'));
    const premium = categories.some((c) => /réserv|premium|journal/i.test(c))
      || /members only|swpm|La suite est disponible uniquement/i.test(body + description);
    return [{ id: link, title, excerpt: cleanExcerpt(description || body), content: '', link,
      date: frDate(publishedAt), publishedAt, categories,
      category: categories.find((c) => !/réserv|non classé/i.test(c)) || 'Actualités',
      image: imageCandidates[0], imageCandidates, premium }];
  });
}

export function parseKiosk(html: string): Article[] {
  const articles: Article[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const title = stripHtml(match[2]);
    const href = attributes(match[1]).href;
    const link = href ? officialUrl(href) : undefined;
    if (!link || !/^Journal du\s/i.test(title) || seen.has(link)) continue;
    seen.add(link);
    articles.push({ id: link, title, excerpt: 'Édition numérique du journal', content: '', link,
      date: '', category: 'Journal', categories: ['Journal'], premium: true });
  }
  return articles.slice(0, 20);
}

export function searchText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const MONTHS: Record<string, string> = { january: 'janvier', february: 'février', march: 'mars', april: 'avril', may: 'mai', june: 'juin',
  july: 'juillet', august: 'août', september: 'septembre', october: 'octobre', november: 'novembre', december: 'décembre' };

// The membership plugin prints English dates (« 7 February 2027 »).
export function frenchDate(value: string): string {
  return value.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, (month) => MONTHS[month.toLowerCase()]);
}
