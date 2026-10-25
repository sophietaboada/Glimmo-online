"""Generate the app icons (PNG) without any third-party libraries.

Usage: python3 tools/make_icons.py
Draws a purple tile with a white card showing a red, green and purple diamond.
"""
import struct
import zlib
from pathlib import Path

BG = (75, 42, 138)
CARD = (255, 255, 255)
DIAMONDS = [(224, 40, 60), (18, 154, 74), (106, 45, 181)]
SUPERSAMPLE = 4


def pixel(x, y):
    """Colour at normalised coordinates (0..1)."""
    # White card with rounded corners, inset from the edges (keeps maskable safe zone).
    cx0, cy0, cx1, cy1, r = 0.14, 0.24, 0.86, 0.76, 0.06
    dx = max(cx0 + r - x, 0, x - (cx1 - r))
    dy = max(cy0 + r - y, 0, y - (cy1 - r))
    if not (cx0 <= x <= cx1 and cy0 <= y <= cy1 and dx * dx + dy * dy <= r * r):
        return BG
    for i, colour in enumerate(DIAMONDS):
        mx = 0.32 + i * 0.18
        if abs(x - mx) / 0.07 + abs(y - 0.5) / 0.19 <= 1:
            return colour
    return CARD


def render(size):
    rows = []
    n = SUPERSAMPLE
    for py in range(size):
        row = bytearray([0])  # filter type: none
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(n):
                for sx in range(n):
                    c = pixel((px + (sx + 0.5) / n) / size, (py + (sy + 0.5) / n) / size)
                    for k in range(3):
                        acc[k] += c[k]
            row += bytes(v // (n * n) for v in acc)
        rows.append(bytes(row))
    return b"".join(rows)


def png(size):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(render(size), 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        (out / f"icon-{size}.png").write_bytes(png(size))
        print(f"wrote icons/icon-{size}.png")
