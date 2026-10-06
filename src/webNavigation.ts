import { BRAND, officialUrl } from './config';

export function freshPage(uri: string, requestId: number): string {
  const trusted = officialUrl(uri);
  if (!trusted) return BRAND.loginUrl;
  const url = new URL(trusted);
  url.searchParams.set('lesoft_app', String(requestId));
  return url.toString();
}

export function navigationKind(uri: string): 'official' | 'purchase' | 'external' | 'blocked' {
  if (uri === 'about:blank') return 'official';
  try {
    const url = new URL(uri);
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') return 'external';
    if (url.protocol !== 'https:') return 'blocked';
    if (!officialUrl(uri)) return 'external';
    if (/membership-join|swpm_payment|checkout|\/cart\/?$/i.test(url.pathname + url.search)) return 'purchase';
    return 'official';
  } catch { return 'blocked'; }
}

export function sameArticle(uri: string, articleUri: string): boolean {
  const left = officialUrl(uri);
  const right = officialUrl(articleUri);
  return Boolean(left && right && new URL(left).pathname === new URL(right).pathname);
}
