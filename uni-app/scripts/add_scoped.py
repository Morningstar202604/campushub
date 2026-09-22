# -*- coding: utf-8 -*-
"""批量为未 fenced 的页面样式补 scoped（设计系统 §十 约定：<style lang="scss" scoped>）。
安全前提：scripts/_style_scope_check.py 已确认这些页面的选择器全部只作用于本页模板类。
只替换 `<style lang="scss">` → `<style lang="scss" scoped>`，且要求每文件恰有一次。
"""
import glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [
    'src/pages/guide-list/guide-list.vue',
    'src/pages/index/index.vue',
    'src/pages/lost-found/lost-found.vue',
    'src/pages/market/market.vue',
    'src/pages/my-list/my-list.vue',
    'src/pages/post-create/post-create.vue',
    'src/pages/post-detail/post-detail.vue',
    'src/pages/product-create/product-create.vue',
    'src/pages/product-detail/product-detail.vue',
    'src/pages/user-profile/user-profile.vue',
    'src/pages/user-update/user-update.vue',
    'src/pages/wall/wall.vue',
]
OLD = '<style lang="scss">'
NEW = '<style lang="scss" scoped>'

changed, skipped = [], []
for rel in TARGETS:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        skipped.append(rel + ' (missing)')
        continue
    s = open(p, encoding='utf-8').read()
    n = s.count(OLD)
    if n != 1:
        skipped.append('%s (found %d occurrences, expect 1)' % (rel, n))
        continue
    if 'scoped' in s[s.find(OLD): s.find(OLD) + 40]:
        skipped.append(rel + ' (already scoped)')
        continue
    open(p, 'w', encoding='utf-8').write(s.replace(OLD, NEW, 1))
    changed.append(rel)

print('changed=%d' % len(changed))
for c in changed:
    print('  OK', c)
print('skipped=%d' % len(skipped))
for s_ in skipped:
    print('  SKIP', s_)
sys.exit(0 if not skipped else 1)
