#!/usr/bin/env python3
"""双向校验：花括号配平 + 顶层标签开闭 + CSS 花括号。用法: python check_vue.py <file.vue...>"""
import sys, re

def check(f):
    src = open(f, encoding='utf-8').read()
    ok = True
    for a, b in [('{', '}'), ('(', ')'), ('[', ']')]:
        if src.count(a) != src.count(b):
            print(f"FAIL brace {a}{b}: {src.count(a)} vs {src.count(b)}")
            ok = False
    for tag in ['template', 'script', 'style']:
        opens = len(re.findall(rf'<{tag}[\s>]', src))
        closes = len(re.findall(rf'</{tag}>', src))
        if opens != closes:
            print(f"FAIL tag <{tag}>: {opens} vs {closes}")
            ok = False
    for m in re.finditer(r'<style[^>]*>(.*)</style>', src, re.S):
        css = m.group(1)
        if css.count('{') != css.count('}'):
            print(f"FAIL css brace: {css.count('{')} vs {css.count('}')}")
            ok = False
    print("PASS" if ok else "FAIL", f)
    return 0 if ok else 1

if __name__ == '__main__':
    rc = 0
    for f in sys.argv[1:]:
        rc = max(rc, check(f))
    sys.exit(rc)
