export const BRAND = {
  name: 'Le Soft',
  red: '#9F2345',
  redDark: '#781721',
  siteUrl: 'https://lesoftpost.com',
  feedUrl: 'https://lesoftpost.com/feed/',
  loginUrl: 'https://lesoftpost.com/membership-login/',
  kioskUrl: 'https://lesoftpost.com/kiosque-du-soft/',
  supportEmail: 'support@lesoftpost.com',
  contactUrl: 'https://lesoftpost.com/contact/',
  privacyUrl: 'https://docs.google.com/document/d/1-Fb4z1K4HlRgBkLUmRemcQ600Y9Kdjsz7RmYx2CN3t0/preview',
};

export const RELEASE = '6';

export function officialUrl(value: string): string | undefined {
  try {
    const url = new URL(value, BRAND.siteUrl);
    if (url.hostname !== 'lesoftpost.com' && url.hostname !== 'www.lesoftpost.com') return;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.username || url.password || (url.port && url.port !== '443' && url.port !== '80')) return;
    url.protocol = 'https:';
    url.hostname = 'lesoftpost.com';
    return url.toString();
  } catch { return; }
}
