"""FlowBack — CHAOS → ORDER. 15 s of programmatic typography.

The plate, every glyph, the grid and the soundtrack are code. No stock art.
Rendered with the RuiC motion engine (mg/core.py, mg/fonts.py, mg/anim.py, mg/dsp.py).
"""
from __future__ import annotations

import argparse
import math
import os
import subprocess
import sys
from functools import lru_cache

import numpy as np
from PIL import Image, ImageFont

from mg.core import Canvas
from mg import fonts as F
from mg import anim as A

from . import audio as AUD

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out")
FRAMES = os.path.join(OUT, "frames")

W, H = 1920, 1080
FPS = 30
DUR = 15.0
NFRAMES = int(round(DUR * FPS))

PAPER = (245, 241, 232)
INK = (24, 27, 24)
GREEN = (201, 242, 78)
ORANGE = (216, 100, 47)
MUTED = (111, 114, 104)
WHITE = (248, 246, 238)

CJK_PATH = os.path.join(ROOT, "assets", "fonts", "NotoSansSC-900.woff")
CJK_LIGHT_PATH = os.path.join(ROOT, "assets", "fonts", "NotoSansSC-500.woff")


def clamp01(x):
    return max(0.0, min(1.0, x))


def ease_out_expo(x):
    x = clamp01(x)
    return 1.0 if x >= 1.0 else 1.0 - 2.0 ** (-10.0 * x)


def ease_in_out(x):
    x = clamp01(x)
    return x * x * (3.0 - 2.0 * x)


def smoothstep(a, b, x):
    if b <= a:
        return 1.0 if x >= b else 0.0
    u = clamp01((x - a) / (b - a))
    return u * u * (3.0 - 2.0 * u)


def lerp(a, b, u):
    return a + (b - a) * u


@lru_cache(maxsize=256)
def cjk(size):
    return ImageFont.truetype(CJK_PATH, int(round(size)))


@lru_cache(maxsize=64)
def cjk_light(size):
    return ImageFont.truetype(CJK_LIGHT_PATH, int(round(size)))


def is_cjk(s):
    # Any non-ASCII punctuation too: Inter's fallback for a fullwidth mark is a
    # literal NO SIGNAL placard, which is not the brand we are setting.
    return any(ord(ch) > 127 for ch in s)


def txt(p, x, y, s, font, color, track=0, anchor="lt", alpha=1.0):
    if alpha <= 0.001 or not s:
        return 0
    return p.text(x, y, s, font, color, track, anchor, alpha)


def fit_display(s, target, lo=40, hi=520):
    return F.fit_size(s, target, F.display, -0.032, lo, hi)


# --------------------------------------------------------------------------
# 00–05  CHAOS
# --------------------------------------------------------------------------
WORDS = [
    "收到", "好的", "嗯", "周五?", "周四。", "改一下", "没人", "尽快",
    "谁来负责", "没有原文", "先别开工", "两个日期", "改到周四", "老板要提前看",
    "初稿", "最终稿", "?", "...", "已读", "未读", "就按这个", "再确认",
    "没有日期", "我来问", "还没联系", "舞台尺寸", "入场时间", "方案呢",
    "明天", "后天", "尽快", "收到", "好的", "？", "别漏了", "最后一次",
]

SLOTS = [
    (-70, 70, 270), (720, 60, 150), (1330, 110, 210), (1610, 50, 90),
    (390, 330, 180), (880, 300, 290), (1480, 330, 140),
    (90, 600, 180), (620, 620, 260), (1110, 650, 190), (1570, 680, 120),
    (260, 885, 160), (820, 900, 210), (1320, 880, 90),
]


def scene_chaos(c, t):
    cut = int(t / 0.38)
    u = (t - cut * 0.38) / 0.38
    dark = cut % 2 == 1
    bg = INK if dark else PAPER
    fg = PAPER if dark else INK
    c.clear(bg)
    p = c.pass_()

    # hard editorial rules and registration marks, not decoration: they measure the cut.
    for x in (80, 480, 900, 1320, 1740):
        p.line([(x, 42), (x, 1038)], fg, 0.8, 0.10)
    for y in (160, 470, 760, 1000):
        p.line([(48, y), (1872, y)], fg, 0.8, 0.10)
    p.text(78, 62, f"CUT {cut + 1:02d} / 13", F.mono(11, 500), ORANGE, 1.8, "lt", 0.9)
    p.text(1842, 62, f"{t:05.2f}s", F.mono(11, 500), ORANGE, 1.8, "rt", 0.9)

    # a big word carries each cut; alternate the language between cuts.
    BIG = [
        ("收到", -35, 70, 300, ORANGE), ("改周四", 210, 260, 220, fg),
        ("没人", 1150, 90, 330, GREEN), ("最终稿", -60, 520, 280, ORANGE),
        ("?", 1510, 640, 420, GREEN), ("先别开工", 310, 650, 180, fg),
        ("两个日期", -30, 240, 240, ORANGE), ("尽快", 1290, 610, 260, fg),
        ("没有原文", 430, 60, 180, GREEN), ("周四。", 790, 430, 370, ORANGE),
    ]
    s, x, y, size, color = BIG[cut % len(BIG)]
    font = cjk(size) if is_cjk(s) else F.display(size)
    if cut in (1, 4, 7, 9):
        offsets = [0, 12, -8, 18, -15, 9, -3, 22, -18, 5, 0, -9]
        p.text_slices(x, y, s, font, color, 0, 12, offsets, 0.94, None, "lt")
    else:
        txt(p, x, y, s, font, color, 0, "lt", 0.96)

    # 7 supporting fragments, selected deterministically so no two cuts repeat.
    for i in range(7):
        wi = (cut * 7 + i * 5 + 3) % len(WORDS)
        word = WORDS[wi]
        sx, sy, ss = SLOTS[(i * 3 + cut * 2) % len(SLOTS)]
        # keep the small type away from the hero word more often than not
        if abs(sx - x) < 360 and abs(sy - y) < 220:
            sx += 340
        size = max(24, int(ss * (0.42 + ((wi * 13) % 9) / 20.0)))
        col = ORANGE if (wi + cut) % 7 == 0 else (GREEN if (wi + cut) % 11 == 0 else fg)
        alpha = 0.55 if (wi + cut) % 3 == 0 else 0.92
        f = cjk(size) if is_cjk(word) else F.ui(size, 700)
        txt(p, sx, sy, word, f, col, 0, "lt", alpha)

    # clipped fragments at the frame edge: the crop is the composition.
    if cut in (2, 5, 8, 11):
        f = cjk(86)
        txt(p, -52, 940, "还没确认", f, fg, 0, "lt", 0.38)
    if cut in (3, 6, 10):
        p.rect(0, 0, 1920, 18, ORANGE, 0.95)
        p.rect(0, 1062, 1920, 18, GREEN, 0.95)

    # micro ticks: cut marks, not noise.
    for k in range(7):
        bx = 120 + k * 252 + (cut % 3) * 20
        p.rect(bx, 994, 46 + (k % 3) * 18, 2, fg if k % 2 else ORANGE, 0.7)

    # last beat of the chaos: the word was always one word away from order.
    if t >= 4.50:
        q = smoothstep(4.50, 4.92, t)
        p.rect(0, 0, 1920, 1080, INK, q)
        p.text(96, 168, "CHAOS", F.display(344), PAPER, -9.0, "lt", q)
        p.text(101, 560, "没有结构，只有回声。", cjk(54), GREEN, 0, "lt", q * 0.96)
        p.line([(101, 668), (1820, 668)], ORANGE, 3, q)


# --------------------------------------------------------------------------
# 05–10  ORDER
# --------------------------------------------------------------------------
def scene_order(c, t):
    c.clear(PAPER)
    p = c.pass_()
    # the grid is the story: the same frame the noise now has to obey.
    for x in (100, 500, 900, 1300, 1700, 1820):
        p.line([(x, 120), (x, 960)], INK, 1.0, 0.16)
    for y in (180, 420, 660, 900, 960):
        p.line([(100, y), (1820, y)], INK, 1.0, 0.16)
    p.text(100, 88, "05 / ORDER", F.mono(12, 500), ORANGE, 2.0, "lt", 0.9)
    p.text(1820, 88, "NOISE → STRUCTURE", F.mono(11, 500), MUTED, 1.6, "rt", 0.9)

    # ORDER enters from the wreckage: size settles, no bounce.
    u = ease_out_expo((t - 5.0) / 0.8)
    size = lerp(350, 206, u)
    txt(p, 96, 128 + (1 - u) * 34, "ORDER", F.display(size), INK, -7.0, "lt", 1.0)
    p.line([(102, 360), (102 + 800 * u, 360)], ORANGE, 4.0, 0.9)
    p.text(102, 386, "每一句话，都有位置。", cjk(40), MUTED, 0, "lt", 0.95)

    cols = [
        (102, "01 / TASK", "提交最终稿", "“周四交”"),
        (502, "02 / OWNER", "小王", "逐字引用"),
        (902, "03 / DUE", "周四", "11/02"),
        (1302, "04 / SOURCE", "“周四交”", "原文保留"),
    ]
    for i, (x, label, value, sub) in enumerate(cols):
        start = 5.45 + i * 0.16
        v = ease_out_expo((t - start) / 0.68)
        if v <= 0.01:
            continue
        dx = (1 - v) * (-70 if i % 2 == 0 else 70)
        y0 = 500
        p.rect(x + dx, y0, 340, 126, GREEN if i == 1 and t > 7.15 else (255, 255, 255), 0.75 if i == 1 and t > 7.15 else 0.4)
        p.text(x + dx + 18, y0 + 14, label, F.mono(11, 500), ORANGE if i == 1 else MUTED, 1.4, "lt", v)
        f = cjk(44) if is_cjk(value) else F.display(44)
        p.text(x + dx + 18, y0 + 42, value, f, INK, -1.0, "lt", v)
        p.text(x + dx + 18, y0 + 98, sub, F.mono(10, 500), MUTED, 1.0, "lt", v * 0.9)

    # the columns become a sentence, then a hard order.
    if t > 7.55:
        v = ease_out_expo((t - 7.55) / 0.65)
        p.line([(102, 760), (102 + 1230 * v, 760)], INK, 8.0, 0.95)
        p.text(102, 792, "ORDER", F.display(152), INK, -4.5, "lt", v)
        p.text(780, 824, "is a decision, not a layout.", F.ui(32, 500), MUTED, 0, "lt", v)
        p.rect(102, 906, 260 * v, 3, GREEN, 0.95)

    # last 0.25 s: invert, cut to action.
    if t > 9.55:
        q = smoothstep(9.55, 9.95, t)
        p.rect(0, 0, 1920, 1080, INK, q)
        p.text(96, 156, "ORDER", F.display(300), GREEN, -8.0, "lt", q)
        p.text(102, 560, "不是整理，是决定。", cjk(54), PAPER, 0, "lt", q)


# --------------------------------------------------------------------------
# 10–13  ACTION
# --------------------------------------------------------------------------
def scene_action(c, t):
    cut = int((t - 10.0) / 0.28)
    u = ((t - 10.0) % 0.28) / 0.28
    # high-contrast alternation: black / signal / white, with one green flash.
    scheme = [
        (INK, GREEN), (GREEN, INK), (PAPER, INK), (INK, PAPER),
        (GREEN, INK), (PAPER, INK), (INK, GREEN), (GREEN, INK),
        (PAPER, INK), (INK, PAPER), (GREEN, INK), (PAPER, INK),
    ]
    bg, fg = scheme[cut % len(scheme)]
    c.clear(bg)
    p = c.pass_()

    # full-bleed type, shifted so the crop is felt.
    s = "ACTION"
    font = F.display(420)
    x = -70 + (cut % 4) * 24
    y = 120 + (cut % 3) * 18
    if cut in (2, 5, 8):
        offsets = [0, 20, -14, 31, -20, 12, -8, 25, -16, 6]
        p.text_slices(x, y, s, font, fg, -10, 10, offsets, 1.0, None, "lt")
    else:
        p.text(x, y, s, font, fg, -10, "lt", 1.0)

    p.text(102, 92, "10 / ACTION", F.mono(12, 500), ORANGE if bg != GREEN else INK, 2, "lt", 0.9)
    p.text(1818, 92, f"CUT {cut + 1:02d}", F.mono(11, 500), ORANGE if bg != GREEN else INK, 1.6, "rt", 0.9)
    p.text(104, 620, "NO SILENT WRITES.", F.mono(13, 500), fg, 1.8, "lt", 0.9)
    p.text(1818, 620, "HUMAN CHECK.", F.mono(13, 500), fg, 1.8, "rt", 0.9)

    # a precise inventory bar, moving with the cut.
    p.rect(104, 676, 1712, 2, fg, 0.55)
    p.rect(104 + (cut % 6) * 220, 676, 190, 2, GREEN if bg != GREEN else INK, 1)
    p.text(104, 700, "TASK / OWNER / DUE / SOURCE", F.mono(10, 500), fg, 1.3, "lt", 0.72)

    # final beat: one green field, one word, no more editing.
    if t > 12.62:
        q = smoothstep(12.62, 12.9, t)
        p.rect(0, 0, 1920, 1080, GREEN, q)
        p.text(70, 140, "ACTION", F.display(420), INK, -10, "lt", q)
        p.text(108, 626, "不只是一条待办。", cjk(52), INK, 0, "lt", q)


# --------------------------------------------------------------------------
# 13–15  LOCKUP
# --------------------------------------------------------------------------
def scene_end(c, t):
    c.clear(PAPER)
    p = c.pass_()
    u = ease_out_expo((t - 13.0) / 0.55)
    # a white field, exact type, nothing invented.
    p.rect(0, 0, 1920, 1080, PAPER, 1)
    p.rect(0, 0, 1920, 10, GREEN, 1)
    p.rect(0, 1070, 1920, 10, GREEN, 1)

    p.text(120, 118, "FLOWBACK / ECHO", F.mono(12, 500), ORANGE, 2.2, "lt", u)
    p.text(120, 166, "CHAOS → ORDER", F.mono(11, 500), MUTED, 1.8, "lt", u * 0.9)
    p.line([(120, 208), (120 + 520 * u, 208)], INK, 1.2, 0.5)

    size = lerp(154, 210, u)
    txt(p, 112, 254 + (1 - u) * 26, "FlowBack", F.display(size), INK, -9.0, "lt", u)
    txt(p, 118, 540 + (1 - u) * 18, "回响", cjk(126), GREEN, 0, "lt", u)

    p.text(120, 744, "FROM NOISE TO ACTION", F.mono(28, 500), INK, 5.2, "lt", u)
    p.line([(120, 802), (120 + 1060 * u, 802)], GREEN, 5.0, 0.95)

    p.text(120, 850, "REAL H5 FLOW  ·  DEEPSEEK  ·  HUMAN-IN-THE-LOOP", F.mono(10, 500), MUTED, 1.3, "lt", u * 0.9)
    p.text(120, 878, "PROGRAMMATIC TYPE  /  RuiC MOTION ENGINE", F.mono(10, 500), MUTED, 1.3, "lt", u * 0.75)
    p.text(1800, 1006, "15 SEC  /  30 FPS", F.mono(10, 500), MUTED, 1.2, "rt", u * 0.8)


# --------------------------------------------------------------------------
def render_frame(t):
    c = Canvas(W, H, ss=1.5, out=(W, H))
    if t < 5.0:
        scene_chaos(c, t)
    elif t < 10.0:
        scene_order(c, t)
    elif t < 13.0:
        scene_action(c, t)
    else:
        scene_end(c, t)
    c.commit()
    c.grain(0.011, np.random.default_rng(1000 + int(round(t * FPS))))
    c.vignette(0.10 if t >= 5.0 else 0.18)
    c.tonemap(0.92)
    return c.image()


def frame_path(i):
    return os.path.join(FRAMES, f"f_{i + 1:05d}.png")


def render_one(i):
    img = render_frame(i / FPS)
    img.save(frame_path(i), optimize=True)
    return i


def build_audio():
    os.makedirs(OUT, exist_ok=True)
    st, sr = AUD.build()
    AUD.write_wav(os.path.join(OUT, "track.wav"), st, sr)
    return os.path.join(OUT, "track.wav")


def encode():
    FF = os.environ.get("FFMPEG", "ffmpeg")
    out = os.path.join(OUT, "FlowBack_Typography_15s.mp4")
    cmd = [
        FF, "-y", "-framerate", str(FPS), "-start_number", "1",
        "-i", os.path.join(FRAMES, "f_%05d.png"),
        "-i", os.path.join(OUT, "track.wav"),
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out,
    ]
    subprocess.run(cmd, check=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--at", default=None, help="comma-separated seconds for full-res stills")
    ap.add_argument("--stills", default=None, help="comma-separated times for a contact sheet")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--audio-only", action="store_true")
    ap.add_argument("--encode-only", action="store_true")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(FRAMES, exist_ok=True)
    if a.audio_only:
        print(build_audio())
        return
    if a.encode_only:
        print(encode())
        return
    if a.at:
        for s in a.at.split(","):
            t = float(s)
            img = render_frame(t)
            path = os.path.join(OUT, f"at_{t:05.2f}.png")
            img.save(path)
            print(path)
        return
    if a.stills:
        ims = []
        for s in a.stills.split(","):
            img = render_frame(float(s))
            ims.append(img.resize((640, 360), Image.LANCZOS))
        sheet = Image.new("RGB", (640 * 2, 360 * ((len(ims) + 1) // 2)), INK)
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % 2) * 640, (i // 2) * 360))
        path = os.path.join(OUT, "contact-sheet.jpg")
        sheet.save(path, quality=92)
        print(path)
        return
    # full film
    build_audio()
    if not os.path.exists(frame_path(0)):
        from multiprocessing import Pool
        with Pool(a.workers) as pool:
            for _ in pool.imap_unordered(render_one, range(NFRAMES), chunksize=4):
                pass
    print(encode())


if __name__ == "__main__":
    main()
