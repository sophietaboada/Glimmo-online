"""Generate the app icons (PNG) without any third-party libraries.

Usage: python3 tools/make_icons.py
Draws a navy tile with a white card showing a blue bolt, an orange moon and a teal star.
"""
import struct
import zlib
from pathlib import Path

BG = (11, 58, 92)
CARD = (255, 255, 255)
BLUE, ORANGE, TEAL = (0, 114, 178), (213, 94, 0), (0, 158, 115)
SUPERSAMPLE = 4
# Same outlines as public/cards.js, in a 40x80 box (the bolt as a polygon).
BOLT = [(23, 3), (37, 3), (27, 31), (36, 31), (11, 77), (17, 45), (5, 45)]


def in_polygon(x, y, points):
    inside = False
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            inside = not inside
    return inside


def covers(i, u, v):
    """Whether symbol i (bolt, moon, star) covers (u, v) in its own 40x80 box."""
    if i == 0:
        return in_polygon(u, v, BOLT)
    if i == 1:
        # Moon: inside one ellipse, outside a second one shifted right.
        return ((u - 22) / 19) ** 2 + ((v - 40) / 37) ** 2 <= 1 and ((u - 34) / 17) ** 2 + ((v - 40) / 36) ** 2 > 1
    # Star: a four-point sparkle with pinched sides.
    return (abs(u - 20) / 18) ** 0.6 + (abs(v - 40) / 37) ** 0.6 <= 1


def pixel(x, y):
    """Colour at normalised coordinates (0..1)."""
    # White card with rounded corners, inset from the edges (keeps maskable safe zone).
    cx0, cy0, cx1, cy1, r = 0.14, 0.24, 0.86, 0.76, 0.06
    dx = max(cx0 + r - x, 0, x - (cx1 - r))
    dy = max(cy0 + r - y, 0, y - (cy1 - r))
    if not (cx0 <= x <= cx1 and cy0 <= y <= cy1 and dx * dx + dy * dy <= r * r):
        return BG
    for i, colour in enumerate((BLUE, ORANGE, TEAL)):
        # Each symbol sits in a 0.15 x 0.30 slot, side by side across the card.
        u = (x - (0.205 + i * 0.2)) / 0.15 * 40
        v = (y - 0.35) / 0.30 * 80
        if 0 <= u <= 40 and 0 <= v <= 80 and covers(i, u, v):
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
    out = Path(__file__).resolve().parent.parent / "public" / "icons"
    out.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        (out / f"icon-{size}.png").write_bytes(png(size))
        print(f"wrote icons/icon-{size}.png")
