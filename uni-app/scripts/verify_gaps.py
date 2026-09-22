# -*- coding: utf-8 -*-
import json, os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
m = json.load(open(os.path.join(ROOT, 'src', 'manifest.json'), encoding='utf-8'))
print('mp-weixin.cloud =', json.dumps(m['mp-weixin'].get('cloud'), ensure_ascii=False))

print()
print('=== fnName: "xxx-list" 用法（hook 间接调用） ===')
for p in glob.glob(os.path.join(ROOT, 'src', '**', '*.vue'), recursive=True) + \
         glob.glob(os.path.join(ROOT, 'src', '**', '*.ts'), recursive=True):
    s = open(p, encoding='utf-8').read()
    for mm in re.finditer(r"fnName\s*:\s*['\"]([a-zA-Z0-9_\-]+)['\"]", s):
        print('  %s  -> fnName=%s' % (os.path.relpath(p, ROOT).replace(os.sep, '/'), mm.group(1)))

print()
print('=== 前端是否出现 post-update / product-update / 编辑入口 ===')
hits = 0
for p in glob.glob(os.path.join(ROOT, 'src', '**', '*.*'), recursive=True):
    if not p.endswith(('.vue', '.ts')):
        continue
    s = open(p, encoding='utf-8').read()
    for kw in ['post-update', 'product-update']:
        if kw in s:
            hits += 1
            print('  %s -> %s' % (os.path.relpath(p, ROOT).replace(os.sep, '/'), kw))
print('  hits=%d' % hits)

print()
print('=== 页面里是否有「编辑」动作 ===')
for p in glob.glob(os.path.join(ROOT, 'src', 'pages', '**', '*.vue'), recursive=True):
    s = open(p, encoding='utf-8').read()
    found = [kw for kw in ['编辑', 'onEdit', 'editPost', 'editProduct'] if kw in s]
    if found:
        print('  %s -> %s' % (os.path.relpath(p, ROOT).replace(os.sep, '/'), found))

print()
print('=== manifest appid / 文档提及 appid ===')
print('  src/manifest.json mp-weixin.appid =', repr(m['mp-weixin'].get('appid')))
for d in glob.glob(os.path.join(ROOT, 'docs', '*.md')) + [os.path.join(ROOT, 'README.md')]:
    if not os.path.exists(d):
        continue
    s = open(d, encoding='utf-8').read()
    if 'appid' in s.lower():
        print('  doc mentions appid: %s' % os.path.basename(d))

print()
print('=== campushub-uni/cloudfunctions 内容 ===')
cf = os.path.join(ROOT, 'cloudfunctions')
print('  exists=%s entries=%s' % (os.path.isdir(cf), os.listdir(cf) if os.path.isdir(cf) else None))
