# -*- coding: utf-8 -*-
"""
前端调用 ↔ 云函数实现 的交叉校验（离线、只读）。

⚠️ 收敛为网关后，两套名字必须分开看：
  - 业务入口名（前端 callFunction('post-list') 用的）：定义在仓库根 gateway-routes.json 的 routes 键；
  - 部署单元名（真实的 cloudfunctions/<dir>）：routes 的值。
  早期版本直接拿「业务入口名」去比「cloudfunctions 子目录名」，网关收敛后必然 31 条全红——
  那不是真缺陷，是工具假设过期。此版本以 gateway-routes.json 为唯一事实来源。

输出：
  1. 前端调用但未登记在 routes 的入口（真问题：会被 callFunction 的白名单拦截）
  2. routes 登记但前端从未调用的入口（提示，可能仅触发器/控制台使用）
  3. routes 指向不存在的部署单元（真问题：部署会 404）

退出码：1 = 存在真问题；0 = 通过（提示不影响退出码）。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # uni-app
REPO = os.path.dirname(ROOT)

# 后端云函数目录：兼容 monorepo（REPO/cloudfunctions）与并列源仓（REPO/campushub/cloudfunctions）
_cf_candidates = [
    os.path.join(REPO, 'cloudfunctions'),
    os.path.join(REPO, 'campushub', 'cloudfunctions'),
]
REAL_CF = next((p for p in _cf_candidates if os.path.isdir(p)), _cf_candidates[0])

# 网关寻址表：唯一事实来源
_routes_candidates = [
    os.path.join(REPO, 'gateway-routes.json'),
    os.path.join(REPO, 'campushub', 'gateway-routes.json'),
]
ROUTES_FILE = next((p for p in _routes_candidates if os.path.isfile(p)), None)

deploy_units = sorted(d for d in os.listdir(REAL_CF) if os.path.isdir(os.path.join(REAL_CF, d)))
print('deploy units on disk (%d): %s' % (len(deploy_units), ', '.join(deploy_units)))

if not ROUTES_FILE:
    print('FATAL: gateway-routes.json 未找到，无法判定入口映射')
    sys.exit(1)

routes = json.load(open(ROUTES_FILE, encoding='utf-8')).get('routes', {})
entry_names = set(routes.keys())
print('registered business entries: %d' % len(entry_names))

srcs = []
for r, _, fs in os.walk(os.path.join(ROOT, 'src')):
    for f in fs:
        if f.endswith(('.vue', '.ts')):
            srcs.append(os.path.join(r, f))

used = set()
call_sites = {}
# 两种调用形态都要覆盖：
#   ① callFunction('xxx', ...)               —— 直接调用
#   ② usePagedList({ fnName: 'xxx', ... })    —— 列表 hook 的间接调用（市集/指南/通知等列表页都走这条）
PATTERNS = (
    r"callFunction(?:<[^>]*>)?\(\s*['\"]([a-zA-Z0-9_\-]+)['\"]",
    r"fnName\s*:\s*['\"]([a-zA-Z0-9_\-]+)['\"]",
)
for p in srcs:
    s = open(p, encoding='utf-8').read()
    rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
    for pat in PATTERNS:
        for m in re.finditer(pat, s):
            fn = m.group(1)
            used.add(fn)
            call_sites.setdefault(fn, []).append('%s:%d' % (rel, s[:m.start()].count('\n') + 1))

errors = []

# 1) 前端调用了未登记的入口
unregistered = sorted(used - entry_names)
if unregistered:
    print('\n[ERROR] 前端调用但未在 gateway-routes.json 登记 (%d)：' % len(unregistered))
    for fn in unregistered:
        print('  %s  %s' % (fn, call_sites.get(fn, [])))
        errors.append('未登记入口: %s' % fn)
else:
    print('\n[OK] 前端调用的 %d 个入口全部已登记' % len(used))

# 2) routes 指向不存在的部署单元
bad_targets = sorted({v for v in routes.values() if v not in deploy_units})
if bad_targets:
    print('\n[ERROR] gateway-routes 指向不存在的部署单元 (%d)：%s' % (len(bad_targets), bad_targets))
    errors.extend('目标缺失: %s' % t for t in bad_targets)
else:
    print('[OK] %d 个入口的目标部署单元全部存在' % len(routes))

# 3) 已登记但前端从未调用（提示级）
unused = sorted(entry_names - used)
print('\n[INFO] 已登记但前端未直接调用 (%d)：%s' % (len(unused), ', '.join(unused) if unused else '无'))

print('\n结果：%d 个错误' % len(errors))
sys.exit(1 if errors else 0)
