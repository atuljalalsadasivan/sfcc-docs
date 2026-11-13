/* Small UI helpers shared by both apps. */
var UI = (function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function h(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  var toastWrap;
  function toast(msg, err) {
    if (!toastWrap) { toastWrap = document.createElement('div'); toastWrap.className = 'toast-wrap'; document.body.appendChild(toastWrap); }
    var t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; toastWrap.appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 5000 : 2600);
  }
  var stack = [];
  function modal(o) {
    var ov = h('<div class="overlay"><div class="modal ' + (o.size || 'mid') + '"></div></div>');
    var m = ov.firstElementChild;
    if (o.title !== undefined) {
      m.appendChild(h('<div class="modal-h"><div class="title grow ellip">' + esc(o.title) + '</div><button class="ghost icon" data-close aria-label="Close">' + ICONS('x') + '</button></div>'));
    }
    var body = document.createElement('div'); body.className = 'modal-b'; m.appendChild(body);
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    if (o.buttons) {
      var f = document.createElement('div'); f.className = 'modal-f'; m.appendChild(f);
      o.buttons.forEach(function (b) {
        var btn = h('<button class="' + (b.primary ? 'primary' : '') + (b.danger ? ' danger' : '') + '">' + esc(b.label) + '</button>');
        btn.onclick = function () { b.onClick && b.onClick(api); };
        f.appendChild(btn);
      });
    }
    var api = {
      el: m, body: body, overlay: ov,
      close: function (v) {
        if (api.closed) return; if (o.beforeClose && o.beforeClose() === false) return;
        api.closed = true; ov.remove(); stack.splice(stack.indexOf(api), 1); o.onClose && o.onClose(v);
      }
    };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov && !o.noBackdropClose) api.close(); });
    m.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { api.close(); }; });
    document.body.appendChild(ov); stack.push(api);
    return api;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stack.length) {
      var top = stack[stack.length - 1];
      if (document.querySelector('.menu')) return;
      if (top.onEscape && top.onEscape() === false) return;
      e.preventDefault(); top.close();
    }
  });
  function ask(o) {
    return new Promise(function (res) {
      var html = '<form>' + (o.text ? '<p class="muted" style="margin-top:0">' + o.text + '</p>' : '') + o.fields.map(function (f) {
        var inp;
        if (f.type === 'textarea') inp = '<textarea name="' + f.name + '" rows="' + (f.rows || 10) + '" style="font-family:var(--mono);font-size:12px" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
        else if (f.type === 'select') inp = '<select name="' + f.name + '">' + f.options.map(function (op) { return '<option value="' + esc(op.value) + '"' + (op.value === f.value ? ' selected' : '') + '>' + esc(op.label) + '</option>'; }).join('') + '</select>';
        else inp = '<input type="text" name="' + f.name + '" value="' + esc(f.value || '') + '" placeholder="' + esc(f.placeholder || '') + '" autocomplete="off">';
        return '<label class="field"><span>' + esc(f.label) + '</span>' + inp + (f.hint ? '<span class="faint">' + esc(f.hint) + '</span>' : '') + '</label>';
      }).join('') + '<button type="submit" class="hidden"></button></form>';
      var done = false;
      var md = modal({
        title: o.title, body: html, size: o.size || 'small',
        buttons: [{ label: 'Cancel', onClick: function (m) { m.close(); } }, { label: o.ok || 'OK', primary: true, onClick: function () { submit(); } }],
        onClose: function () { if (!done) res(null); }
      });
      var form = md.body.querySelector('form');
      function submit() {
        var vals = {}; o.fields.forEach(function (f) { vals[f.name] = form.elements[f.name].value; });
        if (o.validate) { var err = o.validate(vals); if (err) { toast(err, true); return; } }
        done = true; md.close(); res(vals);
      }
      form.onsubmit = function (e) { e.preventDefault(); submit(); };
      var first = form.querySelector('input,textarea'); if (first) { first.focus(); if (first.select && o.selectBase) { var v = first.value, dot = v.lastIndexOf('.'); first.setSelectionRange(0, dot > 0 ? dot : v.length); } }
    });
  }
  function confirmBox(title, text, ok, danger) {
    return new Promise(function (res) {
      var done = false;
      modal({ title: title, body: '<p style="margin:0">' + text + '</p>', size: 'small',
        buttons: [{ label: 'Cancel', onClick: function (m) { m.close(); } }, { label: ok || 'OK', primary: !danger, danger: danger, onClick: function (m) { done = true; m.close(); res(true); } }],
        onClose: function () { if (!done) res(false); } });
    });
  }
  function closeMenus() { document.querySelectorAll('.menu').forEach(function (m) { m.remove(); }); }
  function menu(x, y, items) {
    closeMenus();
    var m = document.createElement('div'); m.className = 'menu';
    items.forEach(function (it) {
      if (it === '-') { m.appendChild(document.createElement('hr')); return; }
      var d = h('<div class="' + (it.danger ? 'danger' : '') + '">' + (it.icon ? ICONS(it.icon) : '') + '<span>' + esc(it.label) + '</span></div>');
      d.onclick = function (e) { e.stopPropagation(); closeMenus(); it.onClick(); };
      m.appendChild(d);
    });
    document.body.appendChild(m);
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
    setTimeout(function () { document.addEventListener('mousedown', function f(e) { if (!m.contains(e.target)) { closeMenus(); document.removeEventListener('mousedown', f); } }); }, 0);
    return m;
  }
  function menuAt(btn, items) { var r = btn.getBoundingClientRect(); return menu(r.left, r.bottom + 4, items); }
  function fmtSize(n) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(t, withTime) { var d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + (withTime ? ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''); }
  function ago(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 172800) return 'yesterday'; if (s < 604800) return Math.floor(s / 86400) + ' days ago'; return fmtDate(t);
  }
  function stamp(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds()); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function store(key, val) {
    try { if (val === undefined) { var v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); } localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }
  var Theme = {
    mode: 'auto',
    key: 'fv-theme', def: 'auto',
    init: function () { this.mode = store(this.key) || this.def; this.apply(); var self = this; matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { self.apply(); }); },
    set: function (m) { this.mode = m; store(this.key, m); this.apply(); },
    apply: function () { var dark = this.mode === 'dark' || (this.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-theme-btn') === Theme.mode); }); }
  };
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function themeSwitch() {
    return '<span class="theme-sw">' + ['light', 'dark', 'auto'].map(function (m) {
      return '<button class="ghost icon chipbtn" data-theme-btn="' + m + '" title="' + m + ' theme">' + (m === 'light' ? ICONS('sun') : m === 'dark' ? ICONS('moon') : '<span class="small">Auto</span>') + '</button>';
    }).join('') + '</span>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-theme-btn]'); if (b) Theme.set(b.getAttribute('data-theme-btn')); });
  return { esc: esc, h: h, toast: toast, modal: modal, ask: ask, confirm: confirmBox, menu: menu, menuAt: menuAt, closeMenus: closeMenus, fmtSize: fmtSize, fmtDate: fmtDate, ago: ago, stamp: stamp, pad: pad, debounce: debounce, store: store, Theme: Theme, download: download, themeSwitch: themeSwitch };
})();
