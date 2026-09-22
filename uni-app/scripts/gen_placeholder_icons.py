#!/usr/bin/env python3
"""生成 manifest.json 所需的占位 App 图标（纯标准库，无需 Pillow）。

背景：src/manifest.json 的 app-plus.distribute.icons 引用了
  static/app-icons/android/{hdpi,xhdpi,xxhdpi,xxxhdpi}.png 与 static/app-icons/ios/appstore.png
但这 5 个文件从未存在于仓库中 —— HBuilderX 云打包会因「图标文件不存在」直接失败。
本脚本按各密度规范尺寸生成品牌色占位图，让打包链路先跑通。

⚠️ 上线前必须替换为真实品牌图标（同一路径同名覆盖即可）：
   - Android：hdpi 72 / xhdpi 96 / xxhdpi 144 / xxxhdpi 192
   - iOS App Store：1024（不可含 alpha 通道，本脚本输出 RGB 无 alpha，符合要求）

用法：python scripts/gen_placeholder_icons.py
"""
from __future__ import annotations

import os
import struct
import zlib

# 品牌色：墨荧 · Acid Campus —— 深底 #0D110E + 荧光青柠 #C8F135
BG = (0x0D, 0x11, 0x0E)
FG = (0xC8, 0xF1, 0x35)

SPECS = [
    ("android/hdpi.png", 72),
    ("android/xhdpi.png", 96),
    ("android/xxhdpi.png", 144),
    ("android/xxxhdpi.png", 192),
    ("ios/appstore.png", 1024),
]

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "static", "app-icons")


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, size: int) -> None:
    """输出 size×size 的 RGB PNG：品牌深底 + 居中青柠圆角方块。"""
    half = size * 0.30
    corner = size * 0.10
    inner = half - corner
    c = (size - 1) / 2.0

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0 (None)
        dy = abs(y - c)
        for x in range(size):
            dx = abs(x - c)
            inside = dx <= half and dy <= half
            if inside:
                ox, oy = dx - inner, dy - inner
                if ox > 0 and oy > 0 and ox * ox + oy * oy > corner * corner:
                    inside = False
            raw += bytes(FG if inside else BG)

    blob = b"\x89PNG\r\n\x1a\n"
    blob += _chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    blob += _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    blob += _chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(blob)
    print(f"  {os.path.relpath(path)}  {size}x{size}  {len(blob)} bytes")


def main() -> None:
    print("[gen_placeholder_icons] 输出目录:", os.path.normpath(ROOT))
    for rel, size in SPECS:
        write_png(os.path.join(ROOT, rel), size)
    print("[gen_placeholder_icons] 完成 —— 上线前请替换为真实品牌图标")


if __name__ == "__main__":
    main()
