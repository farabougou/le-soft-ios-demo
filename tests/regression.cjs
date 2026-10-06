const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {parseFeed,extractImages,parseKiosk,cleanExcerpt}=require('../src/content.ts');
const {officialUrl}=require('../src/config.ts');
const {createSiteScript}=require('../src/siteBridge.ts');
const {navigationKind}=require('../src/webNavigation.ts');
const theme={bg:'#fff',surface:'#fff',text:'#111',muted:'#777',line:'#eee',red:'#9f2345'};
const link='https://lesoftpost.com/2026/10/05/article/';
const feed=`<rss><channel><item><title><![CDATA[À la une &amp; Mali]]></title><link>${link}</link><pubDate>Mon, 05 Oct 2026 23:00:00 +0000</pubDate><category>À la une</category><description><![CDATA[<p>Texte public. La suite est disponible uniquement pour les abonnés.</p>]]></description><media:content url="http://lesoftpost.com/wp-content/uploads/photo.jpeg"/></item><item><title>Untrusted</title><link>https://evil.example/article</link></item></channel></rss>`;
const parsed=parseFeed(feed);assert.equal(parsed.length,1);assert.equal(parsed[0].id,link);assert.equal(parsed[0].content,'');assert.equal(parsed[0].excerpt,'Texte public.');assert.equal(parsed[0].premium,true);assert.match(parsed[0].date,/5/);assert.equal(parsed[0].image,'https://lesoftpost.com/wp-content/uploads/photo.jpeg');
assert.deepEqual(extractImages(`<meta content="/wp-content/cover.webp" property="og:image"><img src="data:xxx" data-srcset="/small.jpg 100w, /large.jpg 1000w">`),['https://lesoftpost.com/wp-content/cover.webp','https://lesoftpost.com/large.jpg','https://lesoftpost.com/small.jpg']);
assert.equal(cleanExcerpt('Bonjour. This content is for members only. Footer'),'Bonjour.');
assert.equal(officialUrl('https://lesoftpost.com.evil.example/x'),undefined);
assert.equal(navigationKind('javascript:alert(1)'),'blocked');
assert.equal(navigationKind('https://lesoftpost.com/membership-join/'),'purchase');
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
 const guest=fixture('<input type="password">','account',3);assert.equal(guest.messages.at(-1).connected,false);guest.dom.window.close();
 const hostile=fixture('<input type="password">','account',4,'https://evil.example/');assert.equal(hostile.messages.length,0);hostile.dom.window.close();
 console.log('PASS: feed, images, source trust, kiosk, authenticated labels, reader isolation and preserved paywall');
}
browserTests().catch(e=>{console.error(e);process.exit(1);});
