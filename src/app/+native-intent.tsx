// lesoftpost.com links (universal links) and lesoft:// links open a known tab, never an "unmatched route" screen.
const ROUTES = ['/', '/categories', '/kiosk', '/account'];

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const route = path.replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    return ROUTES.includes(route) ? route : '/';
  } catch {
    return '/';
  }
}
