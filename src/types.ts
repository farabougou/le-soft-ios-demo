export type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  link: string;
  date: string;
  publishedAt?: string;
  category: string;
  categories?: string[];
  image?: string;
  imageCandidates?: string[];
  premium: boolean;
};

export type TabKey = 'home' | 'categories' | 'kiosk' | 'account';

export type AccountSession = {
  connected: boolean;
  username?: string;
  status?: string;
  membership?: string;
  expiration?: string;
  checkedAt: number;
};

export type WebRequest = {
  uri: string;
  mode: 'account' | 'article' | 'journal' | 'site';
  article?: Article;
  requestId: number;
};

export type ReaderTheme = {
  bg: string; surface: string; text: string; muted: string; line: string; red: string;
};
