import { ReaderTheme, WebRequest } from './types';

// This bridge reads visible account labels and styles the server's rendered page.
// It never reads document.cookie, passwords, tokens, or protected API responses.
export function createSiteScript(request: WebRequest, theme: ReaderTheme, fontScale = 1): string {
  const options = JSON.stringify({ mode: request.mode, theme, fontScale, requestId: request.requestId });
  return String.raw`
(function () {
  var options = ${options};
  if (!/^https:\/\/(www\.)?lesoftpost\.com(?:\/|$)/i.test(location.href)) return true;
  window.__leSoftOptions = options;
  
  function send(payload) {
    payload.url = location.href;
    payload.requestId = window.__leSoftOptions.requestId;
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  // Reader app (App Store 3.1.3(a)): no price, offer or payment method is shown in the app.
  // Works without any server change; the optional WordPress plugin in server/wordpress does the same server-side.
  var OFFER_LINK = /s['’]\s?abonner|abonnez|nos offres|tarif|rejoindre|join us|souscri|payer|paiement|acheter|orange money|moov money/i;
  // Same rule as webNavigation.ts: only the first path segment, so article slugs about « abonnements » stay.
  var OFFER_PATH = /^\/(membership-join|s-abonner|abonnements?|tarifs?|offres?|pricing|checkout|cart|panier)(\/|$)/i;
  function offerHref(href) {
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return false;
    try { var u = new URL(href, location.href); return /swpm_payment|swpm_paypal|add-to-cart/i.test(u.search) || (/(^|\.)lesoftpost\.com$/i.test(u.hostname) && OFFER_PATH.test(u.pathname)); }
    catch (_) { return false; }
  }
  var PRICE = /(F\s?CFA|XOF).{0,40}(mois|\ban\b|année|semaine|jour|abonn)|(abonn|offre|formule|tarif|forfait|accès illimité).{0,80}(\d\s?F\s?CFA|\d\s?XOF)|orange money|moov money|\bwave\b.{0,20}(paiement|payer)/i;
  function markOffer(element) {
    var target = element.closest('li, .menu-item, .wp-block-button') || element;
    if (target === document.body || target.contains(document.querySelector('[data-le-soft-article]'))) target = element;
    target.setAttribute('data-le-soft-offer', '');
    // « Connectez-vous ou abonnez-vous. » becomes « Connectez-vous. » instead of « Connectez-vous ou . »
    var before = target.previousSibling;
    if (before && before.nodeType === 3) before.nodeValue = before.nodeValue.replace(/\s+(ou|or)\s*$/i, '');
  }
  // Printed front pages end with « En kiosque : 300 f · Pour s'abonner… » and QR codes: crop that footer band.
  function cropCovers() {
    // Kiosk list, or an edition page such as « Journal du 02 octobre 2026 – Numéro 407 ».
    var edition = /kiosque|journal|num[eé]ro|[eé]dition/i;
    if (window.__leSoftOptions.mode !== 'journal' && !edition.test(decodeURIComponent(location.pathname)) && !edition.test(document.title)) return;
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (img) {
      if (img.hasAttribute('data-le-soft-cover') || !img.naturalWidth) return;
      if (img.naturalWidth >= 300 && img.naturalHeight > img.naturalWidth * 1.25) img.setAttribute('data-le-soft-cover', '');
    });
  }
  function hideSubscriptions() {
    var root = document.head || document.documentElement;
    if (!root) return;
    if (!document.getElementById('le-soft-compliance-style')) {
      var style = document.createElement('style');
      style.id = 'le-soft-compliance-style';
      style.textContent = '[data-le-soft-offer], a[href*="membership-join"], a[href*="swpm_payment"], a[href*="checkout"],' +
        ' a[href*="/s-abonner"], form[action*="swpm_payment"], form[action*="membership-join"],' +
        ' .pricing-table, .subscription-plan, .lesoft-pricing, .lesoft-no-app, button[name="commander"] { display: none !important; }' +
        ' img[data-le-soft-cover] { clip-path: inset(0 0 8.5% 0) !important; }';
      root.appendChild(style);
    }
    if (!document.body) return;
    if (!document.body.classList.contains('is-ios-app')) document.body.classList.add('is-ios-app');
    cropCovers();
    // Links and buttons that lead to a purchase, wherever they are (menu, footer, paywall message).
    Array.prototype.forEach.call(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'), function (el) {
      if (el.hasAttribute('data-le-soft-offer')) return;
      var label = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
      var href = el.getAttribute('href') || '';
      if (/membership-login|logout|password/i.test(href)) return;
      // Inside an article only the destination counts, so a link titled « payer la dette » stays.
      var inArticle = el.closest('[data-le-soft-article] .entry-content, [data-le-soft-article] .post-content');
      if ((!inArticle && label && label.length < 80 && OFFER_LINK.test(label)) || offerHref(href)) markOffer(el);
    });
    // Short blocks that show a price or a payment method. News text such as « 500 milliards FCFA » is kept.
    Array.prototype.forEach.call(document.querySelectorAll('p, li, td, th, span, small, strong, b, h2, h3, h4, h5, h6, label, figcaption, img'), function (el) {
      if (el.hasAttribute('data-le-soft-offer')) return;
      var text = el.tagName === 'IMG' ? (el.getAttribute('alt') || '') + ' ' + (el.getAttribute('src') || '') : (el.textContent || '');
      if (text.length > 240) return;
      if (el.closest('[data-le-soft-article] .entry-content, [data-le-soft-article] .post-content') && !/abonn|offre|formule|tarif/i.test(text)) return;
      if (PRICE.test(text) || (el.tagName === 'IMG' && /orange-?money|wave|moov/i.test(text))) markOffer(el);
    });
  }

  function readAccount() {
    var path = location.pathname;
    if (!/membership-login/i.test(path)) return;
    var text = (document.body ? document.body.innerText : '').replace(/\u00a0/g, ' ');
    var user = text.match(/Connect(?:é|e) en tant que[\s:]+([^\n]+)/i);
    var payload;
    function label(pattern) { var m = text.match(pattern); return m ? m[1].trim().slice(0, 180) : undefined; }
    if (user) {
      payload = {type: 'account-status', connected: true, username: user[1].trim().slice(0,180),
        status: label(/Statut du Compte[\s:]+([^\n]+)/i),
        membership: label(/Adhésion[\s:]+([^\n]+)/i),
        expiration: label(/Expiration du compte[\s:]+([^\n]+)/i)};
    } else if (document.querySelector('input[type="password"]')) {
      payload = {type: 'account-status', connected: false};
    }
    if (payload) {
      var key = JSON.stringify(payload);
      if (window.__leSoftLastAccount !== key) { window.__leSoftLastAccount = key; send(payload); }
    }
  }

  function styleReader() {
    var opts = window.__leSoftOptions;
    if (!/^(article|journal)$/.test(opts.mode) || /membership-login/i.test(location.pathname)) return;
    var entry = document.querySelector('article.type-post, article.post, article.hentry');
    if (!entry) {
      var content = document.querySelector('.entry-content, .post-content');
      if (content) entry = content.closest('article') || content.parentElement;
    }
    if (!entry || !entry.querySelector('.entry-content, .post-content, h1')) return;
    entry.setAttribute('data-le-soft-article', '');
    // Isolate the article without copying its content or changing entitlement checks.
    var branch = entry;
    while (branch && branch !== document.body) {
      if (branch.parentElement) {
        Array.prototype.forEach.call(branch.parentElement.children, function (sibling) {
          if (sibling !== branch && !/^(SCRIPT|STYLE|LINK|META)$/.test(sibling.tagName)) sibling.setAttribute('data-le-soft-hidden', '');
        });
        branch.parentElement.setAttribute('data-le-soft-path', '');
      }
      branch = branch.parentElement;
    }
    var c = opts.theme;
    var size = Math.round(18 * opts.fontScale);
    var css = '[data-le-soft-hidden]{display:none!important}' +
      'html,body{margin:0!important;padding:0!important;background:'+c.bg+'!important;color:'+c.text+'!important;overflow-x:hidden!important}' +
      '[data-le-soft-path]{float:none!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;min-height:0!important;display:block!important;background:'+c.bg+'!important}' +
      '[data-le-soft-article]{box-sizing:border-box!important;float:none!important;width:100%!important;max-width:760px!important;margin:0 auto!important;padding:20px 22px 60px!important;background:'+c.bg+'!important;color:'+c.text+'!important;border:0!important;box-shadow:none!important;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif!important}' +
      '[data-le-soft-article] .entry-content,[data-le-soft-article] .post-content{color:'+c.text+'!important;font-size:'+size+'px!important;line-height:1.75!important;overflow-wrap:anywhere!important}' +
      '[data-le-soft-article] p,[data-le-soft-article] li{font-size:'+size+'px!important;line-height:1.75!important;color:'+c.text+'!important}' +
      '[data-le-soft-article] h1{font-size:'+Math.round(29*opts.fontScale)+'px!important;line-height:1.22!important;letter-spacing:-.6px!important;color:'+c.text+'!important;margin:8px 0 20px!important}' +
      '[data-le-soft-article] h2,[data-le-soft-article] h3{line-height:1.35!important;color:'+c.text+'!important}' +
      '[data-le-soft-article] img{max-width:100%!important;height:auto!important;object-fit:contain!important;border-radius:12px}' +
      '[data-le-soft-article] a{color:'+c.red+'!important;overflow-wrap:anywhere!important}' +
      '[data-le-soft-article] .entry-meta{font-size:13px!important;color:'+c.muted+'!important;margin-bottom:18px!important}' +
      '[data-le-soft-article] .entry-footer,[data-le-soft-article] .author-bio,[data-le-soft-article] .post-author,[data-le-soft-article] #comments,[data-le-soft-article] .comments-area,[data-le-soft-article] .post-navigation,[data-le-soft-article] .related-posts,[data-le-soft-article] .sharedaddy{display:none!important}' +
      '[data-le-soft-article] iframe,[data-le-soft-article] embed,[data-le-soft-article] object{max-width:100%!important}';
    var style = document.getElementById('le-soft-reader-style');
    if (!style) { style = document.createElement('style'); style.id = 'le-soft-reader-style'; (document.head || document.documentElement).appendChild(style); }
    if (style.textContent !== css) style.textContent = css;
    var image = entry.querySelector('img.wp-post-image, .post-thumbnail img, .entry-content img');
    if (image) {
      var imageUrl = image.getAttribute('data-lazy-src') || image.getAttribute('data-src') || image.currentSrc || image.src;
      if (imageUrl && !/^(data:|blob:)/.test(imageUrl) && window.__leSoftLastImage !== imageUrl) {
        window.__leSoftLastImage = imageUrl;
        send({type: 'article-image', image: imageUrl});
      }
    }
  }

  function check() { 
    try { 
      readAccount();
      styleReader();
      hideSubscriptions();
    } catch (_) {} 
  }
  
  window.__leSoftCheck = check;
  if (!window.__leSoftObserver && document.documentElement) {
    window.__leSoftObserver = new MutationObserver(function () {
      clearTimeout(window.__leSoftTimer);
      window.__leSoftTimer = setTimeout(function () { window.__leSoftCheck(); }, 150);
    });
    window.__leSoftObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    // Image sizes are only known once loaded (covers are cropped from their proportions).
    document.addEventListener('load', function (event) {
      if (event.target && event.target.tagName === 'IMG') window.__leSoftCheck();
    }, true);
  }
  
  check();
  setTimeout(check, 400);
  setTimeout(check, 1500);
})(); true;
`;
}
