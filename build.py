#!/usr/bin/env python3
"""Inline all sources into one self-contained offline HTML file."""
import pathlib
SRC = pathlib.Path(__file__).parent / 'src'
OUT = pathlib.Path(__file__).parent
r = lambda n: (SRC / n).read_text(encoding='utf-8')

CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob:; frame-src blob:; object-src blob:; base-uri 'none'; form-action 'none'"

def page(title, css, js):
    return f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Offline only: this policy blocks every network request (no internet, no CDN, no tracking). -->
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<title>{title}</title>
<style>
{css}
</style>
</head>
<body>
<div id="app"></div>
<script>
{js}
</script>
</body>
</html>
'''

import json, re
def parse_learn():
    mods = []
    for f in sorted((SRC / 'learn').glob('*.md')):
        txt = f.read_text(encoding='utf-8')
        head, *blocks = re.split(r'^=== ', txt, flags=re.M)
        m = {'sources': [], 'q': [], 'p': [], 'notes': []}
        for line in head.strip().splitlines():
            if ':' not in line: continue
            k, v = line.split(':', 1); k = k.strip(); v = v.strip()
            if k == 'source':
                t, u = [x.strip() for x in v.split('|', 1)]; m['sources'].append([t, u])
            elif k == 'time':
                e, c, st = v.split('|'); m['time'] = {'easy': int(e), 'crash': int(c), 'standard': int(st)}
            else: m[k] = v
        qi = 0
        for b in blocks:
            hdr, _, body = b.partition('\n'); parts = hdr.split(); kind = parts[0]; body = body.strip('\n')
            if kind in ('easy', 'standard'): m[kind] = body.strip()
            elif kind == 'crash': m['crash'] = body.strip()
            elif kind == 'notes': m['notes'] = [l[2:].strip() for l in body.splitlines() if l.startswith('- ')]
            elif kind == 'q':
                q, _, a = body.partition('\n---\n'); qi += 1
                m['q'].append({'id': m['id'] + '-q' + str(qi), 'lv': parts[1], 'top': 'top' in parts, 'q': q.strip(), 'a': a.strip()})
            elif kind == 'p':
                t, _, rest = body.partition('\n---\n'); q, _, a = rest.partition('\n---\n')
                m['p'].append({'lv': parts[1], 't': t.strip(), 'q': q.strip(), 'a': a.strip()})
        for need in ('id', 'title', 'easy', 'crash', 'standard'):
            assert m.get(need), f'{f.name}: missing {need}'
        mods.append(m)
    return 'window.SFCC_LEARN = ' + json.dumps(mods, ensure_ascii=False).replace('</', '<\\/') + ';'

docs_guides = r('docs-guides.js') if (SRC / 'docs-guides.js').exists() else ''
docs_js = r('icons.js') + '\n' + r('ui.js') + '\n' + r('markdown.js') + '\n' + docs_guides + '\n' + parse_learn() + '\n' + r('docs-app.js').replace('/* ---------- start ---------- */', r('docs-learn.js') + '\n/* ---------- start ---------- */')
docs_css = r('common.css') + '\n' + r('viewer.css') + '\n' + r('sfcc.css') + '\n' + r('docs.css')
(OUT / 'SFCC Docs.html').write_text(page('SFCC Docs', docs_css, docs_js), encoding='utf-8')
print('built SFCC Docs.html')
