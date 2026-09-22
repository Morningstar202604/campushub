# -*- coding: utf-8 -*-
"""P6 全量优化 - 页面/样式终验脚本（只读，不改任何文件）
输出: scripts/verify_pages.out.txt

用法:  python scripts/verify_pages.py
说明:  扫描前会剥离注释（/* */、/** */、<!-- --> 及整行 //），
       因此「命中」均为真实代码，不再把「警示注释里提到的旧 API」误报为问题。
"""
import os, re, json, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'scripts', 'verify_pages.out.txt')
L = []
def w(s=''):
    L.append(str(s))

def rd(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def strip_comments(s):
    """剥离注释，避免注释里提到的旧 API 被误报。不做字符串感知（够用即可）。"""
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)      # /* */ 与 /** */
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)      # HTML 注释
    s = re.sub(r'(?m)^[ \t]*//.*$', '', s)            # 整行 //
    return s

def code(p):
    """读取并剥离注释后的源码"""
    return strip_comments(rd(p))

# ---------- 1. 页面文件清单 ----------
pages = sorted(glob.glob(os.path.join(ROOT, 'src', 'pages', '*', '*.vue')))
w('=== 1. 页面清单 ===')
w('page_count=%d' % len(pages))
for p in pages:
    w('  %s (%d bytes)' % (os.path.relpath(p, ROOT).replace('\\', '/'), os.path.getsize(p)))

# ---------- 2. 致命反模式全局扫描（已剥离注释） ----------
BAD = [
    'completeByData', 'completeError', 'completeByTotalCount(',
    'watch(paging', 'dataList', 'authorNickname', 'raw.anonymous',
    '#35E0C8', '#35e0c8', '#161B14', '#161b14',
    'app.mount(', 'createApp(App)',
]
w()
w('=== 2. 致命反模式扫描（全 src/**/*.vue + src/**/*.ts，注释已剥离）===')
targets = glob.glob(os.path.join(ROOT, 'src', '**', '*.vue'), recursive=True) + \
          glob.glob(os.path.join(ROOT, 'src', '**', '*.ts'), recursive=True)
w('scanned_files=%d' % len(targets))
bad_total = 0
for pat in BAD:
    hits = []
    for p in targets:
        try:
            n = code(p).count(pat)
        except Exception:
            continue
        if n:
            hits.append('%s x%d' % (os.path.relpath(p, ROOT).replace('\\', '/'), n))
    bad_total += len(hits)
    w('%-24s -> %s' % (pat, ('CLEAN' if not hits else '; '.join(hits))))
w('real_code_hits=%d (0 才算通过)' % bad_total)

# ---------- 3. 结构完整性（用原始源码） ----------
w()
w('=== 3. 结构完整性 ===')
struct_fail = []
for p in pages:
    s = rd(p)
    ob, cb = s.count('{'), s.count('}')
    tp, tpc = s.count('<template'), s.count('</template>')
    sp, spc = s.count('<script'), s.count('</script>')
    stp, stpc = s.count('<style'), s.count('</style>')
    if not (ob == cb and tp == tpc and sp == spc and stp == stpc):
        struct_fail.append('%s braces=%d/%d template=%d/%d script=%d/%d style=%d/%d'
                           % (os.path.relpath(p, ROOT).replace('\\', '/'), ob, cb, tp, tpc, sp, spc, stp, stpc))
for j in ['src/manifest.json', 'src/pages.json', 'package.json', 'tsconfig.json']:
    fp = os.path.join(ROOT, j)
    if os.path.exists(fp):
        try:
            json.loads(rd(fp))
            w('%-24s -> JSON OK' % j)
        except Exception as e:
            struct_fail.append('%s JSON ERROR: %s' % (j, e))
w('struct_failures=%d' % len(struct_fail))
for f in struct_fail:
    w('  !! ' + f)

# ---------- 4. 样式分层 ----------
w()
w('=== 4. 样式分层（注释已剥离）===')
for j in ['src/App.vue', 'src/styles/tokens.scss', 'src/styles/global.scss', 'vite.config.ts']:
    fp = os.path.join(ROOT, j)
    if not os.path.exists(fp):
        w('%-26s -> MISSING' % j)
        continue
    s = code(fp)
    tag = []
    if j.endswith('tokens.scss'):
        # 只允许「自定义属性声明」，不允许任何普通 CSS 声明（prop: value）
        body = re.sub(r'(?m)^[ \t]*--[\w-]+\s*:[^;]*;', '', s)   # 去掉变量声明
        leftover = re.findall(r'[a-zA-Z-]+\s*:\s*[^;{\n]', body)  # 剩余普通声明
        tag.append('vars_only=%s%s' % (not leftover, '' if not leftover else ' leftover=%s' % leftover[:4]))
    if j.endswith('global.scss'):
        tag.append('has_page=%s has_sticker=%s has_tabular=%s'
                   % ('page{' in s.replace(' ', ''), '.sticker' in s, '.tabular-nums' in s))
        tag.append('tabular_no_accent=%s' % ('.tabular-nums' in s and not re.search(r'\.tabular-nums[^}]*color\s*:', s)))
    if j == 'src/App.vue':
        tag.append('imports_tokens=%s imports_global=%s await_load=%s'
                   % ('styles/tokens' in s, 'styles/global' in s, 'await' in s))
    if j == 'vite.config.ts':
        tag.append("additionalData_empty=%s" % bool(re.search(r"additionalData\s*:\s*''", s)))
    w('%-26s -> %s' % (j, ' | '.join(tag)))

pt = []
for p in pages:
    if re.search(r"@import\s+['\"][^'\"]*tokens", code(p)):
        pt.append(os.path.relpath(p, ROOT).replace('\\', '/'))
w('pages_importing_tokens=%d %s   (0 才算通过)' % (len(pt), pt))

# ---------- 5. 关键一致性点 ----------
w()
w('=== 5. 关键一致性点（注释已剥离）===')
checks = [
    ('src/main.ts', r'createSSRApp', True),
    ('src/main.ts', r'wx\.cloud\.init', True),
    ('src/main.ts', r'app\.mount\(', False),
    ('src/stores/user.ts', r'user\._id', True),
    ('src/stores/user.ts', r'user\.openid', False),
    ('src/stores/school.ts', r'^\s*import\s+schoolConfig', True),
    ('src/stores/school.ts', r'await\s+import\(', False),
    ('src/adapters/index.ts', r'loadAnnouncements', True),
    ('src/adapters/index.ts', r'loadHomeFeed', False),
    ('src/adapters/index.ts', r'userNickname', True),
    ('src/composables/use-paged-list.ts', r'listKey', True),
    ('src/composables/use-comments.ts', r'resolveSource', True),
    ('src/pages/notification/notification.vue', r"targetType === 'user'", True),
    ('src/pages/notification/notification.vue', r'user-profile\?id=', True),
]
fails = 0
for f, pat, want in checks:
    fp = os.path.join(ROOT, f)
    if not os.path.exists(fp):
        w('%-42s %-26s -> MISSING FILE' % (f, pat)); fails += 1; continue
    got = bool(re.search(pat, code(fp), re.M))
    ok = got == want
    if not ok:
        fails += 1
    w('%-42s %-26s -> %s%s' % (f, pat, 'OK' if ok else 'FAIL', '' if ok else '  (want %s)' % want))
w('consistency_failures=%d' % fails)

# ---------- 6. z-paging 用法 ----------
w()
w('=== 6. z-paging 用法 ===')
for p in pages:
    s = code(p)
    if 'z-paging' in s:
        rel = os.path.relpath(p, ROOT).replace('\\', '/')
        if 'usePagedList' in s:
            how = 'via usePagedList(hook 内 completeByNoMore)'
        elif 'completeByNoMore' in s:
            how = 'completeByNoMore(直接)'
        elif re.search(r'\.complete\(', s):
            how = 'complete()'
        else:
            how = '!! 无完成回调'
        w('%-46s v-model=%-5s %s' % (rel, bool(re.search(r'<z-paging[^>]*v-model', s)), how))

# ---------- 7. 图标资源 ----------
w()
w('=== 7. Android/iOS 图标 ===')
for p in sorted(glob.glob(os.path.join(ROOT, 'src', 'static', 'app-icons', '**', '*.png'), recursive=True)):
    w('  %s %d bytes' % (os.path.relpath(p, ROOT).replace('\\', '/'), os.path.getsize(p)))

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(L))
print('WROTE', OUT)
print('real_code_hits=%d  struct_failures=%d  consistency_failures=%d'
      % (bad_total, len(struct_fail), fails))
