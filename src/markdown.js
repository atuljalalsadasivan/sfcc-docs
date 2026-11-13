/* Small, safe Markdown renderer + code highlighter. Everything is HTML-escaped first; only known syntax becomes markup. */
var MD = (function () {
  'use strict';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var KW = {
    js: 'var let const function return if else for while do switch case break continue new this class extends import export from default try catch finally throw typeof instanceof in of null undefined true false async await require module',
    sql: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as distinct null is in like between union',
    java: 'public private protected class interface static final void int long double float boolean char new return if else for while try catch finally throw throws import package extends implements null true false this super'
  };
  KW.ds = KW.js; KW.ts = KW.js; KW.javascript = KW.js; KW.isml = KW.js;

  function highlight(code, lang) {
    lang = (lang || '').toLowerCase();
    if (lang === 'xml' || lang === 'html' || lang === 'isml' || lang === 'svg') {
      return esc(code).replace(/(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([\w:.-]+)((?:\s+[\w:.-]+(?:=&quot;[^&]*?&quot;)?)*)(\s*\/?&gt;)/g, function (m, com, open, name, attrs, close) {
        if (com) return '<span class="tk-com">' + com + '</span>';
        attrs = attrs.replace(/([\w:.-]+)(=)(&quot;[^&]*?&quot;)/g, '<span class="tk-attr">$1</span>$2<span class="tk-str">$3</span>');
        return open + '<span class="tk-tag">' + name + '</span>' + attrs + close;
      });
    }
    var words = KW[lang] || (lang === 'json' ? 'true false null' : KW.js);
    var kw = new RegExp('^(?:' + words.split(' ').join('|') + ')$', lang === 'sql' ? 'i' : '');
    var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*|#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
    var out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      if (m[1]) {
        var isCom = m[1][0] === '/' || (m[1][0] === '-' && lang === 'sql') || (m[1][0] === '#' && /^(sh|bash|py|python|yml|yaml|properties|ini)$/.test(lang));
        out += isCom ? '<span class="tk-com">' + esc(m[1]) + '</span>' : esc(m[1]);
      } else if (m[2]) out += (lang === 'json' && /^\s*:/.test(code.slice(re.lastIndex)) ? '<span class="tk-attr">' : '<span class="tk-str">') + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-num">' + m[3] + '</span>';
      else out += kw.test(m[4]) ? '<span class="tk-kw">' + m[4] + '</span>' : m[4];
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  function inline(s, ctx) {
    var store = [];
    function keep(html) { store.push(html); return '\u0000' + (store.length - 1) + '\u0000'; }
    s = s.replace(/`([^`]+)`/g, function (m, c) { return keep('<code>' + esc(c) + '</code>'); });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
      return keep('<img alt="' + alt + '" data-src="' + src + '" class="md-img">');
    });
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (m, target, label) {
      return keep('<a href="#" class="md-wiki" data-target="' + target.trim() + '">' + (label || target).trim() + '</a>');
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      if (/^(https?:|mailto:)/i.test(u)) return keep('<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>');
      if (/^javascript:/i.test(u)) return t;
      return keep('<a href="#" class="md-wiki" data-target="' + u + '">' + t + '</a>');
    });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, pre, u) { return pre + keep('<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'); });
    s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/==([^=]+)==/g, '<mark>$1</mark>');
    if (ctx && ctx.term) s = s; // reserved
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return store[+i]; });
  }

  function render(src) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n'), out = [], i = 0;
    function para(buf, start) { if (buf.length) out.push('<p data-line="' + start + '">' + buf.map(function (l) { return inline(l); }).join('<br>') + '</p>'); }
    while (i < lines.length) {
      var l = lines[i], m;
      if ((m = /^\s*(```|~~~)\s*([\w+-]*)/.exec(l))) {
        var fence = m[1], lang = m[2], code = [], st = i; i++;
        while (i < lines.length && lines[i].trim().indexOf(fence) !== 0) code.push(lines[i++]);
        i++;
        out.push('<pre class="md-code" data-line="' + st + '">' + (lang ? '<span class="md-lang">' + esc(lang) + '</span>' : '') + '<code>' + highlight(code.join('\n'), lang) + '</code></pre>');
        continue;
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { out.push('<h' + m[1].length + ' data-line="' + i + '">' + inline(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(l)) {
        var q = [], qs = i;
        while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push('<blockquote data-line="' + qs + '">' + render(q.join('\n')) + '</blockquote>');
        continue;
      }
      if (/\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var split = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var head = split(l), ts = i; i += 2;
        var body = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) body.push(split(lines[i++]));
        out.push('<div class="md-table-wrap" data-line="' + ts + '"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        var res = list(lines, i);
        out.push(res.html); i = res.next; continue;
      }
      if (!l.trim()) { i++; continue; }
      var buf = [], ps = i;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*~~~|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]) && !(/\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))) buf.push(lines[i++]);
      para(buf, ps);
    }
    return out.join('\n');
  }

  function list(lines, i) {
    var baseInd = /^(\s*)/.exec(lines[i])[1].length;
    var ordered = /^\s*\d+[.)]\s+/.test(lines[i]);
    var html = ordered ? '<ol>' : '<ul>';
    while (i < lines.length) {
      var l = lines[i], m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
      if (!m) {
        if (l.trim() && /^\s+/.test(l) && /^(\s*)/.exec(l)[1].length > baseInd) { html = html.replace(/<\/li>$/, '<br>' + inline(l.trim()) + '</li>'); i++; continue; }
        break;
      }
      var ind = m[1].length;
      if (ind < baseInd) break;
      if (ind > baseInd) {
        var sub = list(lines, i);
        html = html.replace(/<\/li>$/, sub.html + '</li>');
        i = sub.next; continue;
      }
      var text = m[3], task = /^\[( |x|X)\]\s*(.*)$/.exec(text);
      if (task) html += '<li class="md-task" data-line="' + i + '"><input type="checkbox" data-line="' + i + '"' + (task[1] !== ' ' ? ' checked' : '') + '> <span' + (task[1] !== ' ' ? ' class="done"' : '') + '>' + inline(task[2]) + '</span></li>';
      else html += '<li data-line="' + i + '">' + inline(text) + '</li>';
      i++;
    }
    return { html: html + (ordered ? '</ol>' : '</ul>'), next: i };
  }

  return { render: render, highlight: highlight, esc: esc, inline: inline };
})();
if (typeof module !== 'undefined') module.exports = MD;
