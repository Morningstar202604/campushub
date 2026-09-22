# -*- coding: utf-8 -*-
"""样式 scoped 安全面检查：页面 <style> 里的类选择器是否都出现在该页 <template> 中。
若页面样式只选择本页模板类 → 补 scoped 安全；若样式命中组件库内部类 → 补 scoped 会失效，需人工处理。
输出：每页 SCOPED/UNFENCED + 不在模板中的类清单（scss 嵌套里的修饰/状态类会被列为 low-risk）。
"""
import re, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = {'active', 'on', 'parent', 'done', 'sold', 'disabled', 'is-on', 'is-sold',
         'is-off', 'err', 'retry', 'collect', 'mine', 'sub', 'req', 'tabular-nums'}

for p in sorted(glob.glob(os.path.join(ROOT, 'src', 'pages', '*', '*.vue'))):
    rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
    s = open(p, encoding='utf-8').read()
    m = re.search(r'<style[^>]*>', s)
    if not m:
        continue
    tag = m.group(0)
    style_body = s[m.start():]
    tpl = s[:m.start()]

    classes = set(re.findall(r'\.([a-zA-Z][\w-]*)', style_body))
    tpl_classes = set()
    for cm in re.finditer(r'class="([^"]*)"', tpl):
        tpl_classes.update(cm.group(1).split())
    # :class="{ key: cond }" 绑定中的字面 key
    for cm in re.finditer(r':class="\{([^}]*)\}"', tpl):
        tpl_classes.update(re.findall(r"([a-zA-Z][\w-]*)\s*:", cm.group(1)))
    # :class="['a','b']" 数组形式
    for cm in re.finditer(r":class='\[([^\]]*)\]'", tpl):
        tpl_classes.update(re.findall(r"'([a-zA-Z][\w-]*)'", cm.group(1)))
    for cm in re.finditer(r':class="\[([^\]]*)\]"', tpl):
        tpl_classes.update(re.findall(r"'([a-zA-Z][\w-]*)'", cm.group(1)))

    missing = sorted(c for c in classes if c not in tpl_classes and c not in STATE)
    print('%-9s %-46s style_cls=%3d unresolved=%2d %s'
          % ('SCOPED' if 'scoped' in tag else 'UNFENCED', rel, len(classes), len(missing), missing[:8]))
