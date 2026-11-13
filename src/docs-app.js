/* SFCC Docs: an offline library for SFCC schemas, Script API pages and guides.
   It ships with no Salesforce content. It reads files the user keeps in a folder they pick. */
(function () {
"use strict";
var esc = UI.esc, XS = 'http://www.w3.org/2001/XMLSchema', META = '.sfcc-docs.json', NOTES = 'Notes';
var D = { root: null, rootName: '', schemas: [], apis: [], guides: [], notes: {}, idx: [], meta: { bookmarks: [], recent: [] }, view: { name: 'home' }, nodes: [], sideHidden: !!UI.store('sd-side-hidden'), open: UI.store('sd-open') || {} };

/* ---------- IndexedDB: remember the folder ---------- */
var IDB = {
  open: function () { return new Promise(function (res, rej) { var r = indexedDB.open('sfcc-docs', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); },
  get: async function (k) { try { var db = await this.open(); return await new Promise(function (res) { var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); } catch (e) { return null; } },
  set: async function (k, v) { try { var db = await this.open(); await new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) { } }
};

/* ---------- areas ---------- */
var AREAS = [
  ['catalog', 'Catalog and pricing', 'shirt', /^(catalog|pricebook|inventory|productlist|productlists|store|stores|sort|search|searchsettings|pricing|priceadjustmentlimits|productinventory|availability)/],
  ['marketing', 'Promotions and marketing', 'speakerphone', /^(promotion|coupon|couponredemption|sourcecode|campaign|giftcertificate|slot)/],
  ['customers', 'Customers', 'users', /^(customer(?!cdn)|customergroup|customerlist|profile)/],
  ['orders', 'Orders and payments', 'coins', /^(order|payment|shipping|tax|invoice|basket)/],
  ['content', 'Content', 'fileText', /^(library|content|folder)/],
  ['experiments', 'Assignments and A/B tests', 'listCheck', /^(assignment|abtest)/],
  ['site', 'Site and configuration', 'settings', /^(cache|channel|commercefeature|csrf|customercdn|site|preference|sitemap|url|redirect|locale|currenc|job|service|oauth|ocapi|schedule|security|geolocation|webdav|cartridge|replication)/],
  ['meta', 'Metadata and custom objects', 'braces', /^(bmext|dcext|metadata|customobject|systemobject|attribute)/]
];
function areaOf(name) { var n = name.toLowerCase(); for (var i = 0; i < AREAS.length; i++) if (AREAS[i][3].test(n)) return AREAS[i][0]; return 'other'; }
function areaInfo(id) { return AREAS.filter(function (a) { return a[0] === id; })[0] || ['other', 'Other schemas', 'fileCode']; }

/* ---------- small helpers ---------- */
function base(p) { return p.split('/').pop(); }
function stem(p) { return base(p).replace(/\.[^.]+$/, ''); }
function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'note'; }
function words(q) { return q.toLowerCase().split(/\s+/).filter(Boolean); }
function first(s) { s = (s || '').trim(); var m = s.match(/^[\s\S]*?[.!?](\s|$)/); return (m ? m[0] : s).slice(0, 160).trim(); }
function short(t) { return String(t || '').replace(/^(complexType|simpleType|sharedType)\./, ''); }
function nat(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }
function viewKey(v) { return v.name === 'info' ? 'info:' + v.id : v.name === 'lesson' ? 'lesson:' + v.id : v.name === 'sol' ? 'sol:' + v.id : v.name === 'schema' ? 'schema:' + v.id : v.name === 'type' ? 'type:' + v.id + ':' + v.k + ':' + v.t : v.name === 'api' ? 'api:' + v.id : v.name === 'guide' ? 'guide:' + v.id : ''; }

/* ---------- reading the folder ---------- */
async function readZip(blob, zipPath, out) {
  var buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer), eocd = -1;
  for (var i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return;
  var n = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), dec = new TextDecoder();
  for (var k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    var name = dec.decode(buf.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (/\/$/.test(name) || !/\.(xsd|html?|md|txt)$/i.test(name) || /(^|\/)__MACOSX\//.test(name)) continue;
    var ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = buf.subarray(ds, ds + csize), text;
    try {
      if (method === 0) text = dec.decode(data);
      else if (method === 8) text = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      else continue;
    } catch (e) { continue; }
    out.push({ path: zipPath + '!' + name, text: text, zip: zipPath });
  }
}
async function scan() {
  var files = [], notes = [], mine = [];
  try { var mh = await D.root.getFileHandle(META); var mt = JSON.parse(await (await mh.getFile()).text()); D.meta = { bookmarks: mt.bookmarks || [], recent: mt.recent || [], learn: mt.learn || { mode: 'standard', done: {}, known: {} }, solLabel: mt.solLabel, solDir: mt.solDir, reports: mt.reports || [] }; } catch (e) { D.meta = { bookmarks: [], recent: [], learn: { mode: 'standard', done: {}, known: {} } }; }
  var SD = solDir() + '/';
  async function walk(dh, path) {
    for await (var entry of dh.entries()) {
      var name = entry[0], h = entry[1], p = path ? path + '/' + name : name;
      if (name[0] === '.' || name === 'node_modules') continue;
      if (h.kind === 'directory') { await walk(h, p); continue; }
      var ext = (name.match(/\.([^.]+)$/) || [])[1]; ext = ext ? ext.toLowerCase() : '';
      if (p.indexOf(SD) === 0 || p.indexOf(ENTRY_DIR + '/') === 0 || p.indexOf(INFO_DIR + '/') === 0) { var mf = await h.getFile(); if (mf.size <= 1048576) mine.push({ path: p, text: await mf.text(), lm: mf.lastModified }); continue; }
      if (!/^(xsd|html?|md|txt|zip)$/.test(ext)) continue;
      var f = await h.getFile();
      if (ext === 'zip') { await readZip(f, p, files); continue; }
      var rec = { path: p, text: await f.text(), handle: h, lm: f.lastModified };
      if (path === NOTES && ext === 'md') notes.push(rec); else files.push(rec);
    }
  }
  await walk(D.root, '');
  D.schemas = []; D.apis = []; D.guides = []; D.notes = {}; D.bad = [];
  files.forEach(function (f) {
    var inner = f.path.split('!').pop(), ext = inner.split('.').pop().toLowerCase();
    try {
      if (ext === 'xsd') D.schemas.push(parseXsd(f));
      else if (ext === 'html' || ext === 'htm') D.apis.push(parseApi(f));
      else D.guides.push({ id: f.path, name: stem(inner), path: f.path, text: f.text, kind: ext, builtIn: false });
    } catch (e) { D.bad.push({ path: f.path, msg: e.message }); }
  });
  notes.forEach(function (n) { var m = n.text.match(/^<!-- sfcc-docs:(.+?) -->\n?/); var key = m ? m[1] : 'file:' + n.path; D.notes[key] = { path: n.path, text: m ? n.text.slice(m[0].length) : n.text, handle: n.handle, lm: n.lm, key: key }; });
  (window.SFCC_GUIDES || []).forEach(function (g) { D.guides.push({ id: 'builtin:' + g.id, name: g.title, area: g.area, path: '', text: g.body, sources: g.sources || [], kind: 'md', builtIn: true }); });
  D.schemas.sort(function (a, b) { return nat(a.name, b.name) || nat(a.version, b.version); });
  D.apis.sort(function (a, b) { return nat(a.pkg, b.pkg) || nat(a.title, b.title); });
  loadMine(mine); loadInfos(mine);
  buildIndex();
}
async function writeText(path, text) {
  var parts = path.split('/'), dh = D.root;
  for (var i = 0; i < parts.length - 1; i++) dh = await dh.getDirectoryHandle(parts[i], { create: true });
  var fh = await dh.getFileHandle(parts[parts.length - 1], { create: true }), w = await fh.createWritable();
  await w.write(text); await w.close(); return fh;
}
var saveMeta = UI.debounce(function () { writeText(META, JSON.stringify(D.meta, null, 2)).catch(function (e) { UI.toast('Could not save bookmarks: ' + e.message, true); }); }, 400);

/* ---------- XSD model ---------- */
function xk(n) { return n ? Array.prototype.filter.call(n.children, function (c) { return c.namespaceURI === XS; }) : []; }
function xk1(n, name) { return xk(n).filter(function (c) { return c.localName === name; })[0]; }
function ln(q) { return q ? q.split(':').pop() : ''; }
function docOf(n) { var a = xk1(n, 'annotation'); if (!a) return ''; return xk(a).filter(function (c) { return c.localName === 'documentation'; }).map(function (d) { return d.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim(); }).join('\n\n'); }
function parseXsd(f) {
  var doc = new DOMParser().parseFromString(f.text, 'application/xml'), r = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length || r.localName !== 'schema' || r.namespaceURI !== XS) throw new Error('not an XML schema');
  var inner = f.path.split('!').pop(), dir = dirOf(inner) || (f.zip ? '' : dirOf(f.path));
  var S = { id: f.path, path: f.path, name: stem(inner), text: f.text, doc: doc, ns: r.getAttribute('targetNamespace') || '', el: {}, ct: {}, st: {}, gr: {}, ag: {}, order: [], version: dir ? base(dir) : '', schemaDoc: docOf(r) };
  var maps = { element: S.el, complexType: S.ct, simpleType: S.st, group: S.gr, attributeGroup: S.ag };
  xk(r).forEach(function (n) { var nm = n.getAttribute('name'), m = maps[n.localName]; if (nm && m) { m[nm] = n; if (n.localName === 'element') S.order.push(nm); } });
  S.nsDate = (S.ns.match(/(\d{4}-\d{2}-\d{2})\/?$/) || [])[1] || '';
  S.roots = S.order.filter(function (nm) { return xk1(S.el[nm], 'complexType'); });
  if (!S.roots.length && S.order.length) S.roots = [S.order[0]];
  S.area = areaOf(S.name);
  S.src = /^https?:\/\/www\.demandware\.com\/xml\//.test(S.ns) ? 'official' : 'own';
  S.fromZip = !!f.zip;
  return S;
}
function isBuiltin(ctx, q) { if (!q) return false; var i = q.indexOf(':'); if (i < 0) return false; var uri = ctx.lookupNamespaceURI(q.slice(0, i)); return uri === XS; }
function decl(S, n) {
  var ref = n.getAttribute('ref'), t = ref ? (S.el[ln(ref)] || n) : n;
  return { S: S, node: t, at: n, name: ref ? ln(ref) : n.getAttribute('name'), type: t.getAttribute('type'), min: n.getAttribute('minOccurs') || '1', max: n.getAttribute('maxOccurs') || '1', nil: t.getAttribute('nillable') === 'true', doc: docOf(n) || docOf(t), ict: xk1(t, 'complexType'), ist: xk1(t, 'simpleType'), dflt: t.getAttribute('default') };
}
function particle(S, n) {
  if (n.localName === 'group') { var g = S.gr[ln(n.getAttribute('ref'))], inner = g && xk(g).filter(function (c) { return /^(sequence|choice|all)$/.test(c.localName); })[0]; var p = inner ? particle(S, inner) : { kind: 'seq', items: [] }; p.min = n.getAttribute('minOccurs') || p.min; p.max = n.getAttribute('maxOccurs') || p.max; return p; }
  return {
    kind: n.localName === 'sequence' ? 'seq' : n.localName, min: n.getAttribute('minOccurs') || '1', max: n.getAttribute('maxOccurs') || '1', doc: docOf(n),
    items: xk(n).map(function (c) {
      if (c.localName === 'element') return { el: decl(S, c) };
      if (/^(sequence|choice|all|group)$/.test(c.localName)) return { p: particle(S, c) };
      if (c.localName === 'any') return { any: true, min: c.getAttribute('minOccurs') || '1', max: c.getAttribute('maxOccurs') || '1' };
      return null;
    }).filter(Boolean)
  };
}
function attr(S, n) {
  var ref = n.getAttribute('ref');
  if (ref) { if (/^xml:/.test(ref)) return { name: ref, type: 'xml-lang', use: n.getAttribute('use') || 'optional', dflt: n.getAttribute('default'), doc: docOf(n) || 'Locale of the value, for example x-default or en-GB.' }; }
  return { name: n.getAttribute('name'), type: n.getAttribute('type'), ist: xk1(n, 'simpleType'), ctx: n, use: n.getAttribute('use') || 'optional', dflt: n.getAttribute('default'), fixed: n.getAttribute('fixed'), doc: docOf(n) };
}
function ctContent(S, ct, seen) {
  seen = seen || {};
  var out = { attrs: [], part: null, simple: null, base: '', mixed: ct.getAttribute('mixed') === 'true' };
  xk(ct).forEach(function (c) {
    var k = c.localName;
    if (/^(sequence|choice|all|group)$/.test(k)) out.part = particle(S, c);
    else if (k === 'attribute') out.attrs.push(attr(S, c));
    else if (k === 'attributeGroup') { var g = S.ag[ln(c.getAttribute('ref'))]; if (g) out.attrs = out.attrs.concat(ctContent(S, g, seen).attrs); }
    else if (k === 'complexContent' || k === 'simpleContent') {
      var x = xk(c).filter(function (e) { return e.localName === 'extension' || e.localName === 'restriction'; })[0]; if (!x) return;
      var b = x.getAttribute('base'), bn = ln(b), own = ctContent(S, x, seen), inh = null;
      out.base = b;
      if (!isBuiltin(x, b) && S.ct[bn] && !seen[bn]) { seen[bn] = 1; inh = ctContent(S, S.ct[bn], seen); }
      if (k === 'simpleContent') {
        out.simple = inh && inh.simple ? inh.simple : { q: b, ctx: x };
        if (x.localName === 'restriction') out.simple = { q: b, ctx: x, node: x };
      }
      out.attrs = (inh && x.localName === 'extension' ? inh.attrs : []).concat(own.attrs);
      var bp = inh && x.localName === 'extension' ? inh.part : null;
      out.part = bp && own.part ? { kind: 'seq', min: '1', max: '1', items: [{ p: bp }, { p: own.part }] } : (own.part || bp);
    }
  });
  return out;
}
function content(d) {
  var S = d.S;
  if (d.ict) return ctContent(S, d.ict);
  if (d.ist) return { attrs: [], simple: { node: d.ist, ctx: d.node } };
  if (!d.type) return { attrs: [], part: null };
  if (isBuiltin(d.node, d.type)) return { attrs: [], simple: { q: d.type, ctx: d.node } };
  var t = ln(d.type);
  if (S.ct[t]) return ctContent(S, S.ct[t]);
  if (S.st[t]) return { attrs: [], simple: { q: d.type, ctx: d.node } };
  return { attrs: [], unknown: d.type };
}
var BUILTIN = { string: 'text', normalizedString: 'text', token: 'text', boolean: 'true or false', int: 'whole number', integer: 'whole number', long: 'whole number', short: 'whole number', nonNegativeInteger: 'whole number, 0 or more', positiveInteger: 'whole number, 1 or more', decimal: 'decimal number', double: 'number', float: 'number', dateTime: 'date and time', date: 'date (YYYY-MM-DD)', time: 'time', language: 'language code', anyURI: 'URL or path', base64Binary: 'base64 data', NMTOKEN: 'name token', ID: 'ID', anyType: 'any content', 'xml-lang': 'locale (x-default, en-GB…)' };
function simpleInfo(S, q, node, ctx, depth) {
  depth = depth || 0;
  var res = { label: '', bi: '', enums: [], facets: {}, list: false };
  if (!node && q) {
    if (q === 'xml-lang') { res.label = BUILTIN['xml-lang']; res.bi = 'language'; return res; }
    if (isBuiltin(ctx, q)) { res.bi = ln(q); res.label = BUILTIN[res.bi] || res.bi; return res; }
    node = S.st[ln(q)];
    if (!node) { var c = S.ct[ln(q)]; if (c) { var cc = ctContent(S, c); if (cc.simple) return simpleInfo(S, cc.simple.q, cc.simple.node, cc.simple.ctx, depth + 1); } res.label = short(ln(q)); return res; }
    res.name = ln(q);
  }
  if (!node || depth > 12) return res;
  var r = node.localName === 'restriction' ? node : xk1(node, 'restriction'), li = xk1(node, 'list'), un = xk1(node, 'union');
  if (r) {
    var b = r.getAttribute('base') || '', inner = xk1(r, 'simpleType');
    var bi = b ? simpleInfo(S, b, null, r, depth + 1) : inner ? simpleInfo(S, null, inner, r, depth + 1) : res;
    res.bi = bi.bi; res.label = bi.label; res.facets = Object.assign({}, bi.facets); res.enums = bi.enums.slice();
    var own = xk(r).filter(function (c) { return c.localName === 'enumeration'; });
    if (own.length) res.enums = own.map(function (e) { return { v: e.getAttribute('value'), doc: docOf(e) }; });
    var pats = xk(r).filter(function (c) { return c.localName === 'pattern'; });
    if (pats.length) res.facets.pattern = pats.map(function (p) { return p.getAttribute('value'); });
    xk(r).forEach(function (c) { if (/^(minLength|maxLength|length|minInclusive|maxInclusive|minExclusive|maxExclusive|totalDigits|fractionDigits)$/.test(c.localName)) res.facets[c.localName] = c.getAttribute('value'); });
  } else if (li) { var it = simpleInfo(S, li.getAttribute('itemType'), xk1(li, 'simpleType'), li, depth + 1); res.label = 'space-separated list of ' + it.label; res.list = true; res.item = it; if (it.enums.length) res.enums = it.enums; }
  else if (un) res.label = 'one of several formats';
  return res;
}
function facetText(f) {
  var out = [];
  if (f.length) out.push('exactly ' + f.length + ' characters');
  if (f.minLength && f.minLength !== '0') out.push('at least ' + f.minLength + ' character' + (f.minLength === '1' ? '' : 's'));
  if (f.maxLength) out.push('max ' + f.maxLength + ' characters');
  var lo = f.minInclusive, hi = f.maxInclusive;
  if (lo !== undefined && hi !== undefined) out.push('from ' + lo + ' to ' + hi); else if (lo !== undefined) out.push(lo + ' or more'); else if (hi !== undefined) out.push(hi + ' or less');
  if (f.minExclusive !== undefined) out.push('more than ' + f.minExclusive);
  if (f.maxExclusive !== undefined) out.push('less than ' + f.maxExclusive);
  if (f.fractionDigits) out.push('up to ' + f.fractionDigits + ' decimals');
  (f.pattern || []).forEach(function (p) {
    if (p === '\\S|(\\S(.*)\\S)') out.push('no spaces at the start or end');
    else if (p === '[A-Z]{3}') out.push('3 capital letters (currency code)');
    else out.push('pattern <code>' + esc(p) + '</code>');
  });
  return out;
}
function simpleHtml(info, full) {
  var h = '<span class="xv">' + esc(info.label || 'text') + '</span>';
  var ft = facetText(info.facets); if (ft.length) h += ' <span class="faint">· ' + ft.map(function (x) { return x.indexOf('<code>') >= 0 ? x : esc(x); }).join(' · ') + '</span>';
  if (info.enums.length) h += '<div class="xenum">' + (full ? '' : '<span class="faint small">Allowed: </span>') + info.enums.map(function (e) { return '<code title="' + esc(e.doc || '') + '">' + esc(e.v) + '</code>'; }).join(' ') + '</div>';
  return h;
}

/* ---------- source badges ---------- */
var BADGE = {
  official: ['ok', 'check', 'Official', 'Comes unchanged from an official Salesforce file you added (schema namespace or saved page address is Salesforce). Shown as it is, not rewritten.'],
  claude: ['ai', 'edit', 'Rephrased by Claude', 'Written by Claude in its own words from Trailhead and Salesforce docs. Not official: check the sources listed at the end before relying on it.'],
  own: ['own', 'file', 'Your file', 'A file from your folder. Its source could not be confirmed as Salesforce.'],
  gen: ['gen', 'bolt', 'Generated from schema', 'Built by this app from the official schema. Element order follows the schema; values are placeholders.'],
  note: ['own', 'edit', 'Your note', 'Written by you.'],
  mine: ['own', 'users', 'Your entry', 'Added by you. Saved as a file in your docs folder.']
};
function badge(kind, small) { var b = BADGE[kind]; if (!b) return ''; return '<span class="vb ' + b[0] + (small ? ' sm' : '') + '" title="' + esc(b[3]) + '">' + ICONS(b[1]) + esc(small && kind === 'claude' ? 'Claude' : b[2]) + '</span>'; }
function srcOf(v) {
  if (v.name === 'lesson' || v.name === 'learn' || v.name === 'practice') return 'claude';
  if (v.name === 'sol' || v.name === 'entries' || v.name === 'sols' || v.name === 'info' || v.name === 'infos') return 'mine';
  if (v.name === 'schema' || v.name === 'type') { var S = byId(v.id); return S ? S.src : ''; }
  if (v.name === 'api') { var a = apiById(v.id); return a ? a.src : ''; }
  if (v.name === 'lesson') { var l = lessonById(v.id); return { label: l ? l.title : 'Topic', sub: 'Learn SFCC' }; }
  if (v.name === 'info') { var inf = infoById(v.id); return { label: inf ? inf.title : 'SFCC info', sub: 'My SFCC info' }; }
  if (v.name === 'sol') { var so = (D.sols || {})[v.id]; return { label: so ? so.title : 'Note', sub: solLabel() }; }
  if (v.name === 'guide') { var g = guideById(v.id); return g ? (g.builtIn ? 'claude' : 'own') : ''; }
  return '';
}

/* ---------- structure rendering ---------- */
function occ(min, max) {
  var c = [];
  c.push(min === '0' ? '<span class="oc opt">optional</span>' : '<span class="oc req">required' + (+min > 1 ? ' ×' + min : '') + '</span>');
  if (max === 'unbounded') c.push('<span class="oc rep" title="Can appear many times">many</span>'); else if (+max > 1) c.push('<span class="oc rep">up to ' + max + '</span>');
  return c.join('');
}
function typeLink(d) {
  if (d.ict) return '';
  if (!d.type) return d.ist ? '<span class="xv">' + esc(simpleInfo(d.S, null, d.ist, d.node).label) + '</span>' : '';
  var t = ln(d.type);
  if (!isBuiltin(d.node, d.type) && d.S.ct[t]) return '<a class="xt" data-type="ct:' + esc(t) + '" title="' + esc(t) + '">' + esc(short(t)) + '</a>';
  var info = simpleInfo(d.S, d.type, null, d.node);
  var link = !isBuiltin(d.node, d.type) && d.S.st[t] ? '<a class="xt" data-type="st:' + esc(t) + '" title="' + esc(t) + '">' + esc(info.label || short(t)) + '</a>' : '<span class="xv">' + esc(info.label) + '</span>';
  return link + (info.enums.length ? ' <span class="faint small">' + info.enums.length + ' values</span>' : '');
}
function elRow(d, ord, inChoice) {
  var i = D.nodes.push(d) - 1, dep = /deprecated/i.test(d.doc);
  return '<div class="xn' + (dep ? ' dep' : '') + '" data-el="' + esc(d.name) + '"><div class="xr" data-n="' + i + '"><span class="tw">' + ICONS('chevR') + '</span>' + (ord ? '<span class="xo">' + ord + '</span>' : '') +
    '<span class="xname">' + esc(d.name) + '</span>' + (inChoice && d.min === '1' && d.max === '1' ? '' : occ(d.min, d.max)) + (dep ? '<span class="chip w">deprecated</span>' : '') + (d.nil ? '<span class="chip" title="Can be sent empty with xsi:nil to clear the value">can be cleared</span>' : '') +
    '<span class="xtt">' + typeLink(d) + '</span><span class="xd ellip">' + esc(first(d.doc)) + '</span></div><div class="xk" hidden></div></div>';
}
function partHtml(p, top) {
  var label = p.kind === 'choice' ? (p.max !== '1' ? 'Any of these, in any order, as often as needed' : 'Pick one of these') : p.kind === 'all' ? 'In any order' : 'In this order';
  var ord = 0, inner = p.items.map(function (it) {
    var n = p.kind === 'seq' ? ++ord : 0;
    if (it.el) return elRow(it.el, n, p.kind === 'choice');
    if (it.any) return '<div class="xn"><div class="xr plain"><span class="tw"></span>' + (n ? '<span class="xo">' + n + '</span>' : '') + '<span class="faint">any element</span>' + occ(it.min, it.max) + '</div></div>';
    return '<div class="xgw">' + (n ? '<span class="xo">' + n + '</span>' : '') + partHtml(it.p, false) + '</div>';
  }).join('');
  if (top && p.kind === 'seq' && p.min === '1' && p.max === '1') return '<div class="xsec">Child elements, in this order</div><div class="xlist">' + inner + '</div>';
  return '<div class="xg ' + p.kind + '"><div class="xgh">' + esc(label) + ' ' + (top || (p.min === '1' && p.max === '1') ? '' : occ(p.min, p.max)) + '</div>' + inner + '</div>';
}
function attrsHtml(S, attrs) {
  if (!attrs.length) return '';
  return '<div class="xsec">Attributes</div><table class="xat"><tbody>' + attrs.map(function (a) {
    var info = a.type === 'xml-lang' ? simpleInfo(S, 'xml-lang') : simpleInfo(S, a.type, a.ist, a.ctx);
    return '<tr><td class="mono">' + esc(a.name) + '</td><td>' + (a.use === 'required' ? '<span class="oc req">required</span>' : '<span class="oc opt">optional</span>') + '</td><td>' + simpleHtml(info) + (a.dflt != null ? ' <span class="faint small">default <code>' + esc(a.dflt) + '</code></span>' : '') + (a.fixed != null ? ' <span class="faint small">always <code>' + esc(a.fixed) + '</code></span>' : '') + (info.enums.length === 1 && info.enums[0].v === 'delete' && a.name === 'mode' ? '<div class="small muted">Set <code>mode="delete"</code> to remove this object during a Merge import.</div>' : '') + (a.doc ? '<div class="small muted">' + esc(a.doc) + '</div>' : '') + '</td></tr>';
  }).join('') + '</tbody></table>';
}
function bodyHtml(S, c, doc) {
  var h = '';
  if (doc) h += '<div class="xdoc">' + esc(doc) + '</div>';
  if (c.unknown) h += '<div class="small muted">Type <code>' + esc(c.unknown) + '</code> is defined in another schema file.</div>';
  if (c.simple) h += ((c.attrs || []).length ? '<div class="xsec">Value</div>' : '') + '<div class="xval">' + simpleHtml(c.simple.node ? simpleInfo(S, null, c.simple.node, c.simple.ctx) : simpleInfo(S, c.simple.q, null, c.simple.ctx)) + '</div>';
  h += attrsHtml(S, c.attrs || []);
  if (c.part && c.part.items.length) h += partHtml(c.part, true);
  else if (!c.simple && !c.unknown && !(c.attrs || []).length) h += '<div class="small faint">Empty element.</div>';
  else if (!c.simple && !c.unknown && c.mixed) h += '<div class="small faint">Can contain text.</div>';
  return h;
}
function expandRow(row) {
  var n = row.parentNode, k = n.querySelector(':scope > .xk'), d = D.nodes[+row.getAttribute('data-n')];
  if (!k || !d) return false;
  if (!k.getAttribute('data-done')) { var c = content(d); k.innerHTML = bodyHtml(d.S, c, d.doc) + (d.dflt != null ? '<div class="small faint">Default value: <code>' + esc(d.dflt) + '</code></div>' : ''); k.setAttribute('data-done', '1'); }
  k.hidden = false; n.classList.add('open'); row.querySelector('.tw').innerHTML = ICONS('chevD'); return true;
}
function collapseRow(row) { var n = row.parentNode, k = n.querySelector(':scope > .xk'); if (k) k.hidden = true; n.classList.remove('open'); row.querySelector('.tw').innerHTML = ICONS('chevR'); }
function expandAll(box, levels) {
  for (var l = 0; l < levels; l++) {
    var rows = Array.prototype.filter.call(box.querySelectorAll('.xr[data-n]'), function (r) { return !r.parentNode.classList.contains('open') && r.offsetParent !== null; });
    if (!rows.length) break; rows.forEach(expandRow);
  }
}
function focusEl(box, name) {
  for (var l = 0; l < 4; l++) {
    var hit = Array.prototype.filter.call(box.querySelectorAll('.xn[data-el]'), function (n) { return n.getAttribute('data-el') === name && n.offsetParent !== null; })[0];
    if (hit) { hit.classList.add('hit'); var r = hit.querySelector('.xr'); if (r) expandRow(r); hit.scrollIntoView({ block: 'center' }); return; }
    expandAll(box, 1);
  }
}

/* ---------- sample XML ---------- */
function sampleVal(info) {
  if (info.enums.length) return info.enums[0].v;
  var b = info.bi;
  if (b === 'boolean') return 'true';
  if (b === 'dateTime') return '2026-01-01T00:00:00.000Z';
  if (b === 'date') return '2026-01-01';
  if (b === 'time') return '00:00:00';
  if (/int|decimal|double|float|long|short|Integer/.test(b)) return info.facets.minInclusive && +info.facets.minInclusive > 0 ? info.facets.minInclusive : '0';
  if (b === 'language') return 'x-default';
  if (info.facets.pattern && info.facets.pattern[0] === '[A-Z]{3}') return 'USD';
  var mx = +(info.facets.maxLength || info.facets.length || 0);
  if (mx && mx < 5) return 'AB'.slice(0, Math.min(mx, 2)) + new Array(Math.max(0, +(info.facets.length || 0) - 2) + 1).join('X');
  return 'value';
}
function sample(d, all, root) {
  var lines = [], stack = {};
  function isDeleteOnly(S, a) { var i = a.type === 'xml-lang' ? null : simpleInfo(S, a.type, a.ist, a.ctx); return i && i.enums.length === 1 && i.enums[0].v === 'delete'; }
  function attrsOf(S, attrs) { return attrs.filter(function (a) { return a.use === 'required' || (all && !isDeleteOnly(S, a)); }).map(function (a) { return ' ' + a.name + '="' + esc(sampleVal(a.type === 'xml-lang' ? simpleInfo(S, 'xml-lang') : simpleInfo(S, a.type, a.ist, a.ctx))) + '"'; }).join(''); }
  function el(d, ind, isRoot) {
    var pad = new Array(ind + 1).join('    '), key = d.type || ('@' + d.name);
    if (ind > 9 || stack[key]) { lines.push(pad + '<!-- ' + d.name + ' can nest again here -->'); return; }
    var c = content(d), at = attrsOf(d.S, c.attrs || []) + (isRoot ? ' xmlns="' + d.S.ns + '"' : '');
    stack[key] = 1;
    var kids = []; lines.push(null); var mark = lines.length - 1;
    if (c.part) walk(c.part, ind + 1);
    kids = lines.splice(mark + 1);
    if (kids.length) { lines[mark] = pad + '<' + d.name + at + '>'; Array.prototype.push.apply(lines, kids); lines.push(pad + '</' + d.name + '>'); }
    else if (c.simple) lines[mark] = pad + '<' + d.name + at + '>' + esc(sampleVal(c.simple.node ? simpleInfo(d.S, null, c.simple.node, c.simple.ctx) : simpleInfo(d.S, c.simple.q, null, c.simple.ctx))) + '</' + d.name + '>';
    else lines[mark] = pad + '<' + d.name + at + '/>';
    delete stack[key];
  }
  function walk(p, ind) {
    var pad = new Array(ind + 1).join('    ');
    if (!all && p.min === '0') return;
    if (p.kind === 'choice') {
      var names = p.items.map(function (it) { return it.el ? it.el.name : it.p ? '(group)' : 'any'; });
      if (names.length > 1) lines.push(pad + '<!-- one of: ' + names.join(' | ') + ' -->');
      var f = p.items[0]; if (!f) return;
      if (f.el) el(f.el, ind); else if (f.p) walk(f.p, ind);
      return;
    }
    p.items.forEach(function (it) {
      if (it.el) { if (all || it.el.min !== '0') for (var r = 0; r < Math.max(1, Math.min(+it.el.min || 1, 5)); r++) el(it.el, ind); }
      else if (it.p) walk(it.p, ind);
    });
  }
  el(d, 0, root);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + lines.join('\n') + '\n';
}
function sampleDialog(d) {
  var all = false, body = document.createElement('div');
  function draw() {
    var x = sample(d, all, true);
    body.innerHTML = '<div class="row" style="margin-bottom:8px">' + badge('gen') + '<span class="chip' + (all ? '' : ' on') + '" data-m="0">Required only</span><span class="chip' + (all ? ' on' : '') + '" data-m="1">Every element</span><span class="grow"></span><span class="small faint">Values are placeholders and may not match every pattern. Element order follows the schema.</span></div><pre class="xsrc">' + MD.highlight(x, 'xml') + '</pre>';
    body.querySelectorAll('[data-m]').forEach(function (c) { c.onclick = function () { all = c.getAttribute('data-m') === '1'; draw(); }; });
    body._x = x;
  }
  draw();
  UI.modal({ title: 'Skeleton for <' + d.name + '>', body: body, size: 'big', buttons: [
    { label: 'Copy', onClick: function () { copy(body._x); } },
    { label: 'Download', onClick: function () { UI.download(d.name + '-skeleton.xml', body._x, 'application/xml'); } },
    { label: 'Close', primary: true, onClick: function (m) { m.close(); } }] });
}
function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { UI.toast('Copied'); }, function () { UI.toast('Copy failed. Select the text and press Ctrl+C.', true); }); }

/* ---------- Script API and other saved pages ---------- */
var KEEP = { H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, P: 1, UL: 1, OL: 1, LI: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, CODE: 1, PRE: 1, B: 1, STRONG: 1, EM: 1, I: 1, DL: 1, DT: 1, DD: 1, BR: 1, HR: 1, BLOCKQUOTE: 1, A: 1, SUP: 1, SUB: 1, SPAN: 0, DIV: 0 };
var DROP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, IFRAME: 1, FRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, IMG: 1, PICTURE: 1, VIDEO: 1, AUDIO: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, NAV: 1, LINK: 1, META: 1, TEMPLATE: 1, CANVAS: 1, HEAD: 1 };
function parseApi(f) {
  var doc = new DOMParser().parseFromString(f.text, 'text/html'), body = doc.body;
  if (!body) throw new Error('empty page');
  var h1 = body.querySelector('h1'), title = ((h1 && h1.textContent) || doc.title || stem(f.path)).replace(/\s+/g, ' ').trim();
  Array.prototype.forEach.call(body.querySelectorAll('script,style,noscript,template'), function (n) { n.remove(); });
  var parts = [], tw = doc.createTreeWalker(body, 4); while (tw.nextNode()) parts.push(tw.currentNode.nodeValue);
  var text = parts.join(' ').replace(/\s+/g, ' ').trim();
  var pm = (title + ' ' + (doc.title || '') + ' ' + text.slice(0, 3000)).match(/(?:^|[^\w.])(dw(?:\.[a-z][a-z0-9]*)+)(?![\w])/);
  var cls = title.replace(/^(class|interface|package|module)\s+/i, '').replace(/\s*[-|].*$/, '').trim();
  var heads = []; body.querySelectorAll('h2,h3,h4').forEach(function (h, i) { var t = h.textContent.replace(/\s+/g, ' ').trim(); if (t) heads.push({ i: i, t: t, lv: +h.tagName[1] }); });
  var head = f.text.slice(0, 4000) + ' ' + Array.prototype.map.call(doc.querySelectorAll('link[rel=canonical],meta[property="og:url"],base'), function (n) { return n.getAttribute('href') || n.getAttribute('content') || ''; }).join(' ');
  var official = /saved from url=\(\d+\)https?:\/\/(salesforcecommercecloud\.github\.io|documentation\.b2c\.commercecloud\.salesforce\.com|developer\.salesforce\.com|help\.salesforce\.com)/i.test(head) || /https?:\/\/(salesforcecommercecloud\.github\.io|documentation\.b2c\.commercecloud\.salesforce\.com|developer\.salesforce\.com)\//i.test(head);
  return { id: f.path, path: f.path, src: official ? 'official' : 'own', file: base(f.path.split('!').pop()), title: cls || title, fullTitle: title, pkg: pm ? pm[1] : 'Other pages', text: text, html: f.text, heads: heads };
}
function cleanHtml(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html'), hn = 0;
  function walk(n) {
    if (n.nodeType === 3) return esc(n.nodeValue);
    if (n.nodeType !== 1 || DROP[n.tagName]) return '';
    var inner = Array.prototype.map.call(n.childNodes, walk).join('');
    var t = n.tagName;
    if (!(t in KEEP) || !KEEP[t]) return /^(DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|ASIDE)$/.test(t) && inner.trim() ? '<div>' + inner + '</div>' : inner;
    if (t === 'BR' || t === 'HR') return '<' + t.toLowerCase() + '>';
    if (t === 'A') { var href = n.getAttribute('href') || ''; return href && !/^javascript:/i.test(href) ? '<a data-href="' + esc(href) + '">' + inner + '</a>' : inner; }
    if (/^H[2-4]$/.test(t)) return '<' + t.toLowerCase() + ' data-h="' + (hn++) + '">' + inner + '</' + t.toLowerCase() + '>';
    var tag = t.toLowerCase(), extra = (t === 'TD' || t === 'TH') && n.getAttribute('colspan') ? ' colspan="' + (+n.getAttribute('colspan') || 1) + '"' : '';
    return '<' + tag + extra + '>' + inner + '</' + tag + '>';
  }
  return doc.body ? walk(doc.body) : '';
}

/* ---------- search index ---------- */
function buildIndex() {
  var idx = [];
  D.schemas.forEach(function (S0) {
    var S = S0, SN = S.name + (S.version ? ' (' + S.version + ')' : '');
    function walkLocal(node, parent, view, seen) {
      Array.prototype.forEach.call(node.getElementsByTagNameNS(XS, 'element'), function (e) {
        var nm = e.getAttribute('name') || ln(e.getAttribute('ref')); if (!nm || seen[nm]) return; seen[nm] = 1;
        idx.push({ k: 'el', label: nm, sub: SN + ' › ' + parent, view: Object.assign({ focus: nm }, view), hay: (nm + ' ' + docOf(e)).toLowerCase(), doc: docOf(e) });
      });
    }
    Object.keys(S.ct).forEach(function (t) {
      idx.push({ k: 'type', label: short(t), sub: SN + ' · ' + t, view: { name: 'type', id: S.id, k: 'ct', t: t }, hay: (t + ' ' + docOf(S.ct[t])).toLowerCase(), doc: docOf(S.ct[t]) });
      walkLocal(S.ct[t], short(t), { name: 'type', id: S.id, k: 'ct', t: t }, {});
    });
    Object.keys(S.st).forEach(function (t) {
      idx.push({ k: 'type', label: short(t), sub: SN + ' · ' + t, view: { name: 'type', id: S.id, k: 'st', t: t }, hay: (t + ' ' + docOf(S.st[t])).toLowerCase(), doc: docOf(S.st[t]) });
      Array.prototype.forEach.call(S.st[t].getElementsByTagNameNS(XS, 'enumeration'), function (e) { var v = e.getAttribute('value'); idx.push({ k: 'enum', label: v, sub: short(t) + ' · ' + SN, view: { name: 'type', id: S.id, k: 'st', t: t }, hay: (v + ' ' + docOf(e)).toLowerCase() }); });
    });
    S.roots.forEach(function (r) {
      idx.push({ k: 'el', label: r, sub: S.name + ' › root element', view: { name: 'schema', id: S.id, focus: r }, hay: (r + ' ' + S.name).toLowerCase(), doc: docOf(S.el[r]) });
      var ict = xk1(S.el[r], 'complexType'); if (ict) walkLocal(ict, r, { name: 'schema', id: S.id }, {});
    });
  });
  D.apis.forEach(function (a) {
    idx.push({ k: 'api', label: a.title, sub: a.pkg, view: { name: 'api', id: a.id }, hay: (a.title + ' ' + a.pkg + ' ' + a.text).toLowerCase(), doc: a.text.slice(0, 400), name: (a.title + ' ' + a.pkg).toLowerCase() });
    a.heads.forEach(function (h) { idx.push({ k: 'apih', label: h.t, sub: a.title + ' · ' + a.pkg, view: { name: 'api', id: a.id, h: h.i }, hay: h.t.toLowerCase() }); });
  });
  D.guides.forEach(function (g) { idx.push({ k: 'guide', label: g.name, sub: g.builtIn ? 'Built-in guide' : g.path, view: { name: 'guide', id: g.id }, hay: (g.name + ' ' + g.text).toLowerCase(), doc: g.text, name: g.name.toLowerCase() }); });
  Object.keys(D.notes).forEach(function (k) { var n = D.notes[k]; idx.push({ k: 'note', label: noteLabel(k), sub: n.path, view: viewFromKey(k) || { name: 'notes' }, hay: (noteLabel(k) + ' ' + n.text).toLowerCase(), doc: n.text }); });
  LEARN.forEach(function (l) {
    idx.push({ k: 'learn', label: l.title, sub: 'Learn SFCC · ' + l.summary, view: { name: 'lesson', id: l.id }, hay: (l.title + ' ' + l.easy + ' ' + l.crash + ' ' + l.standard).toLowerCase(), doc: l.standard, name: l.title.toLowerCase() });
    l.q.forEach(function (q) { idx.push({ k: 'lq', label: q.q.replace(/[`*]/g, ''), sub: l.title, view: { name: 'lesson', id: l.id }, hay: (q.q + ' ' + q.a).toLowerCase(), doc: q.a }); });
  });
  (D.entries || []).forEach(function (e) { idx.push({ k: 'entry', label: e.title, sub: (ETYPES.filter(function (x) { return x[0] === e.type; })[0] || ['', 'Entry'])[1] + ' · ' + ((lessonById(e.topic) || { title: 'General' }).title), view: e.topic === 'general' ? { name: 'entries' } : { name: 'lesson', id: e.topic }, hay: (e.title + ' ' + e.body + ' ' + e.answer + ' ' + e.code).toLowerCase(), doc: e.body || e.code, mine: 1 }); });
  (D.infos || []).forEach(function (x) { idx.push({ k: 'info', label: x.title, sub: 'My SFCC info · ' + (x.topic === 'general' ? 'General' : (lessonById(x.topic) || { title: x.topic }).title), view: { name: 'info', id: x.id }, hay: (x.title + ' ' + x.tags + ' ' + x.body + ' ' + x.code + ' ' + x.refs).toLowerCase(), doc: x.body || x.code, name: x.title.toLowerCase(), mine: 1 }); });
  Object.keys(D.sols || {}).forEach(function (k) { var so = D.sols[k], txt = Object.keys(so.parts).map(function (x) { return so.parts[x]; }).join(' '); idx.push({ k: 'sol', label: so.title, sub: solLabel(), view: { name: 'sol', id: so.id }, hay: (so.title + ' ' + (so.meta.tags || '') + ' ' + txt + ' ' + so.files.map(function (f) { return f.name + ' ' + f.text; }).join(' ')).toLowerCase(), doc: txt, name: so.title.toLowerCase(), mine: 1 }); });
  D.idx = idx;
}
function search(q) {
  var w = words(q), ql = q.toLowerCase().trim(), res = [];
  if (!w.length) return res;
  D.idx.forEach(function (e) {
    if (!w.every(function (x) { return e.hay.indexOf(x) >= 0; })) return;
    var l = e.label.toLowerCase(), nameHay = e.name || l, s = l === ql ? 0 : l.indexOf(ql) === 0 ? 1 : nameHay.indexOf(ql) >= 0 ? 2 : w.every(function (x) { return nameHay.indexOf(x) >= 0; }) ? 3 : 5;
    res.push({ e: e, s: s });
  });
  res.sort(function (a, b) { return a.s - b.s || a.e.label.length - b.e.label.length || nat(a.e.label, b.e.label); });
  return res;
}
function snippet(text, q) {
  if (!text) return '';
  var w = words(q), lt = text.toLowerCase(), at = -1;
  w.some(function (x) { at = lt.indexOf(x); return at >= 0; });
  if (at < 0) return esc(first(text));
  var s = Math.max(0, at - 60), out = (s ? '…' : '') + text.slice(s, at + 120).replace(/\s+/g, ' ') + '…';
  var h = esc(out); w.forEach(function (x) { h = h.replace(new RegExp('(' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
  return h;
}

/* ---------- notes and bookmarks ---------- */
function viewFromKey(k) {
  var m = k.split(':');
  if (m[0] === 'schema') return { name: 'schema', id: k.slice(7) };
  if (m[0] === 'lesson') return { name: 'lesson', id: k.slice(7) };
  if (m[0] === 'sol') return { name: 'sol', id: k.slice(4) };
  if (m[0] === 'info') return { name: 'info', id: k.slice(5) };
  if (m[0] === 'api') return { name: 'api', id: k.slice(4) };
  if (m[0] === 'guide') return { name: 'guide', id: k.slice(6) };
  if (m[0] === 'type') { var t = m.pop(), kk = m.pop(); return { name: 'type', id: m.slice(1).join(':'), k: kk, t: t }; }
  return null;
}
function noteLabel(k) { var v = viewFromKey(k); if (!v) return base(k.replace(/^file:/, '')).replace(/\.md$/, ''); return labelOf(v).label; }
function labelOf(v) {
  if (v.name === 'schema') { var S = byId(v.id); return { label: S ? S.name + '.xsd' : 'Schema', sub: S ? (S.version ? S.version + ' · ' : '') + areaInfo(S.area)[1] : '' }; }
  if (v.name === 'type') { var S2 = byId(v.id); return { label: short(v.t), sub: S2 ? S2.name + '.xsd' : '' }; }
  if (v.name === 'api') { var a = apiById(v.id); return { label: a ? a.title : 'Page', sub: a ? a.pkg : '' }; }
  if (v.name === 'guide') { var g = guideById(v.id); return { label: g ? g.name : 'Guide', sub: g && g.builtIn ? 'Built-in guide' : 'Guide' }; }
  return { label: v.name, sub: '' };
}
function byId(id) { return D.schemas.filter(function (s) { return s.id === id; })[0]; }
function apiById(id) { return D.apis.filter(function (s) { return s.id === id; })[0]; }
function guideById(id) { return D.guides.filter(function (s) { return s.id === id; })[0]; }
function isMarked(v) { var k = viewKey(v); return D.meta.bookmarks.some(function (b) { return b.key === k; }); }
function toggleMark(v) {
  var k = viewKey(v), i = D.meta.bookmarks.findIndex(function (b) { return b.key === k; });
  if (i >= 0) { D.meta.bookmarks.splice(i, 1); UI.toast('Bookmark removed'); } else { var l = labelOf(v); D.meta.bookmarks.unshift({ key: k, label: l.label, sub: l.sub }); UI.toast('Bookmarked'); }
  saveMeta(); renderSide();
}
function addRecent(v) {
  var k = viewKey(v); if (!k) return; var l = labelOf(v);
  D.meta.recent = [{ key: k, label: l.label, sub: l.sub, at: Date.now() }].concat(D.meta.recent.filter(function (r) { return r.key !== k; })).slice(0, 15);
  saveMeta();
}
function noteCard(v) {
  var k = viewKey(v); if (!k) return '';
  var n = D.notes[k];
  return '<div class="card notec" data-note="' + esc(k) + '"><div class="row"><b>' + ICONS('edit') + ' My note</b>' + (n ? badge('note') : '') + '<span class="grow"></span>' + (n ? '<span class="small faint">' + esc(n.path) + '</span>' : '') + '<button data-noteedit>' + (n ? 'Edit' : 'Add note') + '</button></div>' +
    (n ? '<div class="md small-md">' + MD.render(n.text) + '</div>' : '<div class="small faint">Notes are saved as Markdown files in the Notes folder, next to your docs.</div>') + '</div>';
}
function bindNote(box, v) {
  var b = box.querySelector('[data-noteedit]'); if (!b) return;
  b.onclick = function () {
    var k = viewKey(v), n = D.notes[k], card = box.querySelector('.notec');
    card.innerHTML = '<div class="row"><b class="grow">' + ICONS('edit') + ' My note</b><span class="small faint">Markdown</span></div><textarea rows="8" style="width:100%;margin:8px 0;font-family:var(--mono);font-size:13px">' + esc(n ? n.text : '') + '</textarea><div class="row" style="justify-content:flex-end"><button data-cancel>Cancel</button><button class="primary" data-save>' + ICONS('save') + 'Save note</button></div>';
    var ta = card.querySelector('textarea'); ta.focus();
    card.querySelector('[data-cancel]').onclick = render;
    card.querySelector('[data-save]').onclick = async function () {
      var path = n ? n.path : NOTES + '/' + slug(labelOf(v).label + '-' + (labelOf(v).sub || '')) + '.md';
      if (!n && Object.keys(D.notes).some(function (x) { return D.notes[x].path === path; })) path = path.replace(/\.md$/, '-' + Date.now().toString(36) + '.md');
      try {
        var fh = await writeText(path, '<!-- sfcc-docs:' + k + ' -->\n' + ta.value);
        D.notes[k] = { path: path, text: ta.value, handle: fh, lm: Date.now(), key: k }; buildIndex(); UI.toast('Note saved'); render(); renderSide();
      } catch (e) { UI.toast('Could not save: ' + e.message, true); }
    };
  };
}

/* ---------- shell ---------- */
function shell() {
  document.getElementById('app').innerHTML =
    '<header class="top"><button class="ghost icon" id="btnSide" title="Show or hide the menu">' + ICONS('sidebar') + '</button>' +
    '<div class="brand" id="brand" title="Home"><span class="badge">' + ICONS('book') + '</span><span class="ellip">SFCC Docs</span></div>' +
    '<div class="sbox"><div class="sinput">' + ICONS('search') + '<input type="search" id="q" placeholder="Search elements, types, values, Script API, guides…" autocomplete="off"><kbd>/</kbd></div></div>' +
    UI.themeSwitch() + '<button class="ghost icon" id="btnRescan" title="Reload the docs folder">' + ICONS('refresh') + '</button><button id="btnOpen" title="Open another docs folder">' + ICONS('folderOpen') + 'Open folder</button></header>' +
    '<div class="body"><aside id="side"></aside><main id="main"></main></div>';
  UI.Theme.apply();
  var side = document.getElementById('side'); side.classList.toggle('hide', D.sideHidden);
  document.getElementById('btnSide').onclick = function () { D.sideHidden = !D.sideHidden; UI.store('sd-side-hidden', D.sideHidden); side.classList.toggle('hide', D.sideHidden); };
  document.getElementById('brand').onclick = function () { go({ name: 'home' }); };
  document.getElementById('btnRescan').onclick = async function () { await reload(); UI.toast('Docs folder reloaded'); };
  document.getElementById('btnOpen').onclick = pickRoot;
  var q = document.getElementById('q');
  q.oninput = UI.debounce(function () { if (q.value.trim()) go({ name: 'search', q: q.value }, true); else if (D.view.name === 'search') go(D.prev || { name: 'home' }); }, 200);
  q.onkeydown = function (e) { if (e.key === 'Escape') { q.value = ''; q.blur(); if (D.view.name === 'search') go(D.prev || { name: 'home' }); } };
  document.addEventListener('keydown', function (e) { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); q.select(); } });
  document.getElementById('main').addEventListener('click', mainClick);
  side.addEventListener('click', sideClick);
}
async function reload() { var v = D.view; await scan(); renderSide(); D.view = v; render(); }
function go(v, keepSearch) {
  if (D.view.name !== 'search') D.prev = D.view;
  D.view = v; if (!keepSearch) { var q = document.getElementById('q'); if (q && v.name !== 'search') q.value = ''; }
  addRecent(v); renderSide(); render(); var m = document.getElementById('main'); if (m && !v.focus && v.h == null) m.scrollTop = 0;
}
function sideRow(on, attrs, icon, label, cnt) { return '<div class="tree-row sd-row' + (on ? ' on' : '') + '" ' + attrs + '><span class="tw">' + ICONS(icon) + '</span><span class="ellip">' + esc(label) + '</span>' + (cnt != null ? '<span class="cnt">' + cnt + '</span>' : '') + '</div>'; }
function renderSide() {
  var side = document.getElementById('side'); if (!side) return; var v = D.view;
  var h = sideRow(v.name === 'home', 'data-go="home"', 'home', 'Home') + sideRow(v.name === 'marks', 'data-go="marks"', 'star', 'Bookmarks', D.meta.bookmarks.length) + sideRow(v.name === 'notes', 'data-go="notes"', 'edit', 'My notes', Object.keys(D.notes).length);
  var st = lstate(), inLearn = /^(learn|lesson|practice|entries)$/.test(v.name);
  h += '<div class="side-sec">Learn SFCC</div>' + sideRow(v.name === 'learn', 'data-go="learn"', 'book', 'All topics', LEARN.filter(function (l) { return st.done[l.id]; }).length + '/' + LEARN.length);
  if (inLearn) LEARN.forEach(function (l, i) { h += sideRow(v.name === 'lesson' && v.id === l.id, 'data-lesson="' + l.id + '" style="padding-left:24px"', st.done[l.id] ? 'check' : (l.icon || 'book'), (i + 1) + '. ' + l.title); });
  h += sideRow(v.name === 'practice', 'data-go="practice"', 'help', 'Practice questions') + sideRow(v.name === 'entries', 'data-go="entries"', 'edit', 'My entries', (D.entries || []).length) + sideRow(v.name === 'infos' || v.name === 'info', 'data-go="infos"', 'fileText', 'My SFCC info', (D.infos || []).length) + sideRow(v.name === 'reports', 'data-go="reports"', 'inbox', 'Requests', reports().filter(function (r) { return r.status === 'open'; }).length) +
    sideRow(v.name === 'sols' || v.name === 'sol', 'data-go="sols"', 'folder', solLabel(), Object.keys(D.sols || {}).length);
  var areas = {}; D.schemas.forEach(function (S) { areas[S.area] = (areas[S.area] || 0) + 1; });
  var curArea = v.name === 'area' ? v.area : (v.name === 'schema' || v.name === 'type') && byId(v.id) ? byId(v.id).area : '';
  h += '<div class="side-sec">Schemas (import / export files)</div>';
  if (!D.schemas.length) h += '<div class="small faint" style="padding:2px 8px">No .xsd files yet</div>';
  AREAS.concat([['other', 'Other schemas', 'fileCode']]).forEach(function (a) { if (areas[a[0]]) h += sideRow(curArea === a[0], 'data-area="' + a[0] + '"', a[2], a[1], areas[a[0]]); });
  var pk = {}; D.apis.forEach(function (a) { pk[a.pkg] = (pk[a.pkg] || 0) + 1; });
  var curPkg = v.name === 'pkg' ? v.pkg : v.name === 'api' && apiById(v.id) ? apiById(v.id).pkg : '';
  h += '<div class="side-sec">Script API</div>';
  if (!D.apis.length) h += '<div class="small faint" style="padding:2px 8px">No saved pages yet</div>';
  Object.keys(pk).sort(nat).forEach(function (p) { h += sideRow(curPkg === p, 'data-pkg="' + esc(p) + '"', 'code', p, pk[p]); });
  var gOpen = D.open.guides !== false;
  if (D.guides.length) h += '<div class="side-sec side-tog" data-tog="guides">Guides <span style="float:right">' + ICONS(gOpen ? 'chevD' : 'chevR') + '</span></div>';
  if (gOpen) D.guides.forEach(function (g) { h += sideRow(v.name === 'guide' && v.id === g.id, 'data-guide="' + esc(g.id) + '"', g.builtIn ? 'edit' : 'fileText', g.name).replace(/<\/div>$/, (g.builtIn ? '<span class="vb ai dot" title="' + esc(BADGE.claude[3]) + '">AI</span>' : '') + '</div>'); });
  if (gOpen && D.guides.some(function (g) { return g.builtIn; })) h += '<div class="small faint" style="padding:6px 10px 0 34px"><span class="vb ai dot" style="margin:0 4px 0 0">AI</span> rephrased by Claude</div>';
  side.innerHTML = h;
}
function sideClick(e) {
  var r = e.target.closest('[data-go],[data-area],[data-pkg],[data-guide],[data-tog],[data-lesson]'); if (!r) return;
  if (r.hasAttribute('data-lesson')) { go({ name: 'lesson', id: r.getAttribute('data-lesson') }); return; }
  if (r.hasAttribute('data-tog')) { var k = r.getAttribute('data-tog'); D.open[k] = D.open[k] === false; UI.store('sd-open', D.open); renderSide(); return; }
  if (r.hasAttribute('data-go')) go({ name: r.getAttribute('data-go') });
  else if (r.hasAttribute('data-area')) go({ name: 'area', area: r.getAttribute('data-area') });
  else if (r.hasAttribute('data-pkg')) go({ name: 'pkg', pkg: r.getAttribute('data-pkg') });
  else go({ name: 'guide', id: r.getAttribute('data-guide') });
}
function mainClick(e) {
  var t = e.target;
  var ty = t.closest('[data-type]'); if (ty) { e.preventDefault(); var p = ty.getAttribute('data-type').split(':'), sid = ty.getAttribute('data-sid') || D.view.id; go({ name: 'type', id: sid, k: p[0], t: p.slice(1).join(':') }); return; }
  var row = t.closest('.xr[data-n]'); if (row) { if (row.parentNode.classList.contains('open')) collapseRow(row); else expandRow(row); return; }
  var g = t.closest('[data-view]'); if (g) { go(JSON.parse(g.getAttribute('data-view'))); return; }
  var a = t.closest('a[data-href]'); if (a) { e.preventDefault(); followLink(a.getAttribute('data-href')); return; }
  var c = t.closest('[data-copy]'); if (c) { copy(c.getAttribute('data-copy')); return; }
}
function followLink(href) {
  var clean = href.split('#')[0].split('?')[0], file = base(decodeURIComponent(clean)), hash = href.split('#')[1];
  if (!clean && hash) { var m = document.getElementById('main'), tgt = Array.prototype.filter.call(m.querySelectorAll('[data-h]'), function (h) { return h.textContent.replace(/\W+/g, '').toLowerCase().indexOf(hash.replace(/\W+/g, '').toLowerCase()) >= 0; })[0]; if (tgt) tgt.scrollIntoView(); return; }
  var a = D.apis.filter(function (x) { return x.file === file; })[0];
  if (a) { go({ name: 'api', id: a.id }); return; }
  copy(href); UI.toast('That page isn\'t in your folder, so the link was copied instead of opened.');
}
function vattr(v) { return " data-view='" + esc(JSON.stringify(v)) + "'"; }
function star(v) { return '<button class="ghost icon star' + (isMarked(v) ? ' on' : '') + '" data-star title="' + (isMarked(v) ? 'Remove bookmark' : 'Bookmark') + '">' + ICONS('star') + '</button>'; }
function bindStar(m, v) { var s = m.querySelector('[data-star]'); if (s) s.onclick = function () { toggleMark(v); s.classList.toggle('on', isMarked(v)); }; }

/* ---------- pages ---------- */
function render() {
  var m = document.getElementById('main'); if (!m) return; D.nodes = []; var v = D.view;
  var fn = { home: pHome, area: pArea, schema: pSchema, type: pType, pkg: pPkg, api: pApi, guide: pGuide, search: pSearch, marks: pMarks, notes: pNotes, reports: pReports, infos: pInfos, info: pInfo, learn: pLearn, lesson: pLesson, practice: pPractice, entries: pEntries, sols: pSols, sol: pSol }[v.name] || pHome;
  fn(m, v);
}
var LINKS = [
  ['Developer documentation home', 'https://salesforcecommercecloud.github.io/b2c-dev-doc/'],
  ['XML schemas (download the zip here)', 'https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/xsd/'],
  ['Script API reference', 'https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/index.html'],
  ['Job step reference', 'https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/jobstepapi/html/index.html']
];
function howToAdd() {
  return '<div class="card" style="padding:14px 16px"><b>Add official docs to this folder</b><ol class="steps">' +
    '<li><b>Schemas:</b> download the schema zip, or single .xsd files, and put them in this folder. Zips are read directly; no need to unpack.</li>' +
    '<li><b>Script API:</b> open a class page (for example ProductMgr), press <kbd>Ctrl</kbd>+<kbd>S</kbd> (<kbd>Cmd</kbd>+<kbd>S</kbd> on Mac), and save it as <i>Webpage, HTML only</i> into a <code>Script API</code> subfolder.</li>' +
    '<li><b>Your own guides:</b> any .md or .txt file is shown under Guides.</li>' +
    '<li><b>Several releases:</b> give each release its own subfolder, for example <code>26.1</code> and <code>26.2</code>, and you can switch between versions.</li>' +
    '<li>Click ' + ICONS('refresh') + ' Reload.</li></ol>' +
    '<div class="small muted" style="margin-bottom:6px">Where to get them (open on any computer that may browse the web, then copy the files over). The app itself never goes online, so these are copy buttons, not links.</div>' +
    LINKS.map(function (l) { return '<div class="row lnk"><span class="grow"><span class="small">' + esc(l[0]) + '</span><br><span class="mono small faint">' + esc(l[1]) + '</span></span><button class="ghost" data-copy="' + esc(l[1]) + '">' + ICONS('copy') + 'Copy</button></div>'; }).join('') + '</div>';
}
function listRow(v, icon, label, sub, right) { return '<div class="sub"' + vattr(v) + '><span class="ic">' + ICONS(icon, 'ic-lg') + '</span><div class="grow"><div class="nm ellip" style="font-size:14px">' + esc(label) + '</div>' + (sub ? '<div class="small faint ellip">' + esc(sub) + '</div>' : '') + '</div>' + (right || '') + '</div>'; }
function iconOfKey(k) { return /^info/.test(k) ? 'fileText' : /^lesson/.test(k) ? 'book' : /^sol/.test(k) ? 'folder' : /^schema/.test(k) ? 'fileCode' : /^type/.test(k) ? 'braces' : /^api/.test(k) ? 'code' : 'fileText'; }
function guideBlurb(t) { var lines = t.split('\n').filter(function (l) { return l.trim() && !/^\s*(#|\||```|<)/.test(l); }); return first((lines[0] || '').replace(/^[-*\d.\s\[\]x]+/, '').replace(/[*`]|\[\[[^|\]]*\|?|\]\]/g, '')); }
function pHome(m) {
  var areas = {}; D.schemas.forEach(function (S) { areas[S.area] = (areas[S.area] || 0) + 1; });
  var h = '<div class="wrap"><div class="ptitle">' + ICONS('book', 'ic-lg') + '<h1>SFCC Docs</h1><span class="small faint">' + esc(D.rootName) + '</span></div>' +
    '<div class="stats"><div class="stat">' + ICONS('fileCode') + '<div class="l">Schemas</div><div class="v">' + D.schemas.length + '</div></div><div class="stat">' + ICONS('code') + '<div class="l">Script API pages</div><div class="v">' + D.apis.length + '</div></div><div class="stat">' + ICONS('info') + '<div class="l">Guides</div><div class="v">' + D.guides.length + '</div></div><div class="stat">' + ICONS('star') + '<div class="l">Bookmarks</div><div class="v">' + D.meta.bookmarks.length + '</div></div></div>';
  if (D.bad && D.bad.length) h += '<div class="card warnc">' + ICONS('alert') + ' ' + D.bad.length + ' file(s) couldn\'t be read: ' + D.bad.slice(0, 5).map(function (b) { return '<code>' + esc(b.path) + '</code> (' + esc(b.msg) + ')'; }).join(', ') + '</div>';
  h += '<div class="hgrid"><div>' + learnCard();
  if (D.schemas.length) {
    h += '<div class="side-sec" style="padding-left:0">Schemas by area</div><div class="tiles">' + AREAS.concat([['other', 'Other schemas', 'fileCode']]).filter(function (a) { return areas[a[0]]; }).map(function (a) {
      var names = D.schemas.filter(function (S) { return S.area === a[0]; }).map(function (S) { return S.name; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
      return '<div class="tile"' + vattr({ name: 'area', area: a[0] }) + '>' + ICONS(a[2], 'ic') + '<b>' + esc(a[1]) + '</b><span>' + esc(names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : '')) + '</span></div>';
    }).join('') + '</div>';
  }
  if (D.apis.length) {
    var pk = {}; D.apis.forEach(function (a) { pk[a.pkg] = (pk[a.pkg] || 0) + 1; });
    h += '<div class="side-sec" style="padding-left:0">Script API</div><div class="tiles">' + Object.keys(pk).sort(nat).map(function (p) { return '<div class="tile"' + vattr({ name: 'pkg', pkg: p }) + '>' + ICONS('code', 'ic') + '<b class="mono">' + esc(p) + '</b><span>' + pk[p] + ' page' + (pk[p] > 1 ? 's' : '') + '</span></div>'; }).join('') + '</div>';
  }
  var builtins = D.guides.filter(function (g) { return g.builtIn; });
  if (builtins.length) h += '<div class="side-sec" style="padding-left:0">Guides</div><div class="list">' + builtins.map(function (g) { return listRow({ name: 'guide', id: g.id }, 'info', g.name, guideBlurb(g.text), badge('claude', true)); }).join('') + '</div>';
  h += '<div style="margin-top:14px">' + howToAdd() + '</div></div><div>';
  var sl = solList();
  h += '<div class="side-sec row" style="padding-left:0"><span class="grow">' + esc(solLabel()) + '</span><a class="small" style="cursor:pointer;color:var(--accent-text)"' + vattr({ name: 'sols' }) + '>Open</a></div>' + (sl.length ? '<div class="list">' + sl.slice(0, 5).map(function (x) { return listRow({ name: 'sol', id: x.id }, 'folder', x.title, (x.meta.date || '') + (x.files.length ? ' · ' + x.files.length + ' files' : '')); }).join('') + '</div>' : '<div class="card empty small" style="cursor:pointer"' + vattr({ name: 'sols' }) + '>Record features you built, with code and tests.</div>');
  h += '<div class="side-sec" style="padding-left:0">What the badges mean</div><div class="card legend">' + ['official', 'claude', 'gen', 'mine', 'own'].map(function (k) { return '<div class="lg">' + badge(k) + '<span class="small muted">' + esc(BADGE[k][3]) + '</span></div>'; }).join('') + '</div>';
  h += '<div class="side-sec" style="padding-left:0">Bookmarks</div>' + (D.meta.bookmarks.length ? '<div class="list">' + D.meta.bookmarks.slice(0, 8).map(function (b) { return listRow(viewFromKey(b.key), iconOfKey(b.key), b.label, b.sub); }).join('') + '</div>' : '<div class="card empty small">Click ' + ICONS('star') + ' on any page to keep it here.</div>');
  h += '<div class="side-sec" style="padding-left:0">Recently viewed</div>' + (D.meta.recent.length ? '<div class="list">' + D.meta.recent.slice(0, 8).map(function (b) { return listRow(viewFromKey(b.key), iconOfKey(b.key), b.label, b.sub, '<span class="small faint">' + UI.ago(b.at) + '</span>'); }).join('') + '</div>' : '<div class="card empty small">Nothing yet.</div>');
  h += '</div></div></div>';
  m.innerHTML = h;
}
function schemaRow(S) {
  var others = D.schemas.filter(function (x) { return x.name === S.name; }).length;
  return listRow({ name: 'schema', id: S.id }, 'fileCode', S.name + '.xsd', (S.roots.length ? '<' + S.roots.join('>, <') + '>' : '') + (S.nsDate ? ' · namespace ' + S.nsDate : '') + (S.version ? ' · ' + S.version : ''),
    '<span class="small faint">' + Object.keys(S.ct).length + ' types' + (others > 1 ? ' · ' + others + ' versions' : '') + '</span>' + badge(S.src, true));
}
function pArea(m, v) {
  var a = areaInfo(v.area), list = D.schemas.filter(function (S) { return S.area === v.area; });
  m.innerHTML = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <span>Schemas</span></div><div class="ptitle">' + ICONS(a[2], 'ic-lg') + '<h1>' + esc(a[1]) + '</h1></div>' +
    '<div class="list">' + list.map(schemaRow).join('') + '</div></div>';
}
function versionSel(S) {
  var vs = D.schemas.filter(function (x) { return x.name === S.name; }); if (vs.length < 2) return '';
  return '<select data-ver title="Switch version">' + vs.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === S.id ? ' selected' : '') + '>' + esc(x.version || 'Top folder') + '</option>'; }).join('') + '</select>';
}
function bindVer(m, v) { var s = m.querySelector('[data-ver]'); if (s) s.onchange = function () { var S = byId(s.value); go(Object.assign({}, v, { id: s.value, focus: null }, v.name === 'type' && S && !(v.k === 'ct' ? S.ct : S.st)[v.t] ? { name: 'schema' } : {})); }; }
function pSchema(m, v) {
  var S = byId(v.id); if (!S) { m.innerHTML = '<div class="wrap empty"><h2>That schema is no longer in the folder</h2></div>'; return; }
  var tab = v.tab || 'structure', a = areaInfo(S.area);
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'area', area: S.area }) + '>' + esc(a[1]) + '</a></div>' +
    '<div class="ptitle">' + ICONS('fileCode', 'ic-lg') + '<h1>' + esc(S.name) + '.xsd</h1>' + badge(S.src) + (S.fromZip ? '<span class="vb zip" title="Read from ' + esc(S.path.split('!')[0]) + '">' + ICONS('packages') + 'from zip</span>' : '') + '<span class="grow"></span>' + versionSel(S) + star(v) + (S.roots.length ? '<button data-sample>' + ICONS('code') + 'XML skeleton</button>' : '') + '</div>' +
    '<div class="metarow">' + (S.ns ? '<span class="chip" data-copy="' + esc(S.ns) + '" title="Click to copy">' + ICONS('copy') + ' xmlns ' + esc(S.ns) + '</span>' : '') + (S.version ? '<span class="chip">' + esc(S.version) + '</span>' : '') + '<span class="chip">' + esc(S.path) + '</span></div>' +
    (S.schemaDoc ? '<div class="xdoc">' + esc(S.schemaDoc) + '</div>' : '') +
    '<div class="sftabs">' + [['structure', 'Structure'], ['types', 'Types (' + (Object.keys(S.ct).length + Object.keys(S.st).length) + ')'], ['source', 'Source']].map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '<span class="grow"></span>' + (tab === 'structure' ? '<span class="tbar"><button class="ghost sm" data-exp title="Open two more levels">' + ICONS('chevD') + 'Expand</button><button class="ghost sm" data-col title="Close all">' + ICONS('chevR') + 'Collapse</button></span>' : '') + '</div><div class="tabbody">';
  if (tab === 'structure') {
    h += '<div class="small muted" style="margin:4px 0 10px">Elements must appear in the order shown. Click a row for details, attributes and allowed values.</div>';
    h += S.roots.length ? '<div class="xtree">' + S.roots.map(function (r) { return elRow(decl(S, S.el[r]), 0); }).join('') + '</div>' : '<div class="card empty">This file defines types only, with no root element.</div>';
    var extra = S.order.filter(function (n) { return S.roots.indexOf(n) < 0; });
    if (extra.length) h += '<div class="small faint" style="margin-top:12px">Also declared at top level (for partial files): ' + extra.map(function (n) { return '<code>' + esc(n) + '</code>'; }).join(' ') + '</div>';
  } else if (tab === 'types') {
    h += '<input type="search" data-tf placeholder="Filter types…" style="width:100%;max-width:360px;margin:6px 0 10px">' + typeList(S, 'ct', 'Complex types (elements with children or attributes)') + typeList(S, 'st', 'Simple types (value rules and allowed values)');
  } else h += '<pre class="xsrc">' + MD.highlight(S.text, 'xml') + '</pre>';
  h += '</div>' + noteCard(v) + '</div>';
  m.innerHTML = h;
  bindStar(m, v); bindVer(m, v); bindNote(m, v);
  m.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { D.view = Object.assign({}, v, { tab: b.getAttribute('data-tab'), focus: null }); render(); }; });
  var sb = m.querySelector('[data-sample]'); if (sb) sb.onclick = function () { sampleDialog(decl(S, S.el[S.roots[0]])); };
  var tree = m.querySelector('.xtree');
  if (tree) {
    var r0 = tree.querySelector('.xr[data-n]'); if (r0) expandRow(r0);
    m.querySelector('[data-exp]').onclick = function () { expandAll(tree, 2); };
    m.querySelector('[data-col]').onclick = function () { tree.querySelectorAll('.xn.open > .xr').forEach(collapseRow); };
    if (v.focus) focusEl(tree, v.focus);
  }
  var tf = m.querySelector('[data-tf]'); if (tf) tf.oninput = function () { var q = tf.value.toLowerCase(); m.querySelectorAll('.tlist .sub').forEach(function (r) { r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); };
}
function typeList(S, k, title) {
  var names = Object.keys(k === 'ct' ? S.ct : S.st).sort(nat); if (!names.length) return '';
  return '<div class="side-sec" style="padding-left:0">' + esc(title) + '</div><div class="list tlist">' + names.map(function (t) {
    var n = (k === 'ct' ? S.ct : S.st)[t], d = docOf(n), dep = /deprecated/i.test(d);
    var extra = k === 'st' ? (function () { var i = simpleInfo(S, t, null, n); return i.enums.length ? i.enums.length + ' values' : i.label; })() : '';
    return '<div class="sub"' + vattr({ name: 'type', id: S.id, k: k, t: t }) + '><span class="ic">' + ICONS(k === 'ct' ? 'braces' : 'listCheck') + '</span><div class="grow"><div class="nm mono ellip" style="font-size:13px">' + esc(t) + (dep ? ' <span class="chip w">deprecated</span>' : '') + '</div>' + (d ? '<div class="small faint ellip">' + esc(first(d)) + '</div>' : '') + '</div><span class="small faint">' + esc(extra) + '</span></div>';
  }).join('') + '</div>';
}
function usedBy(S, t) {
  var out = [], seen = {};
  Array.prototype.forEach.call(S.doc.getElementsByTagNameNS(XS, '*'), function (n) {
    if (ln(n.getAttribute('type')) !== t && ln(n.getAttribute('base')) !== t && ln(n.getAttribute('itemType')) !== t) return;
    var p = n, owner = null, el = n.localName === 'element' || n.localName === 'attribute' ? n.getAttribute('name') : '';
    while (p && p.parentNode && p.parentNode.nodeType === 1) { if (p.parentNode.localName === 'schema') { owner = p; break; } p = p.parentNode; }
    if (!owner) return;
    var on = owner.getAttribute('name'), k = owner.localName === 'complexType' ? 'ct' : owner.localName === 'simpleType' ? 'st' : 'el', key = k + on + el;
    if (seen[key] || on === t) return; seen[key] = 1;
    out.push({ el: el || (n.localName === 'extension' ? 'extends it' : n.localName === 'restriction' ? 'restricts it' : ''), owner: on, k: k, attr: n.localName === 'attribute' });
  });
  return out;
}
function pType(m, v) {
  var S = byId(v.id), node = S && (v.k === 'ct' ? S.ct : S.st)[v.t];
  if (!node) { m.innerHTML = '<div class="wrap empty"><h2>Type not found</h2><p class="muted">' + esc(v.t) + '</p></div>'; return; }
  var d = docOf(node), h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'area', area: S.area }) + '>' + esc(areaInfo(S.area)[1]) + '</a> / <a' + vattr({ name: 'schema', id: S.id }) + '>' + esc(S.name) + '.xsd</a> / <a' + vattr({ name: 'schema', id: S.id, tab: 'types' }) + '>Types</a></div>' +
    '<div class="ptitle">' + ICONS(v.k === 'ct' ? 'braces' : 'listCheck', 'ic-lg') + '<h1 class="mono" style="font-size:19px">' + esc(v.t) + '</h1>' + badge(S.src) + '<span class="grow"></span>' + versionSel(S) + star(v) + '</div>';
  if (v.k === 'ct') {
    var c = ctContent(S, node);
    if (c.base) h += '<div class="small muted" style="margin-bottom:8px">Builds on ' + (isBuiltin(node.querySelector('*') || node, c.base) || !S.ct[ln(c.base)] ? '<code>' + esc(c.base) + '</code>' : '<a class="xt" data-type="ct:' + esc(ln(c.base)) + '">' + esc(ln(c.base)) + '</a>') + ' (its fields are included below).</div>';
    h += '<div class="xtree">' + bodyHtml(S, c, d) + '</div>';
  } else {
    var i = simpleInfo(S, v.t, null, node);
    h += (d ? '<div class="xdoc">' + esc(d) + '</div>' : '') + '<div class="xsec">Value</div><div>' + simpleHtml({ label: i.label, facets: i.facets, enums: [] }) + '</div>';
    if (i.enums.length) h += '<div class="xsec">Allowed values</div><table class="xat"><tbody>' + i.enums.map(function (e) { return '<tr><td class="mono">' + esc(e.v) + '</td><td class="small muted">' + esc(e.doc || '') + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  var ub = usedBy(S, v.t);
  if (ub.length) h += '<div class="xsec">Used by</div><div class="list">' + ub.slice(0, 60).map(function (u) {
    var to = u.k === 'el' ? { name: 'schema', id: S.id, focus: u.el || u.owner } : { name: 'type', id: S.id, k: u.k, t: u.owner, focus: u.el };
    return '<div class="sub"' + vattr(to) + '><span class="ic">' + ICONS(u.k === 'el' ? 'fileCode' : 'braces') + '</span><div class="grow mono small">' + esc(u.owner) + (u.el ? ' › ' + (u.attr ? '@' : '') + esc(u.el) : '') + '</div></div>';
  }).join('') + '</div>';
  h += noteCard(v) + '</div>';
  m.innerHTML = h; bindStar(m, v); bindVer(m, v); bindNote(m, v);
  if (v.focus) { var tr = m.querySelector('.xtree'); if (tr) focusEl(tr, v.focus); }
}
function pPkg(m, v) {
  var list = D.apis.filter(function (a) { return a.pkg === v.pkg; });
  m.innerHTML = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <span>Script API</span></div><div class="ptitle">' + ICONS('code', 'ic-lg') + '<h1 class="mono">' + esc(v.pkg) + '</h1></div><div class="list">' +
    list.map(function (a) { return listRow({ name: 'api', id: a.id }, 'code', a.title, a.path, badge(a.src, true)); }).join('') + '</div></div>';
}
function pApi(m, v) {
  var a = apiById(v.id); if (!a) { m.innerHTML = '<div class="wrap empty"><h2>Page not found</h2></div>'; return; }
  var toc = a.heads.filter(function (x) { return x.lv <= 3; });
  m.innerHTML = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'pkg', pkg: a.pkg }) + '>' + esc(a.pkg) + '</a></div>' +
    '<div class="ptitle">' + ICONS('code', 'ic-lg') + '<h1>' + esc(a.title) + '</h1>' + badge(a.src) + '<span class="grow"></span>' + star(v) + '</div><div class="metarow"><span class="chip">' + esc(a.path) + '</span><span class="small faint">Saved page shown as text only. Images, scripts and outside links are removed.</span></div>' +
    '<div class="apiw">' + (toc.length > 2 ? '<nav class="toc"><div class="side-sec">On this page</div>' + toc.map(function (x) { return '<div class="tl l' + x.lv + '" data-goh="' + x.i + '">' + esc(x.t) + '</div>'; }).join('') + '</nav>' : '') + '<article class="md apibody">' + cleanHtml(a.html) + '</article></div>' + noteCard(v) + '</div>';
  bindStar(m, v); bindNote(m, v);
  function goH(i) { var t = m.querySelector('[data-h="' + i + '"]'); if (t) { t.scrollIntoView({ block: 'start' }); t.classList.add('hit'); setTimeout(function () { t.classList.remove('hit'); }, 1600); } }
  m.querySelectorAll('[data-goh]').forEach(function (x) { x.onclick = function () { goH(x.getAttribute('data-goh')); }; });
  if (v.h != null) goH(v.h);
}
function pGuide(m, v) {
  var g = guideById(v.id); if (!g) { m.innerHTML = '<div class="wrap empty"><h2>Guide not found</h2></div>'; return; }
  m.innerHTML = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <span>Guides</span></div><div class="ptitle">' + ICONS(g.builtIn ? 'info' : 'fileText', 'ic-lg') + '<h1>' + esc(g.name) + '</h1>' + badge(g.builtIn ? 'claude' : 'own') + '<span class="grow"></span>' + reportBtn() + star(v) + '</div>' +
    (g.builtIn ? '<div class="aibox">' + ICONS('info') + '<div><b>Rephrased by Claude, not official text.</b> This guide was written by Claude in its own words from Trailhead and the Salesforce docs. It can be incomplete or out of date. Check the sources at the end before relying on it for production imports.</div></div>' : '<div class="metarow"><span class="chip">' + esc(g.path) + '</span></div>') +
    '<article class="md guide">' + (g.kind === 'md' ? MD.render(g.text) : '<pre>' + esc(g.text) + '</pre>') + '</article>' +
    (g.sources && g.sources.length ? '<div class="card" style="padding:10px 14px;margin-top:14px"><b class="small">Sources to read more</b>' + g.sources.map(function (s) { return '<div class="row lnk"><span class="grow small">' + esc(s[0]) + '<br><span class="mono faint">' + esc(s[1]) + '</span></span><button class="ghost" data-copy="' + esc(s[1]) + '">' + ICONS('copy') + 'Copy</button></div>'; }).join('') + '</div>' : '') +
    noteCard(v) + '</div>';
  bindStar(m, v); bindNote(m, v); bindReport(m, v);
  m.querySelectorAll('.guide [data-target]').forEach(function (w) { w.onclick = function () { var t = w.getAttribute('data-target'); var hit = D.guides.filter(function (x) { return x.name === t || x.id === 'builtin:' + t; })[0]; if (hit) go({ name: 'guide', id: hit.id }); else { var s = D.schemas.filter(function (x) { return x.name === t; })[0]; if (s) go({ name: 'schema', id: s.id }); else UI.toast('Add ' + t + ' to your docs folder to open it.', true); } }; });
}
var KIND = { info: ['My SFCC info', 'fileText'], learn: ['Learn SFCC topics', 'book'], lq: ['Interview questions', 'help'], entry: ['My entries', 'edit'], sol: ['Solution notes', 'folder'], el: ['Elements', 'fileCode'], type: ['Types', 'braces'], enum: ['Allowed values', 'listCheck'], api: ['Script API pages', 'code'], apih: ['Script API sections', 'code'], guide: ['Guides', 'info'], note: ['My notes', 'edit'] };
function pSearch(m, v) {
  var res = search(v.q), groups = {}; res.forEach(function (r) { (groups[r.e.k] = groups[r.e.k] || []).push(r); });
  var h = '<div class="wrap"><div class="ptitle">' + ICONS('search', 'ic-lg') + '<h1>' + res.length + ' result' + (res.length === 1 ? '' : 's') + ' for “' + esc(v.q) + '”</h1></div>';
  if (!res.length) h += '<div class="card empty"><h2>Nothing found</h2>Try fewer words, or add more docs to the folder.</div>';
  ['info', 'sol', 'entry', 'learn', 'lq', 'el', 'type', 'enum', 'api', 'apih', 'guide', 'note'].forEach(function (k) {
    var g = groups[k]; if (!g) return;
    h += '<div class="side-sec" style="padding-left:0">' + (k === 'sol' ? solLabel() : KIND[k][0]) + ' · ' + g.length + '</div><div class="list">' + g.slice(0, 40).map(function (r) {
      var e = r.e, sn = r.s >= 3 && e.doc ? '<div class="small muted">' + snippet(e.doc, v.q) + '</div>' : '';
      return '<div class="sub"' + vattr(e.view) + '><span class="ic">' + ICONS(KIND[k][1]) + '</span><div class="grow"><div class="nm ellip ' + (k === 'el' || k === 'type' || k === 'enum' ? 'mono' : '') + '" style="font-size:14px">' + esc(e.label) + '</div><div class="small faint ellip">' + esc(e.sub) + '</div>' + sn + '</div>' + badge(k === 'note' ? 'note' : e.mine ? 'mine' : srcOf(e.view), true) + '</div>';
    }).join('') + (g.length > 40 ? '<div class="sub small faint">' + (g.length - 40) + ' more. Add words to narrow it down.</div>' : '') + '</div>';
  });
  m.innerHTML = h + '</div>';
}
function pMarks(m) {
  m.innerHTML = '<div class="wrap"><div class="ptitle">' + ICONS('star', 'ic-lg') + '<h1>Bookmarks</h1></div>' + (D.meta.bookmarks.length ? '<div class="list">' + D.meta.bookmarks.map(function (b) { return listRow(viewFromKey(b.key), iconOfKey(b.key), b.label, b.sub); }).join('') + '</div>' : '<div class="card empty">Click ' + ICONS('star') + ' on any schema, type, Script API page or guide to keep it here. Bookmarks are saved in <code>' + META + '</code> in your docs folder.</div>') + '</div>';
}
function pNotes(m) {
  var ks = Object.keys(D.notes).sort(function (a, b) { return D.notes[b].lm - D.notes[a].lm; });
  m.innerHTML = '<div class="wrap"><div class="ptitle">' + ICONS('edit', 'ic-lg') + '<h1>My notes</h1></div>' + (ks.length ? '<div class="list">' + ks.map(function (k) { var n = D.notes[k], vv = viewFromKey(k); return '<div class="sub"' + (vv ? vattr(vv) : '') + '><span class="ic">' + ICONS('edit') + '</span><div class="grow"><div class="nm ellip" style="font-size:14px">' + esc(noteLabel(k)) + '</div><div class="small muted ellip">' + esc(first(n.text)) + '</div></div><span class="small faint">' + UI.ago(n.lm) + '</span></div>'; }).join('') + '</div>' : '<div class="card empty">Open any page and use <b>Add note</b> at the bottom. Notes are Markdown files in the <code>Notes</code> folder.</div>') + '</div>';
}

/* ---------- start ---------- */
async function pickRoot() {
  try { var h = await window.showDirectoryPicker({ id: 'sfcc-docs', mode: 'readwrite' }); await IDB.set('root', h); await openRoot(h); }
  catch (e) { if (e.name !== 'AbortError') UI.toast(e.message, true); }
}
async function openRoot(h) {
  if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Permission to read the folder was not given.');
  D.root = h; D.rootName = h.name;
  shell(); document.getElementById('main').innerHTML = '<div class="wrap empty">Reading docs…</div>';
  await scan(); D.view = { name: 'home' }; renderSide(); render();
}
async function welcome() {
  var app = document.getElementById('app');
  if (!window.showDirectoryPicker) { app.innerHTML = '<div class="welcome"><div class="logo">' + ICONS('alert') + '</div><h1>Open this file in Chrome or Edge</h1><p class="muted">SFCC Docs uses the browser\'s built-in folder access, which only Chrome and Microsoft Edge support.</p></div>'; return; }
  var last = await IDB.get('root');
  app.innerHTML = '<div class="welcome"><div class="logo">' + ICONS('book') + '</div><h1>SFCC Docs</h1><p class="muted">An offline library for SFCC. Pick the folder where you keep the official schema files, Script API pages saved from your browser, and your own guides. Built-in guides are included.</p>' +
    '<div class="acts">' + (last ? '<button class="primary" id="reopen">' + ICONS('folderOpen') + 'Reopen “' + esc(last.name) + '”</button><button id="pick">Open another folder</button>' : '<button class="primary" id="pick">' + ICONS('folderOpen') + 'Open docs folder</button>') + '</div>' +
    '<div class="safe">' + ICONS('lock') + ' Works offline. Nothing is uploaded and no AI is used.</div><div style="margin-top:18px">' + UI.themeSwitch() + '</div></div>';
  UI.Theme.apply();
  document.getElementById('pick').onclick = pickRoot;
  var re = document.getElementById('reopen');
  if (re) { re.onclick = function () { openRoot(last).catch(function (e) { UI.toast(e.message, true); }); }; try { if ((await last.queryPermission({ mode: 'readwrite' })) === 'granted') openRoot(last); } catch (e) { } }
}
UI.Theme.key = 'sd-theme'; UI.Theme.def = 'dark';
UI.Theme.init();
welcome();
})();
