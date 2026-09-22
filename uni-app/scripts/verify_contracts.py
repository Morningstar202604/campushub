# -*- coding: utf-8 -*-
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # campushub-uni 或 monorepo/uni-app
# 后端云函数目录：兼容两种布局 —— monorepo 内 = ROOT 的父目录/cloudfunctions；
# 独立源仓布局（campushub-uni 与同级 campushub 并列）= 父目录/campushub/cloudfunctions
_candidates = [
    os.path.join(os.path.dirname(ROOT), 'cloudfunctions'),
    os.path.join(os.path.dirname(ROOT), 'campushub', 'cloudfunctions'),
]
REAL_CF = next((p for p in _candidates if os.path.isdir(p)), _candidates[0])

m = json.load(open(os.path.join(ROOT, 'src', 'manifest.json'), encoding='utf-8'))
mw = m.get('mp-weixin', {})
print('manifest.mp-weixin keys:', list(mw.keys()))
print('cloudfunctionRoot:', mw.get('cloudfunctionRoot'))
print('mp-weixin appid:', repr(mw.get('appid')))
print('top-level appid:', repr(m.get('appid')))
print('---')

fns = sorted(d for d in os.listdir(REAL_CF) if os.path.isdir(os.path.join(REAL_CF, d)))
print('real backend fns:', len(fns))

srcs = []
for r, _, fs in os.walk(os.path.join(ROOT, 'src')):
    for f in fs:
        if f.endswith(('.vue', '.ts')):
            srcs.append(os.path.join(r, f))

missing = {}
used = set()
for p in srcs:
    s = open(p, encoding='utf-8').read()
    rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
    for m2 in re.finditer(r"callFunction\(\s*['\"]([a-zA-Z0-9_\-]+)['\"]", s):
        fn = m2.group(1)
        used.add(fn)
        if fn not in fns:
            missing.setdefault(fn, []).append('%s:%d' % (rel, s[:m2.start()].count('\n') + 1))

print('distinct fns used by frontend:', len(used))
print('MISSING vs real backend:', len(missing))
for k, v in sorted(missing.items()):
    print('  !!', k, v)

unused = sorted(set(fns) - used)
print()
print('backend fns NOT called by frontend (%d):' % len(unused))
print('  ' + ', '.join(unused))
