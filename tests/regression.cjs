const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
require.extensions['.tsx'] = require.extensions['.ts'];
const {parseFeed,extractImages,parseKiosk,cleanExcerpt,frenchDate}=require('../src/content.ts');
const {redirectSystemPath}=require('../src/app/+native-intent.tsx');
const {officialUrl}=require('../src/config.ts');
const {createSiteScript}=require('../src/siteBridge.ts');
const {navigationKind,incomingPage}=require('../src/webNavigation.ts');
const theme={bg:'#fff',surface:'#fff',text:'#111',muted:'#777',line:'#eee',red:'#9f2345'};
const link='https://lesoftpost.com/2026/10/05/article/';
const feed=`<rss><channel><item><title><![CDATA[À la une &amp; Mali]]></title><link>${link}</link><pubDate>Mon, 05 Oct 2026 23:00:00 +0000</pubDate><category>À la une</category><description><![CDATA[<p>Texte public. La suite est disponible uniquement pour les abonnés.</p>]]></description><media:content url="http://lesoftpost.com/wp-content/uploads/photo.jpeg"/></item><item><title>Untrusted</title><link>https://evil.example/article</link></item></channel></rss>`;
const parsed=parseFeed(feed);assert.equal(parsed.length,1);assert.equal(parsed[0].id,link);assert.equal(parsed[0].content,'');assert.equal(parsed[0].excerpt,'Texte public.');assert.equal(parsed[0].premium,true);assert.match(parsed[0].date,/5/);assert.equal(parsed[0].image,'https://lesoftpost.com/wp-content/uploads/photo.jpeg');
assert.deepEqual(extractImages(`<meta content="/wp-content/cover.webp" property="og:image"><img src="data:xxx" data-srcset="/small.jpg 100w, /large.jpg 1000w">`),['https://lesoftpost.com/wp-content/cover.webp','https://lesoftpost.com/large.jpg','https://lesoftpost.com/small.jpg']);
assert.equal(cleanExcerpt('Bonjour. This content is for members only. Footer'),'Bonjour.');
assert.equal(frenchDate('7 February 2027'),'7 février 2027');
for (const [input,route] of [['https://lesoftpost.com/2026/10/05/article/','/'],['https://lesoftpost.com/kiosk','/kiosk'],['/account','/account'],['lesoft://categories','/'],['/categories?x=1','/categories']]) assert.equal(redirectSystemPath({path:input,initial:true}),route);
assert.equal(officialUrl('https://lesoftpost.com.evil.example/x'),undefined);
assert.equal(navigationKind('javascript:alert(1)'),'blocked');
assert.equal(incomingPage('https://www.lesoftpost.com/2026/10/05/article/'),'https://lesoftpost.com/2026/10/05/article/');
assert.equal(incomingPage('https://lesoftpost.com/'),undefined);assert.equal(incomingPage('https://lesoftpost.com/membership-join/'),undefined);assert.equal(incomingPage('lesoft://categories'),undefined);assert.equal(incomingPage('https://evil.example/x'),undefined);
assert.equal(navigationKind('https://lesoftpost.com/membership-join/'),'purchase');
assert.equal(navigationKind('https://lesoftpost.com/abonnement/'),'purchase');
assert.equal(navigationKind('https://lesoftpost.com/s-abonner/'),'purchase');
assert.equal(navigationKind('https://lesoftpost.com/membership-login/?swpm_payment_button=1'),'purchase');
assert.equal(navigationKind('https://checkout.stripe.com/c/pay/x'),'purchase');
assert.equal(navigationKind('https://pay.wave.com/m/x'),'purchase');
assert.equal(navigationKind('https://lesoftpost.com/membership-login/'),'official');
assert.equal(navigationKind('https://lesoftpost.com/membership-login/password-reset/'),'official');
assert.equal(navigationKind('https://lesoftpost.com/2026/10/05/hausse-des-abonnements-internet/'),'official');
assert.equal(navigationKind('https://www.orange.ml/actualites'),'external');
assert.equal(parseKiosk('<a href="/journal/">Journal du 6 octobre</a><a href="/journal/">Journal du 6 octobre</a>').length,1);
async function browserTests(){
 const {JSDOM}=require('jsdom');
 function fixture(html,mode,id,url='https://lesoftpost.com/membership-login/') {
  const messages=[];const dom=new JSDOM(html,{url,runScripts:'outside-only'});
  Object.defineProperty(dom.window.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
  dom.window.ReactNativeWebView={postMessage:m=>messages.push(JSON.parse(m))};
  dom.window.eval(createSiteScript({uri:link,mode,requestId:id},theme,1.15));
  return {dom,messages};
 }
 const account=fixture('<body>Connecté en tant que\nmohamed.fofana\nStatut du Compte\nActif\nAdhésion\nGold\nExpiration du compte\n7 February 2027</body>','account',1);
 assert.equal(account.messages.at(-1)?.connected,true,'account bridge detects server session');assert.equal(account.messages.at(-1).membership,'Gold');assert.equal(account.messages.at(-1).username,'mohamed.fofana');account.dom.window.close();
 const reader=fixture('<html><head></head><body><header>Website nav</header><main><article class="type-post"><h1>Article</h1><div class="entry-content"><img class="wp-post-image" src="https://lesoftpost.com/cover.jpg"><p>Protected server content</p><p>This content is for members only</p></div></article><aside>sidebar</aside></main></body></html>','article',2,link);
 const doc=reader.dom.window.document;
 assert.equal(doc.querySelector('article').getAttribute('data-le-soft-article'),'');assert.equal(reader.dom.window.getComputedStyle(doc.querySelector('header')).display,'none');assert.match(doc.querySelector('article').textContent,/This content is for members only/);assert.ok(doc.querySelector('article img'));assert.equal(reader.messages.at(-1).type,'article-image');reader.dom.window.close();
 const home=fixture(`<html><head></head><body><nav><ul><li class="menu-item"><a href="/">Accueil</a></li><li class="menu-item"><a href="https://lesoftpost.com/s-abonner/">S’abonner</a></li><li class="menu-item"><a href="/membership-login/">Mon Compte</a></li><li class="menu-item"><a href="/mon-abonnement/">Mon abonnement</a></li></ul></nav>
  <div class="offre"><h3>Formule mensuelle : 2 000 FCFA / mois</h3><p>Payez par Orange Money ou Wave</p><img alt="Orange Money" src="/wp-content/orange-money.png"><a class="btn" href="/membership-join/?level=2">Choisir</a></div>
  <h2 class="headline">Budget 2027 : 3 000 milliards FCFA votés</h2><a href="https://lesoftpost.com/2026/10/05/abonnements-internet-en-hausse/">Les abonnements internet en hausse</a></body></html>`,'site',5,'https://lesoftpost.com/');
 const hd=home.dom.window.document;const shown=sel=>home.dom.window.getComputedStyle(hd.querySelector(sel)).display!=='none';
 assert.ok(!shown('a[href*="s-abonner"]'),'menu S’abonner hidden');assert.ok(!shown('.offre h3'),'price hidden');assert.ok(!shown('.offre p'),'payment methods hidden');assert.ok(!shown('.offre img'),'payment logo hidden');assert.ok(!shown('.offre a'),'join button hidden');
 assert.ok(shown('a[href="/"]'));assert.ok(shown('a[href="/membership-login/"]'));assert.ok(shown('a[href="/mon-abonnement/"]'),'account management kept');assert.ok(shown('.headline'),'news FCFA kept');assert.ok(shown('a[href*="abonnements-internet"]'),'article about subscriptions kept');home.dom.window.close();
 const paywall=fixture('<html><head></head><body><article class="type-post"><h1>Article</h1><div class="entry-content"><p>Le Mali paie 50 milliards FCFA.</p><p>La suite est réservée aux abonnés. <a href="/membership-login/">Connectez-vous</a> ou <a href="/membership-join/">abonnez-vous pour 2 000 FCFA par mois</a>.</p></div></article></body></html>','article',6,link);
 const pd=paywall.dom.window.document;const pshown=el=>paywall.dom.window.getComputedStyle(el).display!=='none';const ps=pd.querySelectorAll('.entry-content p');
 assert.ok(pshown(ps[0]),'article FCFA kept');assert.ok(pshown(pd.querySelector('a[href="/membership-login/"]'))||!pshown(ps[1]));assert.ok(!pshown(pd.querySelector('a[href="/membership-join/"]')),'paywall join link hidden');assert.doesNotMatch(ps[1].textContent.replace(/abonnez-vous.*?mois/,''),/ ou\s*\.$/,'no dangling « ou »');paywall.dom.window.close();
 const cover=fixture('<html><head><title>Journal du 02 octobre 2026 – Numéro 407 | Le soft</title></head><body><img id="une" src="https://lesoftpost.com/une.jpg"><img id="photo" src="https://lesoftpost.com/photo.jpg"></body></html>','site',7,'https://lesoftpost.com/2026/10/01/journal-du-02-octobre-2026/');
 const cd=cover.dom.window.document;const size=(el,w,h)=>{Object.defineProperty(el,'naturalWidth',{value:w});Object.defineProperty(el,'naturalHeight',{value:h});};
 size(cd.getElementById('une'),800,1130);size(cd.getElementById('photo'),1200,800);cover.dom.window.__leSoftCheck();
 assert.ok(cd.getElementById('une').hasAttribute('data-le-soft-cover'),'front page footer cropped');assert.ok(!cd.getElementById('photo').hasAttribute('data-le-soft-cover'),'landscape photo untouched');cover.dom.window.close();
 const guest=fixture('<input type="password">','account',3);assert.equal(guest.messages.at(-1).connected,false);guest.dom.window.close();
 const hostile=fixture('<input type="password">','account',4,'https://evil.example/');assert.equal(hostile.messages.length,0);hostile.dom.window.close();
 console.log('PASS: feed, images, source trust, kiosk, authenticated labels, reader isolation, preserved paywall and hidden offers');
}
browserTests().catch(e=>{console.error(e);process.exit(1);});
