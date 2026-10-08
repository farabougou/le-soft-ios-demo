import { BRAND, officialUrl } from './config';

export function freshPage(uri: string, requestId: number): string {
  const trusted = officialUrl(uri);
  if (!trusted) return BRAND.loginUrl;
  const url = new URL(trusted);
  url.searchParams.set('lesoft_app', String(requestId));
  return url.toString();
}

// Payment providers the app must never open (App Store guideline 3.1.1).
// Add the exact domain of any new provider used by lesoftpost.com.
const PAYMENT_HOSTS = ['stripe.com', 'paypal.com', 'cinetpay.com', 'paydunya.com', 'wave.com',
  'flutterwave.com', 'fedapay.com', 'kkiapay.me', 'orange-sonatel.com'];

// Purchase pages on the official site. Only the first path segment is checked,
// so an article slug such as /2026/10/05/abonnements-internet/ stays readable.
const PURCHASE_PATH = /^\/(membership-join|s-abonner|abonnements?|tarifs?|offres?|pricing|checkout|cart|panier|boutique|shop|produits?|product|product-category|product-tag|commande)(\/|$)/i;
const PURCHASE_QUERY = /swpm_payment|swpm_paypal|add-to-cart/i;

export function navigationKind(uri: string): 'official' | 'purchase' | 'external' | 'blocked' {
  if (uri === 'about:blank') return 'official';
  try {
    const url = new URL(uri);
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') return 'external';
    if (url.protocol !== 'https:') return 'blocked';
    const host = url.hostname.toLowerCase();
    if (PAYMENT_HOSTS.some((domain) => host === domain || host.endsWith('.' + domain))) return 'purchase';
    if (!officialUrl(uri)) return 'external';
    if (PURCHASE_PATH.test(url.pathname) || PURCHASE_QUERY.test(url.search)) return 'purchase';
    return 'official';
  } catch { return 'blocked'; }
}

export function sameArticle(uri: string, articleUri: string): boolean {
  const left = officialUrl(uri);
  const right = officialUrl(articleUri);
  return Boolean(left && right && new URL(left).pathname === new URL(right).pathname);
}

// A lesoftpost.com link opened from WhatsApp, Mail… (universal link): the page to show in the reader.
// The home page only opens the app; purchase pages are never opened.
export function incomingPage(uri: string | null | undefined): string | undefined {
  if (!uri) return;
  const trusted = officialUrl(uri);
  if (!trusted || navigationKind(trusted) !== 'official') return;
  return new URL(trusted).pathname.replace(/\/+$/, '') ? trusted : undefined;
}
