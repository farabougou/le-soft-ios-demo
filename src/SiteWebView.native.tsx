import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { officialUrl } from './config';
import { imageUrl } from './content';
import { createSiteScript } from './siteBridge';
import { AccountSession, ReaderTheme, WebRequest } from './types';
import { freshPage, navigationKind, sameArticle } from './webNavigation';

// Appended to the normal Safari user agent so WordPress still sees a mobile browser.
// The server hides every subscription offer when it sees LeSoftApp-iOS.
const APP_USER_AGENT = Platform.OS === 'ios' ? 'LeSoftApp-iOS/1.0' : 'LeSoftApp-Android/1.0';

export type SiteProps = {
  visible: boolean; request: WebRequest; theme: ReaderTheme; fontScale: number;
  onClose: () => void; onAccountStatus: (status: AccountSession) => void;
  onImage: (id: string, image: string) => void; favorite: boolean; onFavorite: () => void;
  onFontScale: () => void;
};

export default function SiteWebView(props: SiteProps) {
  const { visible, request, theme, fontScale, onClose, onAccountStatus } = props;
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUri, setCurrentUri] = useState(request.uri);
  const pendingArticle = useRef<string | null>(null);
  const source = useMemo(() => ({ uri: freshPage(request.uri, request.requestId),
    headers: { 'Cache-Control': 'no-cache' } }), [request.uri, request.requestId]);
  const script = useMemo(() => createSiteScript(request, theme, fontScale), [request, theme, fontScale]);

  useEffect(() => {
    // A premium article opened while logged out starts on the login page and comes back after login.
    pendingArticle.current = request.article && /membership-login/i.test(request.uri) ? request.article.link : null;
  }, [request.requestId, request.uri, request.article]);
  useEffect(() => { web.current?.injectJavaScript(script); }, [script]);
  useEffect(() => {
    if (!visible) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) web.current?.goBack(); else onClose();
      return true;
    });
    return () => back.remove();
  }, [visible, canGoBack, onClose]);

  function allow(url: string, isTopFrame?: boolean): boolean {
    const kind = navigationKind(url);
    // Purchase pages and payment providers are refused first, even inside an iframe.
    if (kind === 'purchase') {
      if (isTopFrame !== false) Alert.alert('Espace abonné', 'Cette application permet de lire les contenus de votre abonnement existant. Pour une question sur votre compte, contactez Le Soft depuis l’onglet Mon compte.');
      return false;
    }
    if (isTopFrame === false) return true;
    if (kind === 'blocked') return false;
    if (kind === 'external') {
      if (visible) Linking.openURL(url).catch(() => Alert.alert('Lien indisponible', 'Impossible d’ouvrir ce lien.'));
      return false;
    }
    // Login, password reset and account pages are on lesoftpost.com and stay in the app.
    if (/membership-login/i.test(url) && request.article) pendingArticle.current = request.article.link;
    return true;
  }

  const article = request.article;
  return <View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[st.layer, { backgroundColor: theme.bg, opacity: visible ? 1 : 0, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={[st.header, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le lecteur" style={st.action}>
        <Ionicons name="close" size={25} color={theme.text} />
      </Pressable>
      <Image source={require('../assets/le-soft-wordmark.png')} contentFit="contain" style={st.logo} accessibilityLabel="Le Soft" />
      {article ? <View style={st.actions}>
        <Pressable onPress={props.onFontScale} accessibilityRole="button" accessibilityLabel="Changer la taille du texte" style={st.action}><Text style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>Aa</Text></Pressable>
        <Pressable onPress={props.onFavorite} accessibilityRole="button" accessibilityLabel={props.favorite ? 'Retirer des favoris' : 'Enregistrer l’article'} style={st.action}><Ionicons name={props.favorite ? 'bookmark' : 'bookmark-outline'} size={22} color={props.favorite ? theme.red : theme.text} /></Pressable>
      </View> : <Pressable onPress={() => web.current?.reload()} accessibilityRole="button" accessibilityLabel="Actualiser la page" style={st.action}><Ionicons name="refresh" size={22} color={theme.text} /></Pressable>}
    </View>
    <View style={st.body}>
      <WebView ref={web} source={source} style={{ flex: 1, backgroundColor: theme.bg }}
        applicationNameForUserAgent={APP_USER_AGENT}
        originWhitelist={['https://*', 'mailto:*', 'tel:*', 'about:blank']}
        sharedCookiesEnabled thirdPartyCookiesEnabled domStorageEnabled javaScriptEnabled
        incognito={false} cacheEnabled={false} setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures allowsLinkPreview={false}
        injectedJavaScriptBeforeContentLoaded={script}
        injectedJavaScript={script}
        onShouldStartLoadWithRequest={({ url, isTopFrame }) => allow(url, isTopFrame)}
        onLoadStart={() => { setLoading(true); setError(false); }}
        onLoadEnd={() => { setLoading(false); web.current?.injectJavaScript(script); }}
        onError={() => { setError(true); setLoading(false); }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 400 && sameArticle(nativeEvent.url, currentUri)) { setError(true); setLoading(false); }
        }}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onNavigationStateChange={(state) => { setCanGoBack(state.canGoBack); setCurrentUri(state.url); }}
        onMessage={({ nativeEvent }) => {
          try {
            const payload = JSON.parse(nativeEvent.data);
            if (!officialUrl(nativeEvent.url) || !officialUrl(payload.url || '')) return;
            if (payload.requestId !== request.requestId) return;
            if (payload.type === 'account-status' && /membership-login/i.test(new URL(payload.url).pathname) && typeof payload.connected === 'boolean') {
              const string = (value: unknown) => typeof value === 'string' ? value.slice(0, 180) : undefined;
              onAccountStatus({ connected: payload.connected, username: string(payload.username), status: string(payload.status),
                membership: string(payload.membership), expiration: string(payload.expiration), checkedAt: Date.now() });
              if (payload.connected && pendingArticle.current) {
                const target = freshPage(pendingArticle.current, Date.now());
                pendingArticle.current = null;
                web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(target)}); true;`);
              }
            } else if (payload.type === 'article-image' && article && sameArticle(payload.url, article.link)) {
              const image = imageUrl(payload.image);
              if (image) props.onImage(article.id, image);
            }
          } catch { /* Ignore messages outside this bridge. */ }
        }} />
      {loading && <View pointerEvents="none" style={[st.loading, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.red} /><Text style={{ color: theme.muted, marginTop: 12 }}>Chargement…</Text></View>}
      {error && <View style={[st.loading, { backgroundColor: theme.bg }]}>
        <Ionicons name="cloud-offline-outline" size={36} color={theme.muted} />
        <Text style={[st.errorTitle, { color: theme.text }]}>La page n’a pas pu être chargée</Text>
        <Text style={[st.errorText, { color: theme.muted }]}>Vérifiez votre connexion puis réessayez.</Text>
        <Pressable onPress={() => { setError(false); setLoading(true); web.current?.reload(); }} style={[st.retry, { backgroundColor: theme.red }]} accessibilityRole="button"><Text style={st.retryText}>Réessayer</Text></Pressable>
      </View>}
    </View>
    <View style={[st.toolbar, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Pressable onPress={() => canGoBack && web.current?.goBack()} disabled={!canGoBack} accessibilityRole="button" accessibilityLabel="Page précédente" style={st.action}><Ionicons name="chevron-back" size={22} color={canGoBack ? theme.text : theme.muted} /></Pressable>
      <View style={st.domain}><Ionicons name="lock-closed-outline" size={13} color={theme.muted} /><Text style={{ color: theme.muted, fontSize: 12 }}>lesoftpost.com</Text></View>
      <Pressable onPress={() => Share.share({ message: `${article?.title || 'Le Soft'}\n${article?.link || currentUri}`, url: article?.link || currentUri }).catch(() => undefined)} accessibilityRole="button" accessibilityLabel="Partager" style={st.action}><Ionicons name="share-outline" size={22} color={theme.text} /></Pressable>
    </View>
  </View>;
}

const st = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 },
  header: { minHeight: 62, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row' }, logo: { width: 104, height: 36, backgroundColor: '#FFF', borderRadius: 3 },
  body: { flex: 1 }, loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 25 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginTop: 18, textAlign: 'center' }, errorText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  retry: { paddingHorizontal: 25, paddingVertical: 14, borderRadius: 10, marginTop: 20 }, retryText: { color: '#FFF', fontWeight: '700' },
  toolbar: { minHeight: 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth },
  domain: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
