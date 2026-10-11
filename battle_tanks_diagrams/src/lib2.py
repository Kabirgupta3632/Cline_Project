"""Block / mux / gate primitives (mixed into Fig)."""
from lib import Fig as _Fig, Box, C


def _spread(n, lo, hi):
    return [(lo + hi) / 2] if n == 1 else [lo + (hi - lo) * i / (n - 1) for i in range(n)]


class Fig(_Fig):
    def block(s, x, y, w, h, title, L=(), R=(), T=(), B=(), fill="#eaf1ff", sub=None, ps=10, ts=15,
              stroke="#000", rx=4, pad=None, clk=False, tcolor="#000", showpins=True):
        b = Box(x, y, w, h)
        s.rect(x, y, w, h, fill=fill, stroke=stroke, sw=2, rx=rx)
        tl = title.split("\n")
        s.text(x + w / 2, y + 20, title, ts, weight="bold", color=tcolor)
        used = len(tl) * (ts + 3) + 4
        if sub:
            s.text(x + w / 2, y + used + 14, sub, 10, color="#444", italic=True)
            used += 13 * len(sub.split("\n")) + 4
        top = min(y + (pad if pad is not None else used + 22), y + h - 16)
        for nm, yy in zip(L, _spread(len(L), top, y + h - 12) if L else []):
            b.p[nm] = (x, yy)
            if showpins:
                s.text(x + 6, yy + 4, nm, ps, anchor="start", color="#222")
        for nm, yy in zip(R, _spread(len(R), top, y + h - 12) if R else []):
            b.p[nm] = (x + w, yy)
            if showpins:
                s.text(x + w - 6, yy + 4, nm, ps, anchor="end", color="#222")
        for nm, xx in zip(T, _spread(len(T), x + 30, x + w - 30) if T else []):
            b.p[nm] = (xx, y)
            s.text(xx, y + 14, nm, ps, color="#222")
        for nm, xx in zip(B, _spread(len(B), x + 30, x + w - 30) if B else []):
            b.p[nm] = (xx, y + h)
            s.text(xx, y + h - 6, nm, ps, color="#222")
        if clk:
            s.o.append(f'<path d="M{x},{y+h-22} L{x+11},{y+h-11} L{x},{y+h}" fill="none" stroke="#000" stroke-width="1.5"/>')
        return b

    def comb(s, *a, **k):
        k.setdefault("fill", "#fff3c4")
        return s.block(*a, **k)

    def seq(s, *a, **k):
        k.setdefault("fill", "#d9f2d9")
        k.setdefault("clk", True)
        return s.block(*a, **k)

    def mem(s, *a, **k):
        k.setdefault("fill", "#efdcfa")
        return s.block(*a, **k)

    def io(s, *a, **k):
        k.setdefault("fill", "#ffe0e0")
        return s.block(*a, **k)

    def vid(s, *a, **k):
        k.setdefault("fill", "#d6f5f5")
        return s.block(*a, **k)

    def cpu(s, *a, **k):
        k.setdefault("fill", "#dde8ff")
        return s.block(*a, **k)

    def mux(s, x, y, h, ins=("0", "1"), sel="sel", w=36, selc="ctrl", label=None, selpos=None, top=False):
        """Trapezoid mux. pins: each input name, 'out' (right), 'sel' (bottom)."""
        k = h * 0.14
        s.m.append(f'<path d="M{x},{y} L{x+w},{y+k:.1f} L{x+w},{y+h-k:.1f} L{x},{y+h} Z" fill="#fff" stroke="#000" stroke-width="1.9"/>')
        b = Box(x, y, w, h)
        n = len(ins)
        for i, nm in enumerate(ins):
            yy = y + h * (i + 0.5) / n
            b.p[nm] = (x, yy)
            s.text(x + 5, yy + 4, nm, 10, anchor="start", color="#333")
        b.p["out"] = (x + w, y + h / 2)
        b.p["sel"] = (x + w / 2, (y + k / 2) if top else (y + h - k / 2))
        if sel:
            s.text(x + w / 2, (y - 6) if top else (y + h + 14), sel, 10, color=C[selc], halo=True)
        if label:
            s.text(x + w / 2, y - 7, label, 10, color="#555")
        return b

    def gate(s, kind, x, y, w=34, h=28):
        g = Box(x, y, w, h)
        bub = kind in ("nand", "not", "nor")
        if kind in ("and", "nand"):
            d = f"M{x},{y} H{x+w/2} A{w/2},{h/2} 0 0 1 {x+w/2},{y+h} H{x} Z"
        elif kind == "xor":
            d = f"M{x+6},{y} Q{x+w*0.65},{y} {x+w},{y+h/2} Q{x+w*0.65},{y+h} {x+6},{y+h} Q{x+w*0.3+6},{y+h/2} {x+6},{y} Z"
            s.m.append(f'<path d="M{x},{y} Q{x+w*0.3},{y+h/2} {x},{y+h}" fill="none" stroke="#000" stroke-width="1.8"/>')
        elif kind in ("or", "nor"):
            d = f"M{x},{y} Q{x+w*0.65},{y} {x+w},{y+h/2} Q{x+w*0.65},{y+h} {x},{y+h} Q{x+w*0.3},{y+h/2} {x},{y} Z"
        else:  # not
            d = f"M{x},{y} L{x+w-8},{y+h/2} L{x},{y+h} Z"
        s.m.append(f'<path d="{d}" fill="#fff" stroke="#000" stroke-width="1.9"/>')
        ox = x + w
        if bub:
            cx = ox - 4 if kind == "not" else ox + 4
            s.m.append(f'<circle cx="{cx:.1f}" cy="{y+h/2:.1f}" r="4" fill="#fff" stroke="#000" stroke-width="1.6"/>')
            ox = cx + 4
        if kind == "not":
            g.p["in"] = (x, y + h / 2)
        else:
            g.p["in1"] = (x, y + h * 0.27)
            g.p["in2"] = (x, y + h * 0.73)
        g.p["out"] = (ox, y + h / 2)
        return g

    def op(s, x, y, label, w=74, h=36, ins=("a", "b"), ts=12, showpins=False):
        """Combinational operator bubble (comparator, adder...)."""
        return s.block(x, y, w, h, label, L=ins, R=("y",), ps=9, ts=ts, fill="#fff3c4", rx=18, pad=h * 0.5 - 8 if len(ins) == 1 else h * 0.3 + 4, showpins=showpins)


def HVH(a, b, xm):
    return [a, (xm, a[1]), (xm, b[1]), b]


def VHV(a, b, ym):
    return [a, (a[0], ym), (b[0], ym), b]


def H(a, b):   # horizontal first then vertical
    return [a, (b[0], a[1]), b]


def V(a, b):   # vertical first then horizontal
    return [a, (a[0], b[1]), b]


def pin(fig, b, name, side, off, show=True, size=10):
    """Add a named pin to block b at absolute y offset (L/R) or x offset (T/B) from block origin."""
    if side == "L":
        b.p[name] = (b.x, b.y + off)
        if show:
            fig.text(b.x + 6, b.y + off + 4, name, size, anchor="start", color="#222")
    elif side == "R":
        b.p[name] = (b.x + b.w, b.y + off)
        if show:
            fig.text(b.x + b.w - 6, b.y + off + 4, name, size, anchor="end", color="#222")
    elif side == "T":
        b.p[name] = (b.x + off, b.y)
        if show:
            fig.text(b.x + off, b.y + 15, name, size, color="#222")
    else:
        b.p[name] = (b.x + off, b.y + b.h)
        if show:
            fig.text(b.x + off, b.y + b.h - 7, name, size, color="#222")
    return b.p[name]


def vtext(fig, x, y, t, size=11, color="#333", weight="normal"):
    fig.o.append(f'<text transform="translate({x},{y}) rotate(-90)" font-family="DejaVu Sans" font-size="{size}" '
                 f'font-weight="{weight}" fill="{color}" text-anchor="middle">{t}</text>')


def busline(fig, x, y0, y1, color="data", width=5):
    from lib import C
    fig.u.append(f'<line x1="{x}" y1="{y0}" x2="{x}" y2="{y1}" stroke="{C.get(color, color)}" stroke-width="{width}"/>')
