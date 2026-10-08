import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image as NativeImage, Linking, Pressable, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND, officialUrl, RELEASE } from './src/config';
import { extractImages, frenchDate, searchText } from './src/content';
import { enrichArticleImages, fetchArticles, fetchEditions, fetchText } from './src/rss';
import SiteWebView from './src/SiteWebView';
import { AccountSession, Article, ReaderTheme, WebRequest } from './src/types';

const light: ReaderTheme = {bg:'#F4F4F1',surface:'#FFFFFF',text:'#202224',muted:'#707477',line:'#E2E3DF',red:BRAND.red};
const dark: ReaderTheme = {bg:'#111415',surface:'#1D2122',text:'#F7F7F4',muted:'#A8AEAE',line:'#343A3B',red:'#B63759'};
type Store = { c:ReaderTheme; darkMode:boolean; changeDark:(v:boolean)=>void; articles:Article[]; loading:boolean; error:string; refresh:()=>void; favorites:string[]; toggle:(id:string)=>void; open:(uri:string,mode:WebRequest['mode'],article?:Article)=>void; session:AccountSession|null; logout:()=>void; fontScale:number; changeFont:()=>void; query:string; setQuery:(v:string)=>void; savedOnly:boolean; setSavedOnly:(v:boolean)=>void };
const Context = createContext<Store>(null!);
const useApp = () => useContext(Context);
const CACHE = 'le-soft-feed-v4';
export default function AppShell({children}:{children:React.ReactNode}) {
  const scheme = useColorScheme();
  const [darkMode,setDark] = useState(scheme === 'dark');
  const [fontScale,setFont] = useState(1);
  const [articles,setArticles] = useState<Article[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [favorites,setFavorites] = useState<string[]>([]);
  const [session,setSession] = useState<AccountSession|null>(null);
  const [query,setQuery] = useState('');
  const [savedOnly,setSavedOnly] = useState(false);
  const [visible,setVisible] = useState(false);
  const [request,setRequest] = useState<WebRequest>({uri:BRAND.loginUrl,mode:'account',requestId:0});
  const generation = useRef(0);
  const enrichment = useRef<AbortController|null>(null);
  const c = darkMode ? dark : light;
  async function refresh() {
    const turn = ++generation.current;
    enrichment.current?.abort();
    setLoading(true); setError('');
    try {
      const data = await fetchArticles();
      if (turn !== generation.current) return;
      setArticles(data);
      const controller = new AbortController(); enrichment.current = controller;
      void enrichArticleImages(data, (item) => {
        if (turn === generation.current) setArticles(previous => previous.map(a => a.id === item.id ? item : a));
      }, controller.signal);
    } catch { if (turn === generation.current) setError('Actualisation indisponible. Vérifiez votre connexion puis réessayez.'); }
    finally { if (turn === generation.current) setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const values = await Promise.all([CACHE,'le-soft-favorites-v1','le-soft-preferences-v4'].map(async key => [key, await AsyncStorage.getItem(key)]));
        if (!active) return;
        const cached = JSON.parse(values[0][1] || '[]');
        if (Array.isArray(cached)) setArticles(cached.filter(a => typeof a.title === 'string' && officialUrl(a.link)).slice(0,40));
        const saved = JSON.parse(values[1][1] || '[]');
        if (Array.isArray(saved)) setFavorites(saved.filter(x => typeof x === 'string'));
        const preferences = JSON.parse(values[2][1] || '{}');
        if (typeof preferences.dark === 'boolean') setDark(preferences.dark);
        if ([1,1.15,1.3].includes(preferences.font)) setFont(preferences.font);
      } catch { /* Storage is optional. */ }
      if (active) void refresh();
    })();
    // Cleanup invalidates pending refreshes, rather than capturing a render value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { active = false; generation.current++; enrichment.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!articles.length) return;
    const timer = setTimeout(() => { void AsyncStorage.setItem(CACHE,JSON.stringify(articles)).catch(()=>{}); },500);
    return () => clearTimeout(timer);
  }, [articles]);
  function preferences(d:boolean,f:number) { void AsyncStorage.setItem('le-soft-preferences-v4',JSON.stringify({dark:d,font:f})).catch(()=>{}); }
  function changeDark(v:boolean) { setDark(v); preferences(v,fontScale); }
  function changeFont() { const next = fontScale === 1 ? 1.15 : fontScale === 1.15 ? 1.3 : 1; setFont(next); preferences(darkMode,next); }
  function toggle(id:string) { setFavorites(old => { const next = old.includes(id) ? old.filter(v=>v!==id) : [...old,id]; void AsyncStorage.setItem('le-soft-favorites-v1',JSON.stringify(next)).catch(()=>{}); return next; }); }
  function open(uri:string,mode:WebRequest['mode'],article?:Article) {
    const safe = officialUrl(uri); if (!safe) return;
    // Reader app: a premium article opens the login page (no subscription offer), then the article once logged in.
    const locked = article?.premium && !session?.connected;
    setRequest({uri:locked?BRAND.loginUrl:safe,mode,article,requestId:Date.now()}); setVisible(true);
  }
  // Simple Membership logs out on ?swpm-logout=true, then the login page confirms the logged-out state.
  function logout() { setSession({connected:false,checkedAt:Date.now()}); open(`${BRAND.loginUrl}?swpm-logout=true`,'account'); }
  function onImage(id:string,image:string) { setArticles(old=>old.map(a=>a.id===id ? {...a,image,imageCandidates:[image,...(a.imageCandidates||[])]} : a)); }
  const store:Store = {c,darkMode,changeDark,articles,loading,error,refresh,favorites,toggle,open,session,logout,fontScale,changeFont,query,setQuery,savedOnly,setSavedOnly};
  return <Context.Provider value={store}><View style={[s.root,{backgroundColor:c.bg}]}><StatusBar style={darkMode?'light':'dark'}/><SafeAreaView style={s.root}><View style={[s.header,{borderColor:c.line}]}><NativeImage source={require('./assets/le-soft-wordmark.png')} resizeMode="contain" style={s.logo}/><View style={s.headerActions}><Button label={savedOnly?'Tous':'Favoris'} action={()=>{setSavedOnly(!savedOnly);router.replace('/');}}/><Button label="Actualiser" action={()=>void refresh()}/></View></View><View style={s.root}>{children}</View><Navigation/></SafeAreaView><SiteWebView visible={visible} request={request} theme={c} fontScale={fontScale} onClose={()=>setVisible(false)} onAccountStatus={setSession} onImage={onImage} favorite={!!request.article && favorites.includes(request.article.id)} onFavorite={()=>request.article && toggle(request.article.id)} onFontScale={changeFont}/></View></Context.Provider>;
}
function Button({label,action}:{label:string;action:()=>void}) { const {c} = useApp(); return <Pressable accessibilityRole="button" onPress={action} style={s.button}><Text style={{color:c.red,fontWeight:'600'}}>{label}</Text></Pressable>; }
function Navigation() {
 const {c} = useApp(); const path = usePathname();
 const tabs = [{path:'/',label:'Accueil'},{path:'/categories',label:'Catégories'},{path:'/kiosk',label:'Kiosque'},{path:'/account',label:'Mon compte'}] as const;
 return <View style={[s.nav,{backgroundColor:c.surface,borderColor:c.line}]}>{tabs.map(t=><Pressable key={t.path} accessibilityRole="tab" accessibilityState={{selected:path===t.path}} onPress={()=>router.replace(t.path)} style={s.tab}><Text style={{color:path===t.path?c.red:c.muted,fontWeight:path===t.path?'700':'400',fontSize:13}}>{t.label}</Text></Pressable>)}</View>;
}
function Cover({article}:{article:Article}) {
 const {c} = useApp(); const [index,setIndex] = useState(0); const [repairs,setRepairs] = useState<string[]>([]); const attempted = useRef(false);
 const candidates = useMemo(()=>[...new Set([article.image,...(article.imageCandidates||[]),...repairs].filter((x):x is string=>!!x))],[article.image,article.imageCandidates,repairs]);
 useEffect(()=>{
   if (!article.image || candidates[index] || attempted.current) return;
   attempted.current = true; let active = true;
   void fetchText(article.link,8000).then(html=>{if(active)setRepairs(extractImages(html,article.link));}).catch(()=>{});
   return ()=>{active=false;};
 },[article.image,article.link,index,candidates]);
 return candidates[index] ? <Image source={{uri:candidates[index]}} style={s.cover} contentFit="cover" cachePolicy="memory-disk" transition={150} accessibilityLabel="Illustration de l’article" onError={()=>setIndex(i=>i+1)}/> : <View style={[s.noCover,{backgroundColor:c.line}]}><Text style={{color:c.muted}}>Le Soft · Actualités</Text></View>;
}
function Card({article}:{article:Article}) {
 const {c,open,favorites,toggle,fontScale} = useApp();
 return <View style={[s.card,{backgroundColor:c.surface}]}><Pressable accessibilityRole="button" accessibilityLabel={`Lire ${article.title}`} onPress={()=>open(article.link,'article',article)}><Cover key={article.image||article.id} article={article}/><View style={s.cardBody}><View style={s.row}><Text style={{color:c.red,fontWeight:'600'}}>{article.category}</Text>{article.premium && <Text style={[s.badge,{backgroundColor:c.red}]}>Premium</Text>}</View><Text style={[s.articleTitle,{color:c.text,fontSize:22*fontScale}]}>{article.title}</Text><Text numberOfLines={3} style={{color:c.muted,fontSize:16*fontScale,lineHeight:24*fontScale}}>{article.excerpt}</Text><Text style={[s.date,{color:c.muted}]}>Le Soft · {article.date}</Text><Text style={{color:c.red,fontWeight:'700'}}>Lire la suite →</Text></View></Pressable><View style={s.save}><Button label={favorites.includes(article.id)?'Retirer des favoris':'Enregistrer'} action={()=>toggle(article.id)}/></View></View>;
}
export function FeedScreen({categories=false}:{categories?:boolean}) {
 const app = useApp(); const {c,articles,query,setQuery,savedOnly,favorites,loading,error,refresh} = app;
 const [category,setCategory] = useState('Tout');
 const choices = ['Tout',...new Set(articles.flatMap(a=>a.categories||[a.category]))];
 const filtered = articles.filter(a=>(!savedOnly||favorites.includes(a.id))&&(category==='Tout'||(a.categories||[a.category]).includes(category))&&searchText(`${a.title} ${a.excerpt}`).includes(searchText(query)));
 return <FlatList data={filtered} keyExtractor={a=>a.id} renderItem={({item})=><Card article={item}/>} refreshing={loading} onRefresh={refresh} contentContainerStyle={s.content} ListHeaderComponent={<View><Text style={[s.heading,{color:c.text}]}>{savedOnly?'Mes favoris':categories?'Catégories':'À la une'}</Text><TextInput value={query} onChangeText={setQuery} accessibilityLabel="Rechercher dans les articles" placeholder="Rechercher un article" placeholderTextColor={c.muted} style={[s.input,{color:c.text,backgroundColor:c.surface,borderColor:c.line}]}/>{categories && <View style={s.choices}>{choices.map(v=><Button key={v} label={v===category?`✓ ${v}`:v} action={()=>setCategory(v)}/>)}</View>}{error!=='' && <View><Text style={{color:c.muted}}>{error}</Text><Button label="Réessayer" action={refresh}/></View>}</View>} ListEmptyComponent={<View style={s.empty}>{loading?<ActivityIndicator color={c.red}/>:<Text style={{color:c.muted}}>{savedOnly?'Vos articles enregistrés apparaîtront ici.':'Aucun article trouvé.'}</Text>}</View>}/>;
}
export function AccountScreen() {
 const {c,session,logout,darkMode,changeDark,changeFont,fontScale,open} = useApp();
 return <FlatList data={[]} renderItem={()=>null} contentContainerStyle={s.content} ListHeaderComponent={<View><Text style={[s.heading,{color:c.text}]}>Mon compte</Text><View style={[s.panel,{backgroundColor:c.surface}]}><Text style={[s.articleTitle,{color:c.text}]}>{session?.connected?session.username:'Votre compte Le Soft'}</Text><Text style={{color:c.muted}}>{session?.connected?'Connecté sur le site officiel':'La connexion et votre abonnement sont vérifiés par Le Soft.'}</Text>{session?.connected && <View style={{gap:14,marginTop:22}}><Text style={{color:c.text}}>Statut : {session.status||'Non renseigné'}</Text><Text style={{color:c.text}}>Abonnement : {session.membership||'Non renseigné'}</Text><Text style={{color:c.text}}>Expiration : {session.expiration?frenchDate(session.expiration):'Non renseignée'}</Text></View>}<Button label={session?.connected?'Ouvrir mon compte':'Se connecter'} action={()=>open(BRAND.loginUrl,'account')}/>{session?.connected && <Button label="Se déconnecter" action={logout}/>}</View><View style={[s.panel,{backgroundColor:c.surface}]}><Text style={[s.articleTitle,{color:c.text}]}>Préférences</Text><View style={s.row}><Text style={{color:c.text}}>Mode sombre</Text><Switch accessibilityLabel="Mode sombre" value={darkMode} onValueChange={changeDark} trackColor={{true:c.red}}/></View><Button label={`Taille du texte : ${Math.round(fontScale*100)} %`} action={changeFont}/></View><View style={[s.panel,{backgroundColor:c.surface}]}><Text style={[s.articleTitle,{color:c.text}]}>Nous contacter</Text><Button label="support@lesoftpost.com" action={()=>{void Linking.openURL('mailto:support@lesoftpost.com');}}/><Button label="Site officiel et assistance" action={()=>open(BRAND.contactUrl,'site')}/></View><Text style={{color:c.muted,textAlign:'center'}}>Version 1.0.0 · Correctif {RELEASE}</Text></View>}/>;
}
export function KioskScreen() {
 const {c,open} = useApp(); const [editions,setEditions]=useState<Article[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
 async function load() { setLoading(true);try{setEditions(await fetchEditions());setError('');}catch{setError('Les éditions sont accessibles dans le kiosque officiel.');}finally{setLoading(false);} }
 useEffect(()=>{void Promise.resolve().then(load);},[]);
 return <FlatList data={editions} keyExtractor={a=>a.id} refreshing={loading} onRefresh={()=>void load()} contentContainerStyle={s.content} ListHeaderComponent={<View><Text style={[s.heading,{color:c.text}]}>Kiosque</Text><Text style={{color:c.muted}}>Les éditions du journal Le Soft</Text><Button label="Ouvrir le kiosque officiel" action={()=>open(BRAND.kioskUrl,'site')}/>{!!error&&<Text style={{color:c.muted}}>{error}</Text>}</View>} renderItem={({item})=><View style={[s.panel,{backgroundColor:c.surface}]}><Text style={[s.articleTitle,{color:c.text}]}>{item.title}</Text><Button label="Lire l’édition" action={()=>open(item.link,'journal',item)}/></View>}/>;
}
const s=StyleSheet.create({root:{flex:1},header:{paddingHorizontal:18,paddingVertical:8,borderBottomWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logo:{width:132,height:62},headerActions:{flexDirection:'row'},button:{minHeight:44,paddingHorizontal:10,justifyContent:'center'},content:{padding:18,paddingBottom:30,width:'100%',maxWidth:760,alignSelf:'center'},heading:{fontSize:32,fontWeight:'800',marginVertical:18},input:{minHeight:48,borderWidth:1,borderRadius:12,paddingHorizontal:15,marginBottom:20,fontSize:16},card:{borderRadius:18,overflow:'hidden',marginBottom:22},cover:{height:225,width:'100%'},noCover:{height:75,alignItems:'center',justifyContent:'center'},cardBody:{padding:20,gap:12},articleTitle:{fontSize:22,fontWeight:'700',lineHeight:29},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},badge:{color:'#FFFFFF',paddingHorizontal:12,paddingVertical:5,borderRadius:20,fontSize:12},date:{fontSize:13,marginTop:5},save:{alignSelf:'flex-end',paddingRight:10,paddingBottom:5},nav:{flexDirection:'row',borderTopWidth:1,minHeight:58},tab:{flex:1,minHeight:58,alignItems:'center',justifyContent:'center'},panel:{padding:20,borderRadius:18,marginBottom:20,gap:12},empty:{padding:30,alignItems:'center'},choices:{flexDirection:'row',flexWrap:'wrap',marginBottom:15}});
