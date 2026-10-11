"""Helpers for gate-level figures."""
from lib2 import Fig, pin, busline, vtext, HVH, VHV, H, V
from lib import C


def tw(t, size=11):
    return len(t) * size * 0.62 + 14


def port(f, x, y, text, size=11, w=None, color="#000", fill="#fff"):
    """Signal-name box (like the boxed names in the hand-drawn diagrams). y = centre line."""
    w = w or tw(text, size)
    f.rect(x, y - 11, w, 22, fill=fill, stroke="#000", sw=1.4)
    f.text(x + w / 2, y + 4, text, size, color=color)
    return dict(r=(x + w, y), l=(x, y), t=(x + w / 2, y - 11), b=(x + w / 2, y + 11), w=w)




def ff(f, x, y, label="FF", w=70, h=50, bits=None, sub=None, en=False, fill=None):
    b = f.seq(x, y, w, h, label, ts=12, sub=sub)
    pin(f, b, "D", "L", 18, show=True, size=9)
    pin(f, b, "Q", "R", 18, show=True, size=9)
    return b


def const(f, x, y, text, size=9):
    return port(f, x, y, text, size)


def reg(f, x, y, label, w=100, h=70, sub=None, ins=("D",), outs=("Q",), en=None):
    """Clocked register block with D/Q (+ optional EN on bottom)."""
    b = f.seq(x, y, w, h, label, ts=13, sub=sub, B=(("EN",) if en else ()))
    for i, n in enumerate(ins):
        pin(f, b, n, "L", 28 + i * 18, size=9)
    for i, n in enumerate(outs):
        pin(f, b, n, "R", 28 + i * 18, size=9)
    return b
