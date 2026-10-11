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


def link(f, a, b, xm=None, **kw):
    """orthogonal H-V-H wire a -> b"""
    if abs(a[1] - b[1]) < 0.5:
        return f.wire([a, b], **kw)
    xm = (a[0] + b[0]) / 2 if xm is None else xm
    return f.wire([a, (xm, a[1]), (xm, b[1]), b], **kw)


def axis_test(f, x0, y0, a_pos, a_sz, b_pos, b_sz, tag):
    """1-D interval overlap: a_pos < b_pos+b_sz  &  b_pos < a_pos+a_sz.  returns out pin of AND, plus input ports."""
    pa = port(f, x0, y0, a_pos, 10)
    ps = port(f, x0, y0 + 46, a_sz, 10)
    pb = port(f, x0, y0 + 140, b_pos, 10)
    pz = port(f, x0, y0 + 186, b_sz, 10)
    XA, XB = x0 + 150, x0 + 175
    ad1 = f.op(x0 + 240, y0 + 10, "+", w=70, h=50, ins=("a", "b"), ts=16)
    ad2 = f.op(x0 + 240, y0 + 150, "+", w=70, h=50, ins=("a", "b"), ts=16)
    c1 = f.op(x0 + 420, y0 + 130, "<", w=70, h=50, ins=("a", "b"), ts=16)   # a_pos < b_end
    c2 = f.op(x0 + 420, y0 + 40, "<", w=70, h=50, ins=("a", "b"), ts=16)    # b_pos < a_end
    f.wire([pa["r"], ad1["a"]] if False else [pa["r"], (XA, y0), (XA, ad1["a"][1]), ad1["a"]])
    f.dot((XA, y0))
    f.wire([(XA, y0), (XA, c1["a"][1] + 0), c1["a"]] if False else [(XA, y0), (XA, y0 + 120), (x0 + 380, y0 + 120), (x0 + 380, c1["a"][1]), c1["a"]])
    f.wire([ps["r"], (XB, y0 + 46), (XB, ad1["b"][1]), ad1["b"]])
    f.wire([pb["r"], (XA, y0 + 140), (XA, ad2["a"][1]), ad2["a"]]) if False else f.wire([pb["r"], (XB + 0, y0 + 140), (XB, ad2["a"][1]), ad2["a"]])
    f.dot((XB, y0 + 140))
    f.wire([(XB, y0 + 140), (XB, y0 + 100), (x0 + 380, y0 + 100)][:2] + [(x0 + 395, y0 + 100), (x0 + 395, c2["a"][1]), c2["a"]], arrow=True)
    f.wire([pz["r"], (XA, y0 + 186), (XA, ad2["b"][1]), ad2["b"]])
    f.wire([ad1["y"], (x0 + 350, ad1["y"][1]), (x0 + 350, c2["b"][1]), c2["b"]], label="a_end", seg=0, ldy=-2, lsize=9)
    f.wire([ad2["y"], (x0 + 350, ad2["y"][1]), (x0 + 350, c1["b"][1]), c1["b"]], label="b_end", seg=0, ldy=-2, lsize=9)
    ag = f.gate("and", x0 + 560, y0 + 90, 40, 40)
    f.wire([c2["y"], (x0 + 530, c2["y"][1]), (x0 + 530, ag["in1"][1]), ag["in1"]])
    f.wire([c1["y"], (x0 + 530, c1["y"][1]), (x0 + 530, ag["in2"][1]), ag["in2"]])
    f.text(x0 + 280, y0 - 10, tag, 11, color="#333", weight="bold")
    return ag["out"]


def mux8(f, x, y, src_text, sel_text="scan_q[2:0]", h=160, ins=8, w=40, bus="8x10", color="reg"):
    """8:1 mux fed by one bus port on the left (shared rail + 8 taps).  returns mux box."""
    m = f.mux(x, y, h, ins=tuple(str(i) for i in range(ins)), sel=None, w=w)
    p = port(f, x - 220, y + h / 2, src_text, 10, color="#a35c00")
    rx = x - 30
    f.wire([p["r"], (rx, p["r"][1])], color, arrow=False, bus=bus, lpos=0.5)
    f.dot((rx, p["r"][1]), color)
    busline(f, rx, m["0"][1], m["%d" % (ins - 1)][1], color, 3)
    for i in range(ins):
        yy = m[str(i)][1]
        f.wire([(rx, yy), m[str(i)]], color)
    sp = port(f, x + w / 2 - 36, y + h + 36, sel_text, 9, color="#2e9d3a", w=72)
    f.wire([(x + w / 2, y + h + 25), m["sel"]], "ctrl")
    return m


def cport(f, cx, y, text, size=9, color="#000"):
    """port box centred on cx"""
    w = tw(text, size)
    return port(f, cx - w / 2, y, text, size, color=color)


def ffq(f, x, y, label, w=110, h=44, ts=11):
    b = f.seq(x, y, w, h, label, ts=ts)
    pin(f, b, "D", "L", h / 2, show=False)
    pin(f, b, "Q", "R", h / 2, show=False)
    return b
