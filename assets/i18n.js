/*
 * Cambio de idioma español ⇄ kaqchikel para Nogal.
 * Usa el diccionario de assets/kaq.js. No modifica el resto de la aplicación:
 * traduce los textos que ya están en la página y también los que la aplicación
 * crea después (obras, comentarios, mensajes de error…).
 */
(() => {
  'use strict';
  const DICT = window.NOGAL_KAQ;
  if (!DICT) return;
  const STORAGE_KEY = 'nogal-lang';
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const SKIP = 'script,style,textarea,input,select[multiple],[data-no-i18n],[translate="no"],.comment-text,.artwork-title,.post-description,.post-medium,.art-description,.notification-excerpt';
  const HTML_BLOCKS = [
    { selector: '#story-title', kaq: "K'o taq k'ojlib'äl<br>ri nsaqirisäx <em>awik'in.</em>" }
  ];
  const originalLang = document.documentElement.getAttribute('lang') || 'es';
  const textRecords = new WeakMap();
  const attrRecords = new WeakMap();
  const htmlOriginals = new Map();
  let lang = 'es';
  let metaOriginal = null;

  const norm = value => String(value).replace(/\s+/g, ' ').trim();

  function translate(raw, scope) {
    const key = norm(raw);
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(DICT.exact, key)) return DICT.exact[key];
    for (const [regex, build, where] of DICT.patterns) {
      if (where !== 'any' && where !== scope) continue;
      const match = key.match(regex);
      if (match) return build(...match.slice(1), value => translate(value, scope));
    }
    return null;
  }

  function translateText(node) {
    if (lang !== 'kaq' || !node.parentElement || node.parentElement.closest(SKIP)) return;
    const record = textRecords.get(node);
    const current = node.nodeValue;
    if (record && current === record.kaq) return;
    const out = translate(current, 'text');
    if (out === null) { if (record) textRecords.delete(node); return; }
    const parent = node.parentElement;
    if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', parent.value);
    const translated = current.match(/^\s*/)[0] + out + current.match(/\s*$/)[0];
    textRecords.set(node, { es: current, kaq: translated });
    node.nodeValue = translated;
  }

  function translateAttrs(element) {
    if (lang !== 'kaq' || element.closest('[data-no-i18n],[translate="no"]')) return;
    let records = attrRecords.get(element);
    for (const attr of ATTRS) {
      const current = element.getAttribute(attr);
      if (current === null) continue;
      const record = records?.[attr];
      if (record && current === record.kaq) continue;
      const out = translate(current, 'attr');
      if (out === null) { if (record) delete records[attr]; continue; }
      if (!records) { records = {}; attrRecords.set(element, records); }
      records[attr] = { es: current, kaq: out };
      element.setAttribute(attr, out);
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    translateAttrs(root);
    const tree = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = tree.nextNode(); node; node = tree.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) translateText(node); else translateAttrs(node);
    }
  }

  function restore(root) {
    const tree = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = root; node; node = tree.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const record = textRecords.get(node);
        if (record && node.nodeValue === record.kaq) node.nodeValue = record.es;
        textRecords.delete(node);
      } else {
        const records = attrRecords.get(node);
        if (records) {
          for (const [attr, record] of Object.entries(records)) if (node.getAttribute(attr) === record.kaq) node.setAttribute(attr, record.es);
          attrRecords.delete(node);
        }
      }
    }
  }

  function syncExtras() {
    document.documentElement.setAttribute('lang', lang === 'kaq' ? 'kaq' : originalLang);
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (metaOriginal === null) metaOriginal = meta.getAttribute('content') || '';
      meta.setAttribute('content', lang === 'kaq' ? (translate(metaOriginal, 'text') || metaOriginal) : metaOriginal);
    }
    for (const block of HTML_BLOCKS) {
      const element = document.querySelector(block.selector);
      if (!element) continue;
      if (!htmlOriginals.has(element)) htmlOriginals.set(element, element.innerHTML);
      element.innerHTML = lang === 'kaq' ? block.kaq : htmlOriginals.get(element);
    }
    const toggle = document.getElementById('themeToggle');
    if (toggle && toggle.getAttribute('aria-label')) toggle.setAttribute('title', toggle.getAttribute('aria-label'));
    const button = document.getElementById('langToggle');
    if (button) {
      const kaq = lang === 'kaq';
      button.textContent = kaq ? DICT.ui.buttonWhenKaq : DICT.ui.buttonWhenSpanish;
      button.setAttribute('aria-label', kaq ? DICT.ui.labelWhenKaq : DICT.ui.labelWhenSpanish);
      button.setAttribute('title', button.getAttribute('aria-label'));
      button.setAttribute('lang', kaq ? 'es' : 'kaq');
      button.setAttribute('aria-pressed', String(kaq));
    }
  }

  function setLang(next, persist) {
    lang = next === 'kaq' ? 'kaq' : 'es';
    if (persist) { try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* sin almacenamiento */ } }
    if (lang === 'kaq') walk(document.documentElement); else restore(document.documentElement);
    syncExtras();
    if (lang === 'kaq') walk(document.documentElement);
  }

  const observer = new MutationObserver(mutations => {
    if (lang !== 'kaq') return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') translateText(mutation.target);
      else if (mutation.type === 'attributes') translateAttrs(mutation.target);
      else for (const added of mutation.addedNodes) walk(added);
    }
    const toggle = document.getElementById('themeToggle');
    if (toggle && toggle.getAttribute('aria-label') && toggle.getAttribute('title') !== toggle.getAttribute('aria-label')) toggle.setAttribute('title', toggle.getAttribute('aria-label'));
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  // Los mensajes de confirmación (por ejemplo, al eliminar una obra) también se traducen.
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = message => nativeConfirm(lang === 'kaq' ? (translate(message, 'attr') || message) : message);

  let saved = 'es';
  try { saved = localStorage.getItem(STORAGE_KEY) === 'kaq' ? 'kaq' : 'es'; } catch { /* sin almacenamiento */ }
  setLang(saved, false);

  document.getElementById('langToggle')?.addEventListener('click', () => setLang(lang === 'kaq' ? 'es' : 'kaq', true));
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) setLang(event.newValue === 'kaq' ? 'kaq' : 'es', false); });
  document.addEventListener('DOMContentLoaded', () => { if (lang === 'kaq') walk(document.documentElement); syncExtras(); });
})();
