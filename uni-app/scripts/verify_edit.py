# -*- coding: utf-8 -*-
"""核验 frontend-engineer 的编辑功能交付：关键改动落盘 + splice 修复 + 结构配平"""
import os, re, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = []
def w(s=''):
    L.append(str(s))

def rd(p):
    return open(os.path.join(ROOT, p), encoding='utf-8').read()

EXPECT = {
    'src/pages/my-list/my-list.vue': [
        r"onEdit\s*\(", r"onToggleSold\s*\(", r"product-update", r"markSold",
        r"post-create/post-create\?id=", r"product-create/product-create\?id=",
        r"onShow", r"firstShow", r"\.my-edit", r"\.my-sold",
    ],
    'src/pages/post-create/post-create.vue': [
        r"editId", r"编辑帖子", r"loadPostForEdit|loadForEdit", r"post-update",
        r"restoreCategory|originalCategoryId", r"setNavigationBarTitle",
    ],
    'src/pages/product-create/product-create.vue': [
        r"editId", r"编辑商品", r"loadProductForEdit|loadForEdit", r"product-update",
        r"setNavigationBarTitle",
    ],
    'src/pages/product-detail/product-detail.vue': [
        r"isMine", r"markSold", r"编辑", r"product-update",
    ],
    'src/adapters/index.ts': [r"status\?\s*:\s*string", r"status:\s*raw\.status"],
}
all_ok = True
for f, pats in EXPECT.items():
    s = rd(f)
    w('== %s' % f)
    miss = [p for p in pats if not re.search(p, s)]
    w('   missing: %s' % (miss if miss else 'NONE'))
    if miss:
        all_ok = False
    # 结构
    ob, cb = s.count('{'), s.count('}')
    pairs = all(s.count('<' + t) == s.count('</' + t + '>') for t in ('template', 'script', 'style'))
    w('   braces %d/%d  tri-tag %s' % (ob, cb, 'OK' if pairs else 'FAIL'))
    if ob != cb or not pairs:
        all_ok = False
    # textarea 干扰修正后的 text 配平：剔除 <textarea 开头标签再数
    tpl = s[s.find('<template'):s.find('</template>') + 11]
    tpl2 = re.sub(r'<textarea\b', '<txa', tpl)
    tb = tpl2.count('<text') - tpl2.count('</text>')
    w('   text-pair(check adjusted) %d' % tb)

# splice 修复核查
for f, around in [('src/pages/post-create/post-create.vue', 331),
                  ('src/pages/product-create/product-create.vue', 201)]:
    s = rd(f).split('\n')
    lo, hi = max(0, around - 12), min(len(s), around + 12)
    seg = '\n'.join(s[lo:hi])
    bad = re.search(r'(?<!\.value)\.splice\(', seg)
    w('== splice@%s:%d -> %s' % (f, around, 'STILL BAD' if bad else 'fixed-or-not-present'))
    for i in range(lo, hi):
        if 'splice' in s[i]:
            w('   L%d: %s' % (i + 1, s[i].strip()))

# 全仓禁止串（真实代码口径：剥注释）
def strip_comments(x):
    x = re.sub(r'/\*.*?\*/', '', x, flags=re.S)
    x = re.sub(r'<!--.*?-->', '', x, flags=re.S)
    x = re.sub(r'(?m)^[ \t]*//.*$', '', x)
    return x
pages = []
for r, _, fs in os.walk(os.path.join(ROOT, 'src')):
    for fn in fs:
        if fn.endswith(('.vue', '.ts')):
            pages.append(os.path.join(r, fn))
bad_total = 0
for p in pages:
    c = strip_comments(rd(os.path.relpath(p, ROOT)))
    for pat in ['completeByData', 'completeError', 'authorNickname', 'raw.anonymous', 'dataList']:
        n = c.count(pat)
        if n:
            bad_total += n
            w('  !! %s x%d' % (os.path.relpath(p, ROOT).replace(os.sep, '/'), n))
w('forbidden_real_code_hits=%d' % bad_total)
w('VERDICT=%s' % ('PASS' if all_ok and bad_total == 0 else 'FAIL'))

open(os.path.join(ROOT, 'scripts', 'verify_edit.out.txt'), 'w', encoding='utf-8').write('\n'.join(L))
print('written')
