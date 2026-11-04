// ---- Language: Hebrew (the game's own text) or English ----
// All game text is written in Hebrew in the code. In English mode every Hebrew string that reaches the screen
// (menus in the DOM, the canvas HUD and messages) is looked up in LANG_EN (lang-en.js) on its way out:
// exact text first, then keys with {0},{1}... placeholders as patterns (the captured parts are translated too),
// and finally text joined with " · " piece by piece. The page also flips to left-to-right.
const HEB_RE = /[֐-׿]/;
const isEn = () => !!(typeof SAVE !== 'undefined' && SAVE && SAVE.lang === 'en');

const I18N = {
  cache: new Map(), pats: null,
  patterns(){
    if(this.pats) return this.pats;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.pats = Object.keys(LANG_EN).filter(k => /\{\d\}/.test(k)).map(k => {
      const parts = k.split(/\{(\d)\}/);                       // literal, index, literal, index, ...
      const lits = parts.filter((_, i) => i % 2 === 0);
      const longest = lits.reduce((a, b) => b.length > a.length ? b : a, '');
      if(!HEB_RE.test(lits.join(''))) return null;              // a pattern needs some Hebrew of its own
      const order = parts.filter((_, i) => i % 2 === 1).map(Number);
      const re = new RegExp('^' + parts.map((p, i) => i % 2 ? '([\\s\\S]*?)' : esc(p)).join('') + '$');
      return {re, order, lits, longest, en: LANG_EN[k], weight: lits.join('').length};
    }).filter(Boolean).sort((a, b) => b.weight - a.weight);    // the most specific pattern wins
    return this.pats;
  },
  // every way the text can be cut into the pattern's parts (a name may itself contain spaces or the next literal)
  splits(p, s){
    const L = p.lits, K = L.length - 1, out = [];
    if(!s.startsWith(L[0]) || !s.endsWith(L[K]) || s.length < L[0].length + L[K].length) return out;
    const end = s.length - L[K].length;
    const rec = (pos, i, acc) => {
      if(out.length >= 40) return;
      if(i === K - 1){ if(end >= pos) out.push(acc.concat(s.slice(pos, end))); return; }
      const lit = L[i + 1];
      for(let j = pos; j <= end; j++){
        if(lit ? s.startsWith(lit, j) : j > pos) rec(j + lit.length, i + 1, acc.concat(s.slice(pos, j)));
        if(out.length >= 40) return;
      }
    };
    rec(L[0].length, 0, []);
    return out;
  },
  fill(p, caps){
    const vals = []; let clean = true;
    p.order.forEach((n, i) => { const v = tr(caps[i]); if(HEB_RE.test(v)) clean = false; vals[n] = v; });
    return {clean, text: p.en.replace(/\{(\d)\}/g, (_, n) => vals[+n] == null ? '' : vals[+n])};
  },
  core(s){
    if(Object.prototype.hasOwnProperty.call(LANG_EN, s)) return LANG_EN[s];
    s = s.replace(/[ \t]{2,}/g, ' ');                            // the dictionary keys have single spaces
    if(Object.prototype.hasOwnProperty.call(LANG_EN, s)) return LANG_EN[s];
    let fallback = null;
    for(const p of this.patterns()){
      if(!s.includes(p.longest) || !p.re.test(s)) continue;
      for(const caps of this.splits(p, s)){
        const r = this.fill(p, caps);
        if(r.clean) return r.text;
        if(fallback == null) fallback = r.text;
      }
    }
    const rest = this.rest(s);
    return rest != null && (!HEB_RE.test(rest) || fallback == null) ? rest : fallback;
  },
  rest(s){
    // symbols and numbers around the text (★★ …, 🔒 …, "1. name", "Bombs ×8", "… (+$500)")
    const pm = s.match(/^([^֐-׿"]*?)([֐-׿"][\s\S]*?[֐-׿"]|[֐-׿])([^֐-׿"]*)$/);
    if(pm && (pm[1] || pm[3])){
      let first = null;
      for(let j = 0, n = pm[3].length - (pm[1] ? 0 : 1); j <= n; j++){   // the key may end with some of those characters, e.g. ")" or " 3"
        const r = this.core(pm[2] + pm[3].slice(0, j)); if(r == null) continue;
        const out = pm[1] + r + pm[3].slice(j);
        if(!HEB_RE.test(r)) return out; if(first == null) first = out;
      }
      if(first != null) return first;
    }
    if(s.includes(' · ')) return s.split(' · ').map(tr).join(' · ');
    if(s.startsWith('· ')) return '· ' + tr(s.slice(2));
    let m = s.match(/^([\s\S]*?)([:.!?]+)$/);                   // trailing punctuation the dictionary key does not have
    if(m && HEB_RE.test(m[1]) && Object.prototype.hasOwnProperty.call(LANG_EN, m[1])) return LANG_EN[m[1]] + m[2];
    if(s.includes(' – ')) return s.split(' – ').map(tr).join(' – ');
    if(s.includes(': ')) { const i = s.indexOf(': '); return tr(s.slice(0, i)) + ': ' + tr(s.slice(i + 2)); }
    return null;
  },
  translate(s){
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const r = m[2] ? this.core(m[2]) : null;
    return r == null ? s : m[1] + r + m[3];
  }
};

// translate one string for the screen (returns it unchanged in Hebrew mode or if it has no Hebrew)
function tr(s){
  if(typeof s !== 'string' || !isEn() || !HEB_RE.test(s)) return s;
  let r = I18N.cache.get(s);
  if(r === undefined){
    r = I18N.translate(s);
    if(I18N.cache.size > 4000) I18N.cache.clear();               // HUD lines with timers are all different
    I18N.cache.set(s, r);
  }
  return r;
}

// ---- DOM: translate text nodes and labels whenever the menus change ----
const TR_ATTRS = ['aria-label', 'title', 'alt', 'placeholder'];
function translateDOM(root){
  if(!isEn() || !root) return;
  const skip = n => { const e = n.nodeType === 1 ? n : n.parentElement; return !!(e && e.closest('[data-notr],script,style')); };
  const doText = t => { const v = t.nodeValue; if(HEB_RE.test(v) && !skip(t)){ const r = tr(v); if(r !== v) t.nodeValue = r; } };
  const doEl = el => { if(skip(el)) return; for(const a of TR_ATTRS){ const v = el.getAttribute(a); if(v && HEB_RE.test(v)){ const r = tr(v); if(r !== v) el.setAttribute(a, r); } } };
  if(root.nodeType === 3){ doText(root); return; }
  if(root.nodeType !== 1) return;
  doEl(root);
  root.querySelectorAll('*').forEach(doEl);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let t; while((t = w.nextNode())) doText(t);
}
let langObserver = null;
function watchDOM(){
  if(langObserver || typeof MutationObserver === 'undefined') return;
  langObserver = new MutationObserver(list => {
    if(!isEn()) return;
    for(const m of list){
      if(m.type === 'characterData') translateDOM(m.target);
      else if(m.type === 'attributes') translateDOM(m.target);
      else m.addedNodes.forEach(translateDOM);
    }
  });
  langObserver.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:TR_ATTRS});
}

// ---- canvas: translate on the way to fillText/measureText, and draw left-to-right in English ----
(function patchCanvas(){
  const C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype; if(!C) return;
  for(const fn of ['fillText', 'strokeText']){
    const orig = C[fn];
    C[fn] = function(text, ...rest){
      if(!isEn()) return orig.call(this, text, ...rest);
      const d = this.direction; if(d === 'rtl') this.direction = 'ltr';
      orig.call(this, typeof text === 'string' ? tr(text) : text, ...rest);
      if(d === 'rtl') this.direction = d;
    };
  }
  const mt = C.measureText;
  C.measureText = function(text){
    if(!isEn()) return mt.call(this, text);
    const d = this.direction; if(d === 'rtl') this.direction = 'ltr';
    const r = mt.call(this, typeof text === 'string' ? tr(text) : text);
    if(d === 'rtl') this.direction = d;
    return r;
  };
})();

// ---- page direction, static texts, and switching ----
const HE_STATIC = new Map();       // the original Hebrew of the static page parts, to switch back without a reload
function applyLang(){
  const en = isEn(), h = document.documentElement;
  h.lang = en ? 'en' : 'he'; h.dir = en ? 'ltr' : 'rtl';
  document.title = en ? 'Wings of Fury' : 'כנפי הרעם';
  const statics = document.querySelectorAll('#title, #title *, #touch button');
  statics.forEach(el => {
    for(const n of el.childNodes) if(n.nodeType === 3 && n.nodeValue.trim()){
      if(!HE_STATIC.has(n)) HE_STATIC.set(n, n.nodeValue);
      const he = HE_STATIC.get(n); n.nodeValue = en ? tr(he) : he;
    }
    for(const a of TR_ATTRS){ const v = el.getAttribute(a); if(v == null) continue;
      const key = el, store = (key.__heAttr = key.__heAttr || {});
      if(!(a in store)) store[a] = v;
      el.setAttribute(a, en ? tr(store[a]) : store[a]);
    }
  });
  const ver = document.getElementById('ver'); if(ver && typeof GAME_VERSION !== 'undefined') ver.textContent = (en ? 'Version ' : 'גרסה ') + GAME_VERSION;
  if(en) translateDOM(document.getElementById('ui'));
  watchDOM();
}
function setLang(l){
  if(l !== 'en' && l !== 'he') return;
  SAVE.lang = l; storeSave(); I18N.cache.clear(); applyLang();
}
// English titles for the in-game alert names that are built from parts
Object.assign(LANG_EN, {'הדרכה:':'Training:', 'רוח':'Wind', 'סערה':'Storm', 'כוכבים':'Stars', 'עלות הכנפיים למשימה':'Wingmen cost for this mission','שיעור:':'Lesson:', 'למעלה':'Up', 'למטה':'Down', 'האט':'Slow down', 'ירי':'Fire',
  'עצור':'Pause', 'פקודה':'Order', 'כנפי הרעם: מטוס הלקט מעל נושאת מטוסים בקרב מול מטוסי זירו':'Wings of Fury: a Hellcat over an aircraft carrier fighting Zeros'});
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLang); else applyLang();
