/* ========== Learn SFCC, My entries, Solution notes ========== */
var LEARN = window.SFCC_LEARN || [];
var ENTRY_DIR = 'My learning';
var MODES = [
  ['easy', 'Easy', 'Plain words, everyday comparisons, beginner questions.', 'info'],
  ['crash', 'Crash course', 'Only the must-know points and the most-asked interview questions.', 'bolt'],
  ['standard', 'Standard', 'Full lessons with code, notes, every question and worked problems.', 'book']
];
var ETYPES = [
  ['question', 'Interview question', 'help'],
  ['feature', 'Feature we built', 'bolt'],
  ['test', 'Test case', 'listCheck'],
  ['code', 'Code snippet', 'code'],
  ['note', 'Note', 'edit']
];
var CODE_LANGS = [['js', 'JavaScript'], ['isml', 'ISML / HTML'], ['xml', 'XML'], ['json', 'JSON'], ['css', 'CSS / SCSS'], ['properties', 'Properties'], ['sh', 'Shell'], ['sql', 'Query'], ['text', 'Plain text']];
var SOL_PARTS = [
  ['requirement', 'Requirement', 'What was needed and why.'],
  ['approach', 'Approach', 'What you built and how: cartridges, controllers, hooks, jobs, services, settings.'],
  ['tests', 'Tests', 'Test cases, steps and results.'],
  ['outcome', 'Outcome', 'Result or impact. Numbers help.'],
  ['talking', 'Talking points', 'How you would explain it in an interview (situation, task, action, result).']
];
function solDir() { return (D.meta.solDir || 'Solution notes'); }
function solLabel() { return (D.meta.solLabel || 'Solution notes'); }
function lmode() { return (D.meta.learn && D.meta.learn.mode) || 'standard'; }
function lstate() { if (!D.meta.learn) D.meta.learn = { mode: 'standard', done: {}, known: {} }; D.meta.learn.done = D.meta.learn.done || {}; D.meta.learn.known = D.meta.learn.known || {}; return D.meta.learn; }
function lessonById(id) { return LEARN.filter(function (l) { return l.id === id; })[0]; }
function langOf(name) { var e = (String(name).match(/\.([^.]+)$/) || [])[1] || ''; e = e.toLowerCase(); return { js: 'js', ds: 'js', mjs: 'js', isml: 'xml', html: 'xml', htm: 'xml', xml: 'xml', xsd: 'xml', json: 'json', css: 'css', scss: 'css', less: 'css', properties: 'properties', sh: 'sh', yml: 'yml', yaml: 'yml', sql: 'sql', md: 'md' }[e] || 'text'; }
function codeBlock(code, lang) { var l = lang === 'isml' ? 'xml' : lang; return '<pre class="xsrc codeview">' + (l === 'text' || !l ? esc(code) : MD.highlight(code, l)) + '</pre>'; }

/* ---------- entry and solution files ---------- */
function parseParts(text, tag) {
  var m = text.match(new RegExp('^<!-- ' + tag + ' (\\{[\\s\\S]*?\\}) -->\\n?'));
  var meta = {}; try { meta = m ? JSON.parse(m[1]) : {}; } catch (e) { }
  var body = m ? text.slice(m[0].length) : text, parts = {}, re = /<!-- part:([a-z]+)(?: lang=([a-z]+))? -->\n?/g, last = null, idx = 0, mm;
  while ((mm = re.exec(body))) { if (last) parts[last.k] = { text: body.slice(idx, mm.index).replace(/\n+$/, ''), lang: last.lang }; last = { k: mm[1], lang: mm[2] }; idx = re.lastIndex; }
  if (last) parts[last.k] = { text: body.slice(idx).replace(/\n+$/, ''), lang: last.lang }; else if (body.trim()) parts.body = { text: body.trim() };
  if (parts.code && /^```/.test(parts.code.text)) parts.code.text = parts.code.text.replace(/^```[a-z]*\n?/, '').replace(/\n?```\s*$/, '');
  return { meta: meta, parts: parts };
}
function writeParts(tag, meta, parts) {
  var out = '<!-- ' + tag + ' ' + JSON.stringify(meta) + ' -->\n';
  parts.forEach(function (p) { if (p.text == null || p.text === '') return; out += '<!-- part:' + p.k + (p.lang ? ' lang=' + p.lang : '') + ' -->\n' + (p.k === 'code' ? '```' + (p.lang || '') + '\n' + p.text + '\n```' : p.text) + '\n\n'; });
  return out;
}
function loadMine(files) {
  D.entries = []; D.sols = {};
  files.forEach(function (f) {
    if (f.path.indexOf(ENTRY_DIR + '/') === 0 && /\.md$/i.test(f.path)) {
      var r = parseParts(f.text, 'sfcc-entry'), m = r.meta;
      D.entries.push({ path: f.path, lm: f.lm, type: m.type || 'note', topic: m.topic || 'general', title: m.title || stem(f.path), created: m.created || f.lm, body: (r.parts.body || {}).text || '', answer: (r.parts.answer || {}).text || '', code: (r.parts.code || {}).text || '', lang: (r.parts.code || {}).lang || 'js' });
    } else if (f.path.indexOf(solDir() + '/') === 0) {
      var rest = f.path.slice(solDir().length + 1), slash = rest.indexOf('/'); if (slash < 0) return;
      var id = rest.slice(0, slash), inner = rest.slice(slash + 1), s = D.sols[id] || (D.sols[id] = { id: id, dir: solDir() + '/' + id, title: id, files: [], parts: {}, meta: {}, lm: 0 });
      s.lm = Math.max(s.lm, f.lm || 0);
      if (inner === 'note.md') { var p = parseParts(f.text, 'sfcc-solution'); s.meta = p.meta; s.title = p.meta.title || id; Object.keys(p.parts).forEach(function (k) { s.parts[k] = p.parts[k].text; }); s.notePath = f.path; }
      else if (inner.indexOf('code/') === 0) s.files.push({ name: inner.slice(5), path: f.path, text: f.text, lm: f.lm });
    }
  });
  D.entries.sort(function (a, b) { return b.created - a.created; });
  Object.keys(D.sols).forEach(function (k) { D.sols[k].files.sort(function (a, b) { return nat(a.name, b.name); }); });
}
async function delPath(path, recursive) {
  var parts = path.split('/'), dh = D.root;
  for (var i = 0; i < parts.length - 1; i++) dh = await dh.getDirectoryHandle(parts[i]);
  await dh.removeEntry(parts[parts.length - 1], { recursive: !!recursive });
}
async function afterWrite(msg, v) { await scan(); renderSide(); if (v) D.view = v; render(); if (msg) UI.toast(msg); }

/* ---------- small code editor ---------- */
function codeEditor(opts) {
  var body = document.createElement('div'); body.className = 'cedw';
  body.innerHTML = '<div class="row" style="margin-bottom:8px;gap:8px">' + (opts.nameField ? '<input type="text" data-fn placeholder="file name, for example cartHelpers.js" value="' + esc(opts.name || '') + '" style="flex:1">' : '<b class="mono">' + esc(opts.name || '') + '</b><span class="grow"></span>') +
    '<span class="small faint">Tab indents · Shift+Tab outdents · Ctrl/Cmd+S saves</span></div>' +
    '<div class="ced"><pre class="cg" aria-hidden="true"></pre><textarea spellcheck="false" wrap="off"></textarea></div>';
  var ta = body.querySelector('textarea'), g = body.querySelector('.cg');
  ta.value = opts.text || '';
  function lines() { var n = ta.value.split('\n').length, s = ''; for (var i = 1; i <= n; i++) s += i + '\n'; g.textContent = s; }
  ta.addEventListener('input', lines); ta.addEventListener('scroll', function () { g.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault(); var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1;
      if (s === en && !e.shiftKey) { ta.setRangeText('    ', s, en, 'end'); }
      else { var blk = v.slice(ls, en), nb = e.shiftKey ? blk.replace(/^ {1,4}/gm, '') : blk.replace(/^/gm, '    '); ta.setRangeText(nb, ls, en, 'select'); }
      lines();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    else if (e.key === 'Enter') { var st = ta.selectionStart, ln = ta.value.slice(ta.value.lastIndexOf('\n', st - 1) + 1, st), ind = (ln.match(/^\s*/) || [''])[0] + (/[{[(]\s*$/.test(ln) ? '    ' : ''); e.preventDefault(); ta.setRangeText('\n' + ind, st, ta.selectionEnd, 'end'); lines(); }
  });
  lines();
  var modal;
  async function save() {
    var name = opts.nameField ? body.querySelector('[data-fn]').value.trim() : opts.name;
    if (!name || /[\\/:*?"<>|]/.test(name)) { UI.toast('Enter a file name without / \\ : * ? " < > |', true); return; }
    try { await opts.onSave(name, ta.value); modal.close(); } catch (e) { UI.toast('Could not save: ' + e.message, true); }
  }
  modal = UI.modal({ title: opts.title || 'Edit code', body: body, size: 'big', buttons: [{ label: 'Cancel', onClick: function (m) { m.close(); } }, { label: 'Save', primary: true, onClick: save }] });
  setTimeout(function () { ta.focus(); }, 30);
}

/* ---------- entry dialog ---------- */
function entryDialog(entry, topic) {
  var e = entry || { type: 'question', topic: topic || 'general', title: '', body: '', answer: '', code: '', lang: 'js' };
  var body = document.createElement('div'); body.className = 'sfform';
  function draw() {
    var t = e.type, lab = { question: ['Question', 'Your answer'], feature: ['What it does and how it was built', ''], test: ['Steps', 'Expected result'], code: ['What this code does', ''], note: ['Note', ''] }[t];
    body.innerHTML = '<div class="sfgrid">' +
      '<label class="sff"><span>Type</span><select data-k="type">' + ETYPES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === t ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="sff"><span>Topic</span><select data-k="topic"><option value="general">General</option>' + LEARN.map(function (l) { return '<option value="' + l.id + '"' + (l.id === e.topic ? ' selected' : '') + '>' + esc(l.title) + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="sff"><span>Title</span><input type="text" data-k="title" value="' + esc(e.title) + '" placeholder="Short title"></label>' +
      '<label class="sff"><span>' + lab[0] + ' <span class="faint">(Markdown)</span></span><textarea rows="5" data-k="body">' + esc(e.body) + '</textarea></label>' +
      (lab[1] ? '<label class="sff"><span>' + lab[1] + ' <span class="faint">(hidden until you tap Show)</span></span><textarea rows="4" data-k="answer">' + esc(e.answer) + '</textarea></label>' : '') +
      '<div class="sff"><span>Code <span class="faint">(optional)</span></span><div class="row" style="gap:8px;margin-bottom:6px"><select data-k="lang">' + CODE_LANGS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === e.lang ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select><button type="button" data-upl>' + ICONS('upload') + 'Load from file</button><input type="file" data-file hidden></div><textarea rows="8" class="mono" data-k="code" spellcheck="false" wrap="off">' + esc(e.code) + '</textarea></div>';
    body.querySelectorAll('[data-k]').forEach(function (el) { el.oninput = el.onchange = function () { e[el.getAttribute('data-k')] = el.value; if (el.getAttribute('data-k') === 'type') draw(); }; });
    var f = body.querySelector('[data-file]');
    body.querySelector('[data-upl]').onclick = function () { f.click(); };
    f.onchange = async function () { var file = f.files[0]; if (!file) return; if (file.size > 1048576) { UI.toast('File is over 1 MB', true); return; } e.code = await file.text(); e.lang = langOf(file.name) === 'css' ? 'css' : (CODE_LANGS.some(function (x) { return x[0] === langOf(file.name); }) ? langOf(file.name) : e.lang); if (!e.title) e.title = file.name; draw(); };
    var ta = body.querySelector('[data-k=code]'); ta.addEventListener('keydown', function (ev) { if (ev.key === 'Tab') { ev.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); e.code = ta.value; } });
  }
  draw();
  var btns = [{ label: 'Cancel', onClick: function (m) { m.close(); } }];
  if (entry) btns.unshift({ label: 'Delete', danger: true, onClick: function (m) { UI.confirm('Delete this entry?', esc('The file ' + entry.path + ' will be deleted.'), 'Delete', true).then(async function (ok) { if (!ok) return; try { await delPath(entry.path); m.close(); await afterWrite('Entry deleted'); } catch (er) { UI.toast(er.message, true); } }); } });
  btns.push({ label: 'Save', primary: true, onClick: async function (m) {
    if (!e.title.trim()) { UI.toast('Add a title', true); return; }
    var meta = { type: e.type, topic: e.topic, title: e.title.trim(), created: entry ? entry.created : Date.now() };
    var text = writeParts('sfcc-entry', meta, [{ k: 'body', text: e.body }, { k: 'answer', text: e.answer }, { k: 'code', text: e.code, lang: e.lang }]);
    var path = entry ? entry.path : ENTRY_DIR + '/' + e.topic + '/' + e.type + '-' + slug(e.title) + '-' + Date.now().toString(36) + '.md';
    try {
      if (entry && (entry.topic !== e.topic || entry.type !== e.type)) { path = ENTRY_DIR + '/' + e.topic + '/' + e.type + '-' + slug(e.title) + '-' + Date.now().toString(36) + '.md'; await writeText(path, text); await delPath(entry.path); }
      else await writeText(path, text);
      m.close(); await afterWrite('Entry saved');
    } catch (er) { UI.toast('Could not save: ' + er.message, true); }
  } });
  UI.modal({ title: entry ? 'Edit entry' : 'Add an entry', body: body, size: 'mid', buttons: btns });
}
function entryHtml(e, i) {
  var t = ETYPES.filter(function (x) { return x[0] === e.type; })[0] || ETYPES[4], hasAns = !!e.answer;
  return '<div class="card entry" data-ei="' + i + '"><div class="row"><span class="etype">' + ICONS(t[2]) + esc(t[1]) + '</span><b class="grow">' + esc(e.title) + '</b>' + badge('mine', true) + '<button class="ghost icon" data-eedit="' + i + '" title="Edit">' + ICONS('edit') + '</button></div>' +
    (e.body ? '<div class="md">' + MD.render(e.body) + '</div>' : '') +
    (hasAns ? '<div class="reveal"><button class="sm" data-rev>' + ICONS('eye') + (e.type === 'test' ? 'Show expected result' : 'Show answer') + '</button><div class="ans md" hidden>' + MD.render(e.answer) + '</div></div>' : '') +
    (e.code ? codeBlock(e.code, e.lang) : '') + '</div>';
}
function bindEntries(m, list) {
  m.querySelectorAll('[data-eedit]').forEach(function (b) { b.onclick = function () { entryDialog(list[+b.getAttribute('data-eedit')]); }; });
  bindReveal(m);
}
function bindReveal(m) {
  m.querySelectorAll('[data-rev]').forEach(function (b) { b.onclick = function () { var a = b.parentNode.querySelector('.ans'); a.hidden = !a.hidden; b.innerHTML = ICONS(a.hidden ? 'eye' : 'eyeOff') + (a.hidden ? b.getAttribute('data-l1') || b.textContent.replace(/^Hide/, 'Show') : b.textContent.replace(/^Show/, 'Hide')); }; });
}

/* ---------- learn pages ---------- */
function modeSwitch(cur) {
  return '<div class="modesw" role="tablist">' + MODES.map(function (md) { return '<button data-mode="' + md[0] + '" class="' + (md[0] === cur ? 'on' : '') + '" title="' + esc(md[2]) + '">' + ICONS(md[3]) + md[1] + '</button>'; }).join('') + '</div>';
}
function bindMode(m) { m.querySelectorAll('[data-mode]').forEach(function (b) { b.onclick = function () { lstate().mode = b.getAttribute('data-mode'); saveMeta(); render(); renderSide(); }; }); }
function lessonQs(l, mode) { return l.q.filter(function (q) { return mode === 'easy' ? q.lv === 'basic' : mode === 'crash' ? q.top : true; }); }
function lessonPs(l, mode) { return l.p.filter(function (p) { return mode === 'easy' ? p.lv === 'easy' : mode === 'crash' ? p.lv === 'std' : true; }).slice(0, mode === 'crash' ? 1 : 9); }
function progressBar(done, total) { var pc = total ? Math.round(done * 100 / total) : 0; return '<div class="pbar"><span style="width:' + pc + '%"></span></div><div class="small muted">' + done + ' of ' + total + ' topics done · ' + pc + '%</div>'; }
function learnCard() {
  var st = lstate(), done = LEARN.filter(function (l) { return st.done[l.id]; }).length, next = LEARN.filter(function (l) { return !st.done[l.id]; })[0];
  return '<div class="card learncard"><div class="row"><span class="lc-ic">' + ICONS('book') + '</span><div class="grow"><b>Learn SFCC</b><div class="small muted">18 topics · interview questions · worked problems</div></div>' + badge('claude', true) + '</div>' +
    '<div class="row" style="margin:12px 0 8px;flex-wrap:wrap">' + modeSwitch(lmode()) + '</div>' + progressBar(done, LEARN.length) +
    '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">' + (next ? '<button class="primary"' + vattr({ name: 'lesson', id: next.id }) + '>' + ICONS('chevR') + (done ? 'Continue: ' : 'Start: ') + esc(next.title) + '</button>' : '<span class="small">All topics done 🎉</span>') +
    '<button' + vattr({ name: 'practice' }) + '>' + ICONS('help') + 'Practice questions</button><button' + vattr({ name: 'learn' }) + '>All topics</button></div></div>';
}
function pLearn(m) {
  var st = lstate(), mode = lmode(), known = Object.keys(st.known).length, totalQ = LEARN.reduce(function (n, l) { return n + l.q.length; }, 0);
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a></div><div class="ptitle">' + ICONS('book', 'ic-lg') + '<h1>Learn SFCC</h1>' + badge('claude') + '<span class="grow"></span><button' + vattr({ name: 'practice' }) + '>' + ICONS('help') + 'Practice questions</button><button' + vattr({ name: 'entries' }) + '>' + ICONS('edit') + 'My entries</button>' + reportBtn() + '</div>' +
    '<div class="aibox">' + ICONS('info') + '<div><b>Rephrased by Claude, not official text.</b> Lessons and answers were written by Claude from Trailhead and the Salesforce docs. Each topic lists its sources; check them for anything you rely on at work.</div></div>' +
    '<div class="side-sec" style="padding-left:0">How do you want to learn?</div><div class="modecards">' + MODES.map(function (md) {
      var mins = LEARN.reduce(function (n, l) { return n + (l.time ? l.time[md[0]] : 0); }, 0);
      return '<button class="modecard' + (md[0] === mode ? ' on' : '') + '" data-mode="' + md[0] + '">' + ICONS(md[3], 'ic-lg') + '<b>' + md[1] + '</b><span>' + esc(md[2]) + '</span><span class="faint small">About ' + Math.round(mins / 60 * 10) / 10 + ' hours in total</span></button>';
    }).join('') + '</div>' +
    '<div class="row" style="gap:24px;margin:14px 0 6px;flex-wrap:wrap"><div style="min-width:260px;flex:1">' + progressBar(LEARN.filter(function (l) { return st.done[l.id]; }).length, LEARN.length) + '</div><div class="small muted">' + known + ' of ' + totalQ + ' questions marked as known</div></div>' +
    '<div class="side-sec" style="padding-left:0">Topics</div><div class="lgrid">' + LEARN.map(function (l, i) {
      var mine = (D.entries || []).filter(function (e) { return e.topic === l.id; }).length;
      return '<div class="ltile' + (st.done[l.id] ? ' done' : '') + '"' + vattr({ name: 'lesson', id: l.id }) + '><div class="row"><span class="lnum">' + (st.done[l.id] ? ICONS('check') : (i + 1)) + '</span><b class="grow">' + esc(l.title) + '</b></div><div class="small muted">' + esc(l.summary) + '</div><div class="small faint" style="margin-top:6px">' + (l.time ? l.time[mode] + ' min · ' : '') + lessonQs(l, mode).length + ' questions · ' + lessonPs(l, mode).length + ' problems' + (mine ? ' · ' + mine + ' of yours' : '') + '</div></div>';
    }).join('') + '</div></div>';
  m.innerHTML = h; bindMode(m); bindReport(m, { name: 'learn' });
}
function qHtml(q, i, known) {
  return '<div class="qcard' + (known ? ' known' : '') + '"><div class="row" style="align-items:flex-start"><span class="qn">Q' + (i + 1) + '</span><div class="grow"><div class="qt">' + MD.inline(q.q) + '</div><div class="small faint">' + ({ basic: 'Basic', mid: 'Intermediate', adv: 'Advanced' }[q.lv] || '') + (q.top ? ' · <span class="star-s">★ often asked</span>' : '') + '</div></div>' +
    '<label class="chk small" title="Mark as known"><input type="checkbox" data-known="' + esc(q.id) + '"' + (known ? ' checked' : '') + '> I know this</label></div>' +
    '<div class="reveal"><button class="sm" data-rev>' + ICONS('eye') + 'Show answer</button><div class="ans md" hidden>' + MD.render(q.a) + '</div></div></div>';
}
function pLesson(m, v) {
  var l = lessonById(v.id); if (!l) { m.innerHTML = '<div class="wrap empty"><h2>Topic not found</h2></div>'; return; }
  var mode = lmode(), st = lstate(), i = LEARN.indexOf(l), prev = LEARN[i - 1], next = LEARN[i + 1];
  var qs = lessonQs(l, mode), ps = lessonPs(l, mode), mine = (D.entries || []).filter(function (e) { return e.topic === l.id; });
  var h = '<div class="wrap lesson"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'learn' }) + '>Learn SFCC</a> / <span>Topic ' + (i + 1) + ' of ' + LEARN.length + '</span></div>' +
    '<div class="ptitle">' + ICONS(l.icon || 'book', 'ic-lg') + '<h1>' + esc(l.title) + '</h1>' + badge('claude') + '<span class="grow"></span>' + star(v) + '</div>' +
    '<div class="row" style="gap:12px;margin:-2px 0 18px;flex-wrap:wrap">' + modeSwitch(mode) + '<span class="small faint">' + (l.time ? '≈ ' + l.time[mode] + ' min' : '') + '</span><span class="grow"></span>' + reportBtn() + '</div>';
  if (mode === 'easy') h += '<article class="md lessonbody">' + MD.render(l.easy) + '</article>';
  else if (mode === 'crash') h += '<div class="card crashbox"><div class="side-sec" style="padding:0 0 6px">Must know</div><div class="md">' + MD.render(l.crash) + '</div></div>';
  else h += '<article class="md lessonbody">' + MD.render(l.standard) + '</article>';
  if (mode !== 'easy' && l.notes.length) h += '<div class="side-sec" style="padding-left:0">Important notes</div><div class="notesbox">' + l.notes.map(function (n) { return '<div class="nb">' + ICONS('alert') + '<span>' + MD.inline(n) + '</span></div>'; }).join('') + '</div>';
  h += '<div class="side-sec" style="padding-left:0">' + (mode === 'crash' ? 'Most-asked interview questions' : mode === 'easy' ? 'Check yourself' : 'Interview questions') + ' · ' + qs.length + '</div>' + qs.map(function (q, k) { return qHtml(q, k, !!st.known[q.id]); }).join('');
  if (ps.length) h += '<div class="side-sec" style="padding-left:0">' + (mode === 'easy' ? 'Try it' : 'Problems and worked answers') + '</div>' + ps.map(function (p) { return '<div class="card pcard"><b>' + esc(p.t) + '</b><div class="md">' + MD.render(p.q) + '</div><div class="reveal"><button class="sm" data-rev>' + ICONS('eye') + 'Show solution</button><div class="ans md" hidden>' + MD.render(p.a) + '</div></div></div>'; }).join('');
  h += '<div class="side-sec row" style="padding-left:0"><span class="grow">My entries for this topic · ' + mine.length + '</span><button class="sm" data-addentry>' + ICONS('plus') + 'Add entry</button></div>' +
    (mine.length ? mine.map(function (e) { return entryHtml(e, (D.entries || []).indexOf(e)); }).join('') : '<div class="card empty small">Add your own interview questions, features you built, test cases or code for this topic. They\'re saved in <code>' + ENTRY_DIR + '/' + l.id + '</code>.</div>');
  var infos = (D.infos || []).filter(function (x) { return x.topic === l.id; });
  h += '<div class="side-sec row" style="padding-left:0"><span class="grow">My SFCC info for this topic · ' + infos.length + '</span><button class="sm" data-addinfo>' + ICONS('plus') + 'Add SFCC info</button></div>' + (infos.length ? '<div class="list">' + infos.map(function (x) { return listRow({ name: 'info', id: x.id }, x.code ? 'code' : 'fileText', x.title, guideBlurb(x.body || x.code), badge('mine', true)); }).join('') + '</div>' : '');
  h += '<div class="card" style="padding:10px 14px;margin-top:16px"><b class="small">Sources to read more</b>' + l.sources.map(function (s) { return '<div class="row lnk"><span class="grow small">' + esc(s[0]) + '<br><span class="mono faint">' + esc(s[1]) + '</span></span><button class="ghost" data-copy="' + esc(s[1]) + '">' + ICONS('copy') + 'Copy</button></div>'; }).join('') + '</div>';
  h += '<div class="lnav">' + (prev ? '<button' + vattr({ name: 'lesson', id: prev.id }) + '>' + ICONS('chevR') + esc(prev.title) + '</button>' : '<span></span>') +
    '<button class="' + (st.done[l.id] ? '' : 'primary') + '" data-done>' + ICONS('check') + (st.done[l.id] ? 'Done · mark as not done' : 'Mark topic as done') + '</button>' +
    (next ? '<button' + vattr({ name: 'lesson', id: next.id }) + '>' + esc(next.title) + ICONS('chevR') + '</button>' : '<span></span>') + '</div></div>';
  m.innerHTML = h;
  var pb = m.querySelector('.lnav button:first-child .ic'); if (pb && prev) pb.style.transform = 'rotate(180deg)';
  bindMode(m); bindStar(m, v); bindReveal(m); bindEntries(m, D.entries || []); bindReport(m, v);
  m.querySelectorAll('[data-known]').forEach(function (c) { c.onchange = function () { var k = c.getAttribute('data-known'); if (c.checked) st.known[k] = 1; else delete st.known[k]; c.closest('.qcard').classList.toggle('known', c.checked); saveMeta(); }; });
  m.querySelector('[data-addentry]').onclick = function () { entryDialog(null, l.id); };
  m.querySelector('[data-addinfo]').onclick = function () { infoDialog(null, l.id); };
  m.querySelector('[data-done]').onclick = function () { if (st.done[l.id]) delete st.done[l.id]; else { st.done[l.id] = Date.now(); UI.toast('Topic marked as done'); } saveMeta(); render(); renderSide(); };
}
function practicePool(mode) {
  var pool = [];
  LEARN.forEach(function (l) { lessonQs(l, mode).forEach(function (q) { pool.push({ id: q.id, q: q.q, a: q.a, topic: l.title, lv: q.lv, top: q.top, mine: false }); }); });
  (D.entries || []).forEach(function (e, i) { if (e.type === 'question' && e.answer) pool.push({ id: 'mine:' + e.path, q: e.title + (e.body ? '\n\n' + e.body : ''), a: e.answer + (e.code ? '\n\n```' + e.lang + '\n' + e.code + '\n```' : ''), topic: (lessonById(e.topic) || { title: 'General' }).title, mine: true }); });
  return pool;
}
function pPractice(m, v) {
  var st = lstate(), mode = lmode(), pool = practicePool(mode), filt = v.f || 'unknown';
  var list = pool.filter(function (q) { return filt === 'all' ? true : filt === 'mine' ? q.mine : !st.known[q.id]; });
  var cur = v.qid ? list.filter(function (q) { return q.id === v.qid; })[0] : null;
  if (!cur && list.length) cur = list[Math.floor(Math.random() * list.length)];
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'learn' }) + '>Learn SFCC</a></div><div class="ptitle">' + ICONS('help', 'ic-lg') + '<h1>Practice questions</h1></div>' +
    '<div class="row" style="gap:12px;flex-wrap:wrap;margin-bottom:16px">' + modeSwitch(mode) + '<span class="seg">' + [['unknown', 'Not known yet'], ['all', 'All'], ['mine', 'Mine only']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + (x[0] === filt ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</span><span class="small muted">' + list.length + ' in this set · ' + Object.keys(st.known).length + ' known</span></div>';
  if (!cur) h += '<div class="card empty"><h2>' + (filt === 'unknown' ? 'You marked every question in this mode as known.' : 'No questions here yet.') + '</h2>' + (filt === 'mine' ? 'Add interview questions with answers from any topic page.' : 'Switch the filter or mode to keep practising.') + '</div>';
  else h += '<div class="card practice"><div class="small faint">' + esc(cur.topic) + (cur.top ? ' · ★ often asked' : '') + '</div>' + (cur.mine ? badge('mine', true) : badge('claude', true)) + '<div class="pq md">' + MD.render(cur.q) + '</div>' +
    '<div class="reveal"><button data-rev>' + ICONS('eye') + 'Show answer</button><div class="ans md" hidden>' + MD.render(cur.a) + '</div></div>' +
    '<div class="row" style="gap:8px;margin-top:16px"><button data-again>' + ICONS('refresh') + 'Review again later</button><button class="primary" data-knew>' + ICONS('check') + 'I knew it</button><span class="grow"></span><button class="ghost" data-skip>Skip</button></div></div>';
  m.innerHTML = h + '</div>';
  bindMode(m); bindReveal(m);
  m.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { D.view = { name: 'practice', f: b.getAttribute('data-f') }; render(); }; });
  function nextQ() { D.view = { name: 'practice', f: filt }; render(); }
  if (cur) {
    m.querySelector('[data-knew]').onclick = function () { st.known[cur.id] = 1; saveMeta(); nextQ(); };
    m.querySelector('[data-again]').onclick = function () { delete st.known[cur.id]; saveMeta(); nextQ(); };
    m.querySelector('[data-skip]').onclick = nextQ;
  }
}
function pEntries(m, v) {
  var list = D.entries || [], tf = v.t || '', h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'learn' }) + '>Learn SFCC</a></div><div class="ptitle">' + ICONS('edit', 'ic-lg') + '<h1>My entries</h1>' + badge('mine') + '<span class="grow"></span><button class="primary" data-addentry>' + ICONS('plus') + 'Add entry</button></div>' +
    '<div class="row" style="margin-bottom:14px"><span class="seg">' + [['', 'All']].concat(ETYPES.map(function (x) { return [x[0], x[1]]; })).map(function (x) { return '<button data-t="' + x[0] + '" class="' + (x[0] === tf ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</span></div>';
  var shown = list.filter(function (e) { return !tf || e.type === tf; });
  if (!shown.length) h += '<div class="card empty"><h2>Nothing here yet</h2>Add interview questions, features you built, test cases, code or notes. Each one is a Markdown file in <code>' + ENTRY_DIR + '</code>.</div>';
  var groups = {}; shown.forEach(function (e) { (groups[e.topic] = groups[e.topic] || []).push(e); });
  ['general'].concat(LEARN.map(function (l) { return l.id; })).forEach(function (t) { var g = groups[t]; if (!g) return; h += '<div class="side-sec" style="padding-left:0">' + esc(t === 'general' ? 'General' : lessonById(t).title) + '</div>' + g.map(function (e) { return entryHtml(e, list.indexOf(e)); }).join(''); });
  m.innerHTML = h + '</div>';
  bindEntries(m, list);
  m.querySelector('[data-addentry]').onclick = function () { entryDialog(null); };
  m.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { D.view = { name: 'entries', t: b.getAttribute('data-t') }; render(); }; });
}

/* ---------- solution notes ---------- */
function solList() { return Object.keys(D.sols || {}).map(function (k) { return D.sols[k]; }).sort(function (a, b) { return (b.meta.date || '').localeCompare(a.meta.date || '') || b.lm - a.lm; }); }
function pSols(m) {
  var list = solList();
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a></div><div class="ptitle">' + ICONS('folder', 'ic-lg') + '<h1>' + esc(solLabel()) + '</h1>' + badge('mine') + '<button class="ghost icon" data-rename title="Rename this section">' + ICONS('edit') + '</button><span class="grow"></span><button data-export>' + ICONS('download') + 'Export</button><button class="primary" data-new>' + ICONS('plus') + 'New note</button></div>' +
    '<div class="small muted" style="margin:-4px 0 14px">One folder per note in <code>' + esc(solDir()) + '</code>: <code>note.md</code> plus a <code>code</code> folder with your files.</div>';
  if (!list.length) h += '<div class="card empty"><h2>No notes yet</h2>Record what you built: the requirement, your approach, code, tests and the outcome.</div>';
  else h += '<div class="lgrid">' + list.map(function (s) {
    var tops = (s.meta.topics || []).map(function (t) { return (lessonById(t) || { title: t }).title; });
    return '<div class="ltile"' + vattr({ name: 'sol', id: s.id }) + '><div class="row"><span class="lnum">' + ICONS('folder') + '</span><b class="grow">' + esc(s.title) + '</b></div><div class="small muted">' + esc(first((s.parts.requirement || s.parts.approach || '').replace(/[#*`>|]/g, ''))) + '</div><div class="small faint" style="margin-top:6px">' + esc((s.meta.date || '') + (s.files.length ? ' · ' + s.files.length + ' code file' + (s.files.length > 1 ? 's' : '') : '') + (tops.length ? ' · ' + tops.join(', ') : '')) + '</div></div>';
  }).join('') + '</div>';
  m.innerHTML = h + '</div>';
  m.querySelector('[data-new]').onclick = function () { solDialog(null); };
  m.querySelector('[data-export]').onclick = function () { exportDialog(null); };
  m.querySelector('[data-rename]').onclick = function () {
    UI.ask({ title: 'Rename this section', fields: [{ name: 'label', label: 'Name shown in the app', value: solLabel() }], ok: 'Rename', text: esc('Only the name in the menu changes. Files stay in "' + solDir() + '".') }).then(function (r) { if (!r || !r.label || !r.label.trim()) return; D.meta.solLabel = r.label.trim().slice(0, 40); saveMeta(); renderSide(); render(); });
  };
}
function solDialog(s) {
  var d = s ? { title: s.title, date: s.meta.date || '', topics: (s.meta.topics || []).slice(), tags: s.meta.tags || '' } : { title: '', date: new Date().toISOString().slice(0, 10), topics: [], tags: '' };
  SOL_PARTS.forEach(function (p) { d[p[0]] = s ? s.parts[p[0]] || '' : ''; });
  var body = document.createElement('div'); body.className = 'sfform';
  body.innerHTML = '<div class="sfgrid"><label class="sff" style="grid-column:span 2"><span>Title</span><input type="text" data-k="title" value="' + esc(d.title) + '" placeholder="For example: Store pickup slot selection"></label><label class="sff"><span>Date</span><input type="date" data-k="date" value="' + esc(d.date) + '"></label><label class="sff"><span>Tags</span><input type="text" data-k="tags" value="' + esc(d.tags) + '" placeholder="checkout, service"></label></div>' +
    '<div class="sff"><span>Topics</span><div class="topicpick">' + LEARN.map(function (l) { return '<label class="chk small"><input type="checkbox" value="' + l.id + '"' + (d.topics.indexOf(l.id) >= 0 ? ' checked' : '') + '> ' + esc(l.title) + '</label>'; }).join('') + '</div></div>' +
    SOL_PARTS.map(function (p) { return '<label class="sff"><span>' + p[1] + ' <span class="faint">(' + esc(p[2]) + ' Markdown.)</span></span><textarea rows="' + (p[0] === 'approach' ? 6 : 3) + '" data-k="' + p[0] + '">' + esc(d[p[0]]) + '</textarea></label>'; }).join('') +
    '<div class="small muted">Tip: describe the work in general terms; leave out client names and client data.</div>';
  body.querySelectorAll('[data-k]').forEach(function (el) { el.oninput = function () { d[el.getAttribute('data-k')] = el.value; }; });
  body.querySelectorAll('.topicpick input').forEach(function (c) { c.onchange = function () { d.topics = Array.prototype.filter.call(body.querySelectorAll('.topicpick input'), function (x) { return x.checked; }).map(function (x) { return x.value; }); }; });
  UI.modal({ title: s ? 'Edit note' : 'New ' + solLabel().replace(/s$/, '').toLowerCase(), body: body, size: 'mid', buttons: [{ label: 'Cancel', onClick: function (mm) { mm.close(); } }, { label: 'Save', primary: true, onClick: async function (mm) {
    if (!d.title.trim()) { UI.toast('Add a title', true); return; }
    var id = s ? s.id : slug(d.title), meta = { title: d.title.trim(), date: d.date, topics: d.topics, tags: d.tags };
    if (!s && D.sols[id]) id += '-' + Date.now().toString(36);
    try { await writeText(solDir() + '/' + id + '/note.md', writeParts('sfcc-solution', meta, SOL_PARTS.map(function (p) { return { k: p[0], text: d[p[0]] }; }))); mm.close(); await afterWrite('Note saved', { name: 'sol', id: id }); }
    catch (er) { UI.toast('Could not save: ' + er.message, true); }
  } }] });
}
function pSol(m, v) {
  var s = (D.sols || {})[v.id]; if (!s) { m.innerHTML = '<div class="wrap empty"><h2>Note not found</h2></div>'; return; }
  var fi = Math.min(v.f || 0, Math.max(0, s.files.length - 1)), f = s.files[fi];
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'sols' }) + '>' + esc(solLabel()) + '</a></div>' +
    '<div class="ptitle">' + ICONS('folder', 'ic-lg') + '<h1>' + esc(s.title) + '</h1>' + badge('mine') + '<span class="grow"></span>' + star(v) + '<button data-export>' + ICONS('download') + 'Export</button><button data-edit>' + ICONS('edit') + 'Edit note</button><button class="ghost icon danger" data-del title="Delete note">' + ICONS('trash') + '</button></div>' +
    '<div class="metarow">' + (s.meta.date ? '<span class="chip">' + esc(s.meta.date) + '</span>' : '') + (s.meta.topics || []).map(function (t) { var l = lessonById(t); return l ? '<span class="chip"' + vattr({ name: 'lesson', id: t }) + ' style="cursor:pointer">' + esc(l.title) + '</span>' : ''; }).join('') + (s.meta.tags ? s.meta.tags.split(/\s*,\s*/).filter(Boolean).map(function (t) { return '<span class="chip">#' + esc(t) + '</span>'; }).join('') : '') + '<span class="chip">' + esc(s.dir) + '</span></div>';
  SOL_PARTS.forEach(function (p) { if (s.parts[p[0]]) h += '<div class="side-sec" style="padding-left:0">' + p[1] + '</div><div class="md solpart">' + MD.render(s.parts[p[0]]) + '</div>'; });
  h += '<div class="side-sec row" style="padding-left:0"><span class="grow">Code · ' + s.files.length + ' file' + (s.files.length === 1 ? '' : 's') + '</span><button class="sm" data-newfile>' + ICONS('plus') + 'New file</button><button class="sm" data-upload>' + ICONS('upload') + 'Upload files</button><input type="file" multiple hidden data-uin></div>';
  if (!s.files.length) h += '<div class="card empty small">Upload code files from your computer or create a new one. They\'re saved in <code>' + esc(s.dir) + '/code</code>.</div>';
  else h += '<div class="codetabs">' + s.files.map(function (x, i) { return '<button data-fi="' + i + '" class="' + (i === fi ? 'on' : '') + '">' + ICONS('fileCode') + esc(x.name) + '</button>'; }).join('') + '</div>' +
    '<div class="card codecard"><div class="row codebar"><b class="mono small">' + esc(f.name) + '</b><span class="small faint">' + (function () { var inf = fileInfo(f); return inf.lines + ' lines · ' + UI.fmtSize(inf.size) + ' · ' + inf.lang + ' · ' + UI.fmtDate(f.lm); })() + '</span><span class="grow"></span><button class="sm" data-copyc>' + ICONS('copy') + 'Copy</button><button class="sm" data-dlc title="Download this file">' + ICONS('download') + 'Download</button><button class="sm" data-editc>' + ICONS('edit') + 'Edit</button><button class="sm" data-renc>' + ICONS('rename') + 'Rename</button><button class="sm danger" data-delc>' + ICONS('trash') + 'Remove</button></div>' + (function () { var inf = fileInfo(f); return (inf.fns.length || inf.reqs.length) ? '<div class="finfo small">' + (inf.fns.length ? '<div><span class="faint">Functions and routes:</span> ' + inf.fns.map(function (x) { return '<code>' + esc(x) + '</code>'; }).join(' ') + '</div>' : '') + (inf.reqs.length ? '<div><span class="faint">Requires:</span> ' + inf.reqs.map(function (x) { return '<code>' + esc(x) + '</code>'; }).join(' ') + '</div>' : '') + '</div>' : ''; })() + codeBlock(f.text, langOf(f.name)) + '</div>';
  h += noteCard(v) + '</div>';
  m.innerHTML = h;
  bindStar(m, v); bindNote(m, v);
  m.querySelector('[data-edit]').onclick = function () { solDialog(s); };
  m.querySelector('[data-export]').onclick = function () { exportDialog(s); };
  m.querySelector('[data-del]').onclick = function () { UI.confirm('Delete "' + s.title + '"?', esc('The folder ' + s.dir + ' and all its code files will be deleted.'), 'Delete', true).then(async function (ok) { if (!ok) return; try { await delPath(s.dir, true); await afterWrite('Note deleted', { name: 'sols' }); } catch (e) { UI.toast(e.message, true); } }); };
  m.querySelectorAll('[data-fi]').forEach(function (b) { b.onclick = function () { D.view = { name: 'sol', id: s.id, f: +b.getAttribute('data-fi') }; render(); }; });
  m.querySelector('[data-newfile]').onclick = function () { codeEditor({ title: 'New code file', nameField: true, text: '', onSave: async function (name, text) { if (s.files.some(function (x) { return x.name === name; })) throw new Error('A file with that name already exists'); await writeText(s.dir + '/code/' + name, text); await afterWrite('File saved', { name: 'sol', id: s.id, f: 0 }); D.view.f = (D.sols[s.id] || s).files.findIndex(function (x) { return x.name === name; }); render(); } }); };
  var uin = m.querySelector('[data-uin]');
  m.querySelector('[data-upload]').onclick = function () { uin.click(); };
  uin.onchange = async function () {
    var files = Array.prototype.slice.call(uin.files), n = 0;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (file.size > 1048576) { UI.toast(file.name + ' is over 1 MB, skipped', true); continue; }
      var txt = await file.text();
      if (/\u0000/.test(txt.slice(0, 2000))) { UI.toast(file.name + ' looks binary, skipped', true); continue; }
      if (s.files.some(function (x) { return x.name === file.name; }) && !(await UI.confirm('Replace ' + file.name + '?', esc('A file with this name is already in this note.'), 'Replace', false))) continue;
      await writeText(s.dir + '/code/' + file.name, txt); n++;
    }
    if (n) await afterWrite(n + ' file' + (n > 1 ? 's' : '') + ' uploaded', { name: 'sol', id: s.id, f: 0 });
  };
  if (!f) return;
  m.querySelector('[data-copyc]').onclick = function () { copy(f.text); };
  m.querySelector('[data-dlc]').onclick = function (ev) { UI.menuAt(ev.currentTarget, [{ label: 'As it is', icon: 'download', onClick: function () { UI.download(f.name, f.text); } }, { label: 'Without comments', icon: 'code', onClick: function () { UI.download(f.name, stripComments(f.text, langOf(f.name))); } }]); };
  m.querySelector('[data-editc]').onclick = function () { codeEditor({ title: 'Edit ' + f.name, name: f.name, text: f.text, onSave: async function (name, text) { await writeText(f.path, text); await afterWrite('File saved', { name: 'sol', id: s.id, f: fi }); } }); };
  m.querySelector('[data-renc]').onclick = function () { UI.ask({ title: 'Rename file', fields: [{ name: 'n', label: 'New name', value: f.name }], ok: 'Rename' }).then(async function (r) { if (!r || !r.n || r.n === f.name) return; if (/[\\/:*?"<>|]/.test(r.n)) { UI.toast('That name has characters that aren\'t allowed', true); return; } try { await writeText(s.dir + '/code/' + r.n, f.text); await delPath(f.path); await afterWrite('File renamed', { name: 'sol', id: s.id, f: 0 }); } catch (e) { UI.toast(e.message, true); } }); };
  m.querySelector('[data-delc]').onclick = function () { UI.confirm('Remove ' + f.name + '?', esc(''), 'Remove', true).then(async function (ok) { if (!ok) return; try { await delPath(f.path); await afterWrite('File removed', { name: 'sol', id: s.id, f: 0 }); } catch (e) { UI.toast(e.message, true); } }); };
}

/* ---------- export and file info ---------- */
function stripComments(code, lang) {
  if (lang === 'xml' || lang === 'isml') return tidy(code.replace(/<iscomment>[\s\S]*?<\/iscomment>/gi, '').replace(/<!--(?!\s*\[if)[\s\S]*?-->/g, ''));
  if (lang === 'properties' || lang === 'sh' || lang === 'yml') return tidy(code.split('\n').filter(function (l) { return !/^\s*[#!]/.test(l) || /^#!/.test(l); }).join('\n'));
  if (lang === 'sql') return tidy(code.split('\n').filter(function (l) { return !/^\s*--/.test(l); }).join('\n'));
  if (lang !== 'js' && lang !== 'css' && lang !== 'json') return code;
  var out = '', i = 0, n = code.length, q = null;
  while (i < n) {
    var c = code[i], d = code[i + 1];
    if (q) { out += c; if (c === '\\') { out += d || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || (c === '`' && lang === 'js')) { q = c; out += c; i++; continue; }
    if (c === '/' && d === '*') { var e = code.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '/' && d === '/' && lang === 'js') { while (i < n && code[i] !== '\n') i++; continue; }
    out += c; i++;
  }
  return tidy(out);
}
function tidy(s) { return s.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, ''); }
function fileInfo(f) {
  var lang = langOf(f.name), lines = f.text.split('\n').length, size = new Blob([f.text]).size, fns = [];
  if (lang === 'js') {
    var re = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:exports|module\.exports)\.([A-Za-z_$][\w$]*)\s*=|server\.(?:get|post|use|append|prepend|replace)\(\s*['"]([\w-]+)['"])/g, mm;
    while ((mm = re.exec(f.text))) fns.push(mm[1] || mm[2] || ('route ' + mm[3]));
  }
  var reqs = lang === 'js' ? (f.text.match(/require\(\s*['"]([^'"]+)['"]\s*\)/g) || []).map(function (r) { return r.replace(/require\(\s*['"]|['"]\s*\)/g, ''); }).filter(function (x, i, a) { return a.indexOf(x) === i; }) : [];
  return { lang: lang, lines: lines, size: size, fns: fns.filter(function (x, i, a) { return a.indexOf(x) === i; }), reqs: reqs };
}
function exportDialog(only) {
  var o = { scope: only ? 'one' : 'all', fmt: 'md', strip: true, talking: false, parts: { requirement: true, approach: true, tests: true, outcome: true }, info: true };
  var body = document.createElement('div'); body.className = 'sfform';
  body.innerHTML = (only ? '<div class="sff"><span>What</span><span class="seg"><button data-s="one" class="on">This note</button><button data-s="all">All ' + esc(solLabel().toLowerCase()) + '</button></span></div>' : '') +
    '<div class="sff"><span>Format</span><span class="seg"><button data-fmt="md" class="on">Markdown (one file)</button><button data-fmt="json">JSON</button></span></div>' +
    '<div class="sff"><span>Include</span><div class="topicpick">' + SOL_PARTS.map(function (p) { return '<label class="chk small"><input type="checkbox" data-p="' + p[0] + '"' + ((p[0] === 'talking' ? o.talking : o.parts[p[0]]) ? ' checked' : '') + '> ' + p[1] + '</label>'; }).join('') + '<label class="chk small"><input type="checkbox" data-info checked> File details (lines, functions, requires)</label></div></div>' +
    '<label class="chk"><input type="checkbox" data-strip checked> Remove comments from code (JavaScript, CSS, ISML/XML, properties)</label>' +
    '<div class="small muted" style="margin-top:8px">The file is built here and downloaded to your computer. Nothing is uploaded. Check it before you share it, and leave out anything that isn\'t yours to share.</div>';
  body.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { o.scope = b.getAttribute('data-s'); body.querySelectorAll('[data-s]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  body.querySelectorAll('[data-fmt]').forEach(function (b) { b.onclick = function () { o.fmt = b.getAttribute('data-fmt'); body.querySelectorAll('[data-fmt]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  body.querySelectorAll('[data-p]').forEach(function (c) { c.onchange = function () { var k = c.getAttribute('data-p'); if (k === 'talking') o.talking = c.checked; else o.parts[k] = c.checked; }; });
  body.querySelector('[data-strip]').onchange = function () { o.strip = this.checked; };
  body.querySelector('[data-info]').onchange = function () { o.info = this.checked; };
  UI.modal({ title: 'Export', body: body, size: 'mid', buttons: [{ label: 'Cancel', onClick: function (m) { m.close(); } }, { label: 'Download', primary: true, onClick: function (m) {
    var list = o.scope === 'one' && only ? [only] : solList();
    if (!list.length) { UI.toast('Nothing to export', true); return; }
    var data = list.map(function (s) {
      var parts = {}; SOL_PARTS.forEach(function (p) { if ((p[0] === 'talking' ? o.talking : o.parts[p[0]]) && s.parts[p[0]]) parts[p[0]] = s.parts[p[0]]; });
      return { title: s.title, date: s.meta.date || '', topics: (s.meta.topics || []).map(function (t) { return (lessonById(t) || { title: t }).title; }), tags: s.meta.tags || '', sections: parts,
        files: s.files.map(function (f) { var inf = fileInfo(f), code = o.strip ? stripComments(f.text, inf.lang) : f.text; return { name: f.name, language: inf.lang, lines: code.split('\n').length, functions: o.info ? inf.fns : undefined, requires: o.info ? inf.reqs : undefined, code: code }; }) };
    });
    var name = (o.scope === 'one' && only ? slug(only.title) : slug(solLabel())) + '-' + new Date().toISOString().slice(0, 10);
    if (o.fmt === 'json') UI.download(name + '.json', JSON.stringify(data, null, 2), 'application/json');
    else {
      var md = data.map(function (s) {
        var t = '# ' + s.title + '\n\n' + (s.date ? '- Date: ' + s.date + '\n' : '') + (s.topics.length ? '- Topics: ' + s.topics.join(', ') + '\n' : '') + (s.tags ? '- Tags: ' + s.tags + '\n' : '') + '\n';
        SOL_PARTS.forEach(function (p) { if (s.sections[p[0]]) t += '## ' + p[1] + '\n\n' + s.sections[p[0]] + '\n\n'; });
        s.files.forEach(function (f) { t += '## File: ' + f.name + '\n\n' + (o.info ? '- Language: ' + f.language + '\n- Lines: ' + f.lines + '\n' + (f.functions && f.functions.length ? '- Functions and routes: ' + f.functions.join(', ') + '\n' : '') + (f.requires && f.requires.length ? '- Requires: ' + f.requires.join(', ') + '\n' : '') + '\n' : '') + '```' + (f.language === 'text' ? '' : f.language) + '\n' + f.code + '\n```\n\n'; });
        return t;
      }).join('\n---\n\n');
      UI.download(name + '.md', md, 'text/markdown');
    }
    m.close(); UI.toast('Export downloaded');
  } }] });
}
/* ---------- requests: report a problem or ask for more ---------- */
var RKINDS = [['more', 'Add more on this'], ['questions', 'More interview questions'], ['wrong', 'Wrong or unclear'], ['other', 'Other']];
function reports() { if (!D.meta.reports) D.meta.reports = []; return D.meta.reports; }
function whereOf(v) {
  if (v.name === 'lesson') { var l = lessonById(v.id); return { label: 'Learn SFCC › ' + (l ? l.title : v.id) + ' (' + MODES.filter(function (x) { return x[0] === lmode(); })[0][1] + ' mode)', view: v }; }
  if (v.name === 'guide') { var g = guideById(v.id); return { label: 'Guide › ' + (g ? g.name : v.id), view: v }; }
  if (v.name === 'learn') return { label: 'Learn SFCC (general)', view: v };
  return { label: labelOf(v).label || 'SFCC Docs', view: v };
}
function reportDialog(v, existing) {
  var r = existing || { kind: 'more', text: '', where: whereOf(v) };
  var body = document.createElement('div'); body.className = 'sfform';
  body.innerHTML = '<div class="small muted" style="margin-bottom:10px">Where: <b>' + esc(r.where.label) + '</b></div>' +
    '<div class="sff"><span>What kind</span><span class="seg">' + RKINDS.map(function (k) { return '<button type="button" data-rk="' + k[0] + '" class="' + (k[0] === r.kind ? 'on' : '') + '">' + k[1] + '</button>'; }).join('') + '</span></div>' +
    '<label class="sff"><span>Details</span><textarea rows="7" data-rt placeholder="What should be added, changed or explained? For example: add how to debug a failing job step, with an example log.">' + esc(r.text) + '</textarea></label>' +
    '<div class="small faint">Saved in this docs folder. Open Requests later and copy them all in one go.</div>';
  body.querySelectorAll('[data-rk]').forEach(function (b) { b.onclick = function () { r.kind = b.getAttribute('data-rk'); body.querySelectorAll('[data-rk]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  var btns = [{ label: 'Cancel', onClick: function (m) { m.close(); } }, { label: existing ? 'Save' : 'Add request', primary: true, onClick: function (m) {
    var t = body.querySelector('[data-rt]').value.trim(); if (!t) { UI.toast('Write what you need', true); return; }
    if (existing) { existing.kind = r.kind; existing.text = t; existing.at = Date.now(); }
    else reports().unshift({ id: Date.now().toString(36), at: Date.now(), kind: r.kind, text: t, where: r.where, status: 'open' });
    saveMeta(); m.close(); renderSide(); if (D.view.name === 'reports') render(); UI.toast(existing ? 'Request saved' : 'Request added');
  } }];
  UI.modal({ title: existing ? 'Edit request' : 'Report or request more', body: body, size: 'mid', buttons: btns });
  setTimeout(function () { body.querySelector('[data-rt]').focus(); }, 30);
}
function reportsText(list) {
  var kinds = {}; RKINDS.forEach(function (k) { kinds[k[0]] = k[1]; });
  return 'Requests for SFCC Docs (' + new Date().toISOString().slice(0, 10) + ')\n\n' + list.map(function (r, i) { return (i + 1) + '. [' + r.where.label + '] ' + kinds[r.kind] + ':\n   ' + r.text.replace(/\n/g, '\n   '); }).join('\n\n') + '\n';
}
function pReports(m, v) {
  var all = reports(), filt = v.f || 'open', list = all.filter(function (r) { return filt === 'all' || r.status === filt; });
  var kinds = {}; RKINDS.forEach(function (k) { kinds[k[0]] = k[1]; });
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a></div><div class="ptitle">' + ICONS('inbox', 'ic-lg') + '<h1>Requests</h1><span class="grow"></span><button data-copyall' + (list.length ? '' : ' disabled') + '>' + ICONS('copy') + 'Copy ' + (filt === 'open' ? 'open' : 'shown') + ' requests</button><button data-dl' + (list.length ? '' : ' disabled') + '>' + ICONS('download') + 'Download</button><button class="primary" data-new>' + ICONS('plus') + 'New request</button></div>' +
    '<div class="small muted" style="margin:-4px 0 14px">Things to add or fix in the lessons and guides. Copy them and paste them into a chat with Claude to get the content added.</div>' +
    '<div class="row" style="margin-bottom:14px"><span class="seg">' + [['open', 'Open'], ['done', 'Done'], ['all', 'All']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + (x[0] === filt ? 'on' : '') + '">' + x[1] + ' · ' + (x[0] === 'all' ? all.length : all.filter(function (r) { return r.status === x[0]; }).length) + '</button>'; }).join('') + '</span></div>';
  if (!list.length) h += '<div class="card empty"><h2>No ' + (filt === 'all' ? '' : filt + ' ') + 'requests</h2>Use <b>Report or request more</b> on any topic or guide, or New request here.</div>';
  h += list.map(function (r) {
    var i = all.indexOf(r);
    return '<div class="card entry' + (r.status === 'done' ? ' rdone' : '') + '"><div class="row"><span class="etype">' + ICONS(r.kind === 'wrong' ? 'alert' : r.kind === 'questions' ? 'help' : 'plus') + esc(kinds[r.kind] || r.kind) + '</span><a class="small grow" style="cursor:pointer;color:var(--accent-text)"' + vattr(r.where.view || { name: 'home' }) + '>' + esc(r.where.label) + '</a><span class="small faint">' + UI.ago(r.at) + '</span>' +
      '<button class="ghost icon" data-rcopy="' + i + '" title="Copy">' + ICONS('copy') + '</button><button class="ghost icon" data-redit="' + i + '" title="Edit">' + ICONS('edit') + '</button><button class="ghost icon" data-rdone="' + i + '" title="' + (r.status === 'done' ? 'Reopen' : 'Mark as done') + '">' + ICONS(r.status === 'done' ? 'refresh' : 'check') + '</button><button class="ghost icon danger" data-rdel="' + i + '" title="Delete">' + ICONS('trash') + '</button></div>' +
      '<div class="rtext">' + esc(r.text) + '</div></div>';
  }).join('');
  m.innerHTML = h + '</div>';
  m.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { D.view = { name: 'reports', f: b.getAttribute('data-f') }; render(); }; });
  m.querySelector('[data-new]').onclick = function () { reportDialog({ name: 'learn' }); };
  var ca = m.querySelector('[data-copyall]'); if (ca) ca.onclick = function () { copy(reportsText(list)); };
  var dl = m.querySelector('[data-dl]'); if (dl) dl.onclick = function () { UI.download('sfcc-docs-requests-' + new Date().toISOString().slice(0, 10) + '.md', reportsText(list), 'text/markdown'); };
  m.querySelectorAll('[data-rcopy]').forEach(function (b) { b.onclick = function () { copy(reportsText([all[+b.getAttribute('data-rcopy')]])); }; });
  m.querySelectorAll('[data-redit]').forEach(function (b) { b.onclick = function () { var r = all[+b.getAttribute('data-redit')]; reportDialog(r.where.view || { name: 'learn' }, r); }; });
  m.querySelectorAll('[data-rdone]').forEach(function (b) { b.onclick = function () { var r = all[+b.getAttribute('data-rdone')]; r.status = r.status === 'done' ? 'open' : 'done'; saveMeta(); renderSide(); render(); }; });
  m.querySelectorAll('[data-rdel]').forEach(function (b) { b.onclick = function () { var r = all[+b.getAttribute('data-rdel')]; UI.confirm('Delete this request?', esc(first(r.text)), 'Delete', true).then(function (ok) { if (!ok) return; all.splice(all.indexOf(r), 1); saveMeta(); renderSide(); render(); }); }; });
}
function reportBtn() { return '<button class="sm" data-report title="Tell what is missing, wrong or should be added">' + ICONS('inbox') + 'Report or request more</button>'; }
function bindReport(m, v) { var b = m.querySelector('[data-report]'); if (b) b.onclick = function () { reportDialog(v); }; }
/* ---------- My SFCC info: your own articles ---------- */
var INFO_DIR = 'My SFCC info';
function loadInfos(files) {
  D.infos = [];
  files.forEach(function (f) {
    if (f.path.indexOf(INFO_DIR + '/') !== 0 || !/\.md$/i.test(f.path)) return;
    var r = parseParts(f.text, 'sfcc-info'), m = r.meta;
    D.infos.push({ path: f.path, lm: f.lm, id: stem(f.path), title: m.title || stem(f.path), topic: m.topic || 'general', tags: m.tags || '', created: m.created || f.lm, body: (r.parts.body || {}).text || '', code: (r.parts.code || {}).text || '', lang: (r.parts.code || {}).lang || 'js', refs: (r.parts.refs || {}).text || '' });
  });
  D.infos.sort(function (a, b) { return b.lm - a.lm; });
}
function infoById(id) { return (D.infos || []).filter(function (x) { return x.id === id; })[0]; }
function infoDialog(it, topic) {
  var e = it ? JSON.parse(JSON.stringify(it)) : { title: '', topic: topic || 'general', tags: '', body: '', code: '', lang: 'js', refs: '' };
  var body = document.createElement('div'); body.className = 'sfform';
  body.innerHTML = '<label class="sff"><span>Title</span><input type="text" data-k="title" value="' + esc(e.title) + '" placeholder="For example: How our PDP decides the badge"></label>' +
    '<div class="sfgrid"><label class="sff"><span>Topic</span><select data-k="topic"><option value="general">General</option>' + LEARN.map(function (l) { return '<option value="' + l.id + '"' + (l.id === e.topic ? ' selected' : '') + '>' + esc(l.title) + '</option>'; }).join('') + '</select></label>' +
    '<label class="sff"><span>Tags</span><input type="text" data-k="tags" value="' + esc(e.tags) + '" placeholder="pricebook, job, hook"></label></div>' +
    '<label class="sff"><span>Information <span class="faint">(Markdown: headings, lists, tables, code)</span></span><textarea rows="12" data-k="body">' + esc(e.body) + '</textarea></label>' +
    '<div class="sff"><span>Code <span class="faint">(optional)</span></span><div class="row" style="gap:8px;margin-bottom:6px"><select data-k="lang">' + CODE_LANGS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === e.lang ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select><button type="button" data-upl>' + ICONS('upload') + 'Load from file</button><input type="file" data-file hidden></div><textarea rows="8" class="mono" data-k="code" spellcheck="false" wrap="off">' + esc(e.code) + '</textarea></div>' +
    '<label class="sff"><span>References <span class="faint">(optional: where you learned it, doc names, links as text)</span></span><textarea rows="2" data-k="refs">' + esc(e.refs) + '</textarea></label>';
  body.querySelectorAll('[data-k]').forEach(function (el) { el.oninput = el.onchange = function () { e[el.getAttribute('data-k')] = el.value; }; });
  var f = body.querySelector('[data-file]'), cta = body.querySelector('[data-k=code]');
  body.querySelector('[data-upl]').onclick = function () { f.click(); };
  f.onchange = async function () { var file = f.files[0]; if (!file) return; if (file.size > 1048576) { UI.toast('File is over 1 MB', true); return; } e.code = cta.value = await file.text(); var lg = langOf(file.name); if (CODE_LANGS.some(function (x) { return x[0] === lg; })) { e.lang = lg; body.querySelector('[data-k=lang]').value = lg; } };
  cta.addEventListener('keydown', function (ev) { if (ev.key === 'Tab') { ev.preventDefault(); cta.setRangeText('    ', cta.selectionStart, cta.selectionEnd, 'end'); e.code = cta.value; } });
  var btns = [{ label: 'Cancel', onClick: function (m) { m.close(); } }];
  if (it) btns.unshift({ label: 'Delete', danger: true, onClick: function (m) { UI.confirm('Delete "' + it.title + '"?', esc('The file ' + it.path + ' will be deleted.'), 'Delete', true).then(async function (ok) { if (!ok) return; try { await delPath(it.path); m.close(); await afterWrite('Deleted', { name: 'infos' }); } catch (er) { UI.toast(er.message, true); } }); } });
  btns.push({ label: 'Save', primary: true, onClick: async function (m) {
    if (!e.title.trim()) { UI.toast('Add a title', true); return; }
    if (!e.body.trim() && !e.code.trim()) { UI.toast('Write some information or add code', true); return; }
    var id = it ? it.id : slug(e.title), path = it ? it.path : INFO_DIR + '/' + id + '.md';
    if (!it && infoById(id)) { id += '-' + Date.now().toString(36); path = INFO_DIR + '/' + id + '.md'; }
    try { await writeText(path, writeParts('sfcc-info', { title: e.title.trim(), topic: e.topic, tags: e.tags, created: it ? it.created : Date.now() }, [{ k: 'body', text: e.body }, { k: 'code', text: e.code, lang: e.lang }, { k: 'refs', text: e.refs }])); m.close(); await afterWrite('Saved', { name: 'info', id: id }); }
    catch (er) { UI.toast('Could not save: ' + er.message, true); }
  } });
  UI.modal({ title: it ? 'Edit SFCC info' : 'Add SFCC info', body: body, size: 'mid', buttons: btns });
}
function pInfos(m, v) {
  var all = D.infos || [], tf = v.t || '', q = (v.q || '').toLowerCase();
  var list = all.filter(function (x) { return (!tf || x.topic === tf) && (!q || (x.title + ' ' + x.tags + ' ' + x.body + ' ' + x.code).toLowerCase().indexOf(q) >= 0); });
  var used = {}; all.forEach(function (x) { used[x.topic] = (used[x.topic] || 0) + 1; });
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a></div><div class="ptitle">' + ICONS('fileText', 'ic-lg') + '<h1>My SFCC info</h1>' + badge('mine') + '<span class="grow"></span><button data-export' + (all.length ? '' : ' disabled') + '>' + ICONS('download') + 'Download</button><button class="primary" data-add>' + ICONS('plus') + 'Add SFCC info</button></div>' +
    '<div class="small muted" style="margin:-4px 0 14px">Your own SFCC knowledge: how things work in your projects, tricks, configs and code. Each item is a Markdown file in <code>' + INFO_DIR + '</code>.</div>' +
    '<div class="row" style="gap:10px;margin-bottom:14px;flex-wrap:wrap"><input type="search" data-q placeholder="Filter…" value="' + esc(v.q || '') + '" style="max-width:260px"><select data-t><option value="">All topics · ' + all.length + '</option><option value="general"' + (tf === 'general' ? ' selected' : '') + '>General · ' + (used.general || 0) + '</option>' + LEARN.filter(function (l) { return used[l.id]; }).map(function (l) { return '<option value="' + l.id + '"' + (tf === l.id ? ' selected' : '') + '>' + esc(l.title) + ' · ' + used[l.id] + '</option>'; }).join('') + '</select></div>';
  if (!list.length) h += '<div class="card empty"><h2>' + (all.length ? 'Nothing matches' : 'No SFCC info yet') + '</h2>' + (all.length ? 'Change the filter.' : 'Add what you know: explanations, configs, how a feature works in your project, with code.') + '</div>';
  else h += '<div class="lgrid">' + list.map(function (x) { return '<div class="ltile"' + vattr({ name: 'info', id: x.id }) + '><div class="row"><span class="lnum">' + ICONS(x.code ? 'code' : 'fileText') + '</span><b class="grow">' + esc(x.title) + '</b></div><div class="small muted">' + esc(guideBlurb(x.body || x.code)) + '</div><div class="small faint" style="margin-top:6px">' + esc((x.topic === 'general' ? 'General' : (lessonById(x.topic) || { title: x.topic }).title) + (x.tags ? ' · #' + x.tags.split(/\s*,\s*/).filter(Boolean).join(' #') : '') + ' · ' + UI.fmtDate(x.lm)) + '</div></div>'; }).join('') + '</div>';
  m.innerHTML = h + '</div>';
  m.querySelector('[data-add]').onclick = function () { infoDialog(null); };
  var ex = m.querySelector('[data-export]'); if (ex) ex.onclick = function () { infoExport(null, list.length < all.length ? list : null); };
  var qi = m.querySelector('[data-q]'); qi.oninput = UI.debounce(function () { D.view = { name: 'infos', t: tf, q: qi.value }; render(); var n = document.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
  m.querySelector('[data-t]').onchange = function () { D.view = { name: 'infos', t: this.value, q: v.q }; render(); };
}
function pInfo(m, v) {
  var x = infoById(v.id); if (!x) { m.innerHTML = '<div class="wrap empty"><h2>Not found</h2></div>'; return; }
  var l = lessonById(x.topic);
  var h = '<div class="wrap"><div class="crumbs"><a' + vattr({ name: 'home' }) + '>Home</a> / <a' + vattr({ name: 'infos' }) + '>My SFCC info</a></div><div class="ptitle">' + ICONS(x.code ? 'code' : 'fileText', 'ic-lg') + '<h1>' + esc(x.title) + '</h1>' + badge('mine') + '<span class="grow"></span>' + star(v) + '<button data-export>' + ICONS('download') + 'Download</button><button data-edit>' + ICONS('edit') + 'Edit</button></div>' +
    '<div class="metarow">' + (l ? '<span class="chip"' + vattr({ name: 'lesson', id: l.id }) + ' style="cursor:pointer">' + esc(l.title) + '</span>' : '<span class="chip">General</span>') + (x.tags ? x.tags.split(/\s*,\s*/).filter(Boolean).map(function (t) { return '<span class="chip">#' + esc(t) + '</span>'; }).join('') : '') + '<span class="chip">' + esc(x.path) + '</span><span class="small faint">Updated ' + UI.fmtDate(x.lm, true) + '</span></div>' +
    (x.body ? '<article class="md lessonbody">' + MD.render(x.body) + '</article>' : '') +
    (x.code ? '<div class="side-sec row" style="padding-left:0"><span class="grow">Code</span><button class="sm" data-copyc>' + ICONS('copy') + 'Copy</button></div>' + codeBlock(x.code, x.lang) : '') +
    (x.refs ? '<div class="side-sec" style="padding-left:0">References</div><div class="md small-md">' + MD.render(x.refs) + '</div>' : '') + '</div>';
  m.innerHTML = h;
  bindStar(m, v);
  m.querySelector('[data-edit]').onclick = function () { infoDialog(x); };
  m.querySelector('[data-export]').onclick = function () { infoExport(x); };
  var cc = m.querySelector('[data-copyc]'); if (cc) cc.onclick = function () { copy(x.code); };
}
function infoExport(one, subset) {
  var o = { scope: one ? 'one' : subset ? 'shown' : 'all', fmt: 'md', strip: true, refs: true };
  var body = document.createElement('div'); body.className = 'sfform';
  body.innerHTML = '<div class="sff"><span>What</span><span class="seg">' + (one ? '<button data-s="one" class="on">This item</button>' : '') + (subset ? '<button data-s="shown"' + (one ? '' : ' class="on"') + '>Filtered (' + subset.length + ')</button>' : '') + '<button data-s="all"' + (!one && !subset ? ' class="on"' : '') + '>All (' + (D.infos || []).length + ')</button></span></div>' +
    '<div class="sff"><span>Format</span><span class="seg"><button data-fmt="md" class="on">Markdown (one file)</button><button data-fmt="json">JSON</button></span></div>' +
    '<label class="chk"><input type="checkbox" data-strip checked> Remove comments from code</label><label class="chk"><input type="checkbox" data-refs checked> Include references</label>' +
    '<div class="small muted" style="margin-top:8px">Built here and downloaded to your computer; nothing is uploaded. Check it before you share it.</div>';
  function seg(attr, key) { body.querySelectorAll('[' + attr + ']').forEach(function (b) { b.onclick = function () { o[key] = b.getAttribute(attr); body.querySelectorAll('[' + attr + ']').forEach(function (z) { z.classList.toggle('on', z === b); }); }; }); }
  seg('data-s', 'scope'); seg('data-fmt', 'fmt');
  body.querySelector('[data-strip]').onchange = function () { o.strip = this.checked; };
  body.querySelector('[data-refs]').onchange = function () { o.refs = this.checked; };
  UI.modal({ title: 'Download SFCC info', body: body, size: 'mid', buttons: [{ label: 'Cancel', onClick: function (m) { m.close(); } }, { label: 'Download', primary: true, onClick: function (m) {
    var list = o.scope === 'one' ? [one] : o.scope === 'shown' ? subset : (D.infos || []);
    var data = list.map(function (x) { var code = x.code ? (o.strip ? stripComments(x.code, x.lang === 'isml' ? 'xml' : x.lang) : x.code) : ''; return { title: x.title, topic: x.topic === 'general' ? 'General' : (lessonById(x.topic) || { title: x.topic }).title, tags: x.tags, information: x.body, language: code ? x.lang : undefined, code: code || undefined, references: o.refs && x.refs ? x.refs : undefined }; });
    var name = (o.scope === 'one' ? slug(one.title) : 'my-sfcc-info') + '-' + new Date().toISOString().slice(0, 10);
    if (o.fmt === 'json') UI.download(name + '.json', JSON.stringify(data, null, 2), 'application/json');
    else UI.download(name + '.md', data.map(function (x) { return '# ' + x.title + '\n\n- Topic: ' + x.topic + '\n' + (x.tags ? '- Tags: ' + x.tags + '\n' : '') + '\n' + (x.information ? x.information + '\n\n' : '') + (x.code ? '## Code\n\n```' + (x.language === 'text' ? '' : x.language) + '\n' + x.code + '\n```\n\n' : '') + (x.references ? '## References\n\n' + x.references + '\n' : ''); }).join('\n---\n\n'), 'text/markdown');
    m.close(); UI.toast('Downloaded');
  } }] });
}
