"""Minimal SVG block-diagram toolkit: blocks with named pins, muxes, gates, orthogonal wires."""
import html

FONT = "DejaVu Sans"
C = dict(data="#111111", ctrl="#2e9d3a", fwd="#d62828", rd="#1f6fe0", reg="#f08c00",
         mem="#9b3fd6", clk="#777777", vid="#009a9a", irq="#c2185b")


def esc(t):
    return html.escape(str(t), quote=False)


class Box:
    def __init__(s, x, y, w, h):
        s.x, s.y, s.w, s.h = x, y, w, h
        s.p = {}

    def __getitem__(s, k):
        return s.p[k]


class Fig:
    def __init__(s, w, h, title, sub=None):
        s.w, s.h = w, h
        s.u, s.m, s.o = [], [], []     # under (regions, wires), mid (blocks), over (text, dots)
        s.marks = set()
        s.text(w / 2, 36, title, 26, weight="bold")
        if sub:
            s.text(w / 2, 60, sub, 14, color="#444")

    def text(s, x, y, t, size=12, anchor="middle", weight="normal", color="#000", halo=False,
             italic=False, layer=None):
        out = []
        for i, ln in enumerate(str(t).split("\n")):
            st = (f'font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{color}" '
                  f'text-anchor="{anchor}"')
            if italic:
                st += ' font-style="italic"'
            if halo:
                st += ' stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round"'
            out.append(f'<text x="{x:.1f}" y="{y + i * (size + 3):.1f}" {st}>{esc(ln)}</text>')
        (layer if layer is not None else s.o).append("\n".join(out))

    def rect(s, x, y, w, h, fill="#fff", stroke="#000", sw=1.8, rx=0, dash=None, layer=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        (layer if layer is not None else s.m).append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def region(s, x, y, w, h, title, color="#8a8a8a", fill="none"):
        s.rect(x, y, w, h, fill=fill, stroke=color, sw=2, rx=10, dash="10 6", layer=s.u)
        s.text(x + 12, y + 20, title, 15, anchor="start", weight="bold", color=color, layer=s.u)

    def note(s, x, y, t, size=11, anchor="start", color="#333", weight="normal"):
        s.text(x, y, t, size, anchor=anchor, color=color, italic=True, weight=weight)

    def dot(s, p, color="data", r=3.8):
        s.o.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{r}" fill="{C.get(color, color)}"/>')

    def _mk(s, c):
        s.marks.add(c)
        return "a" + c[1:]

    def wire(s, pts, color="data", label=None, bus=None, lpos=0.5, arrow=True, width=1.8, dash=None,
             lsize=10, seg=None, ldy=0, ldx=0, both=False):
        """Orthogonal wire through pts. label text; bus = width string (draws a slash)."""
        c = C.get(color, color)
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        mk = f' marker-end="url(#{s._mk(c)})"' if arrow else ""
        if both:
            s.marks.add(c + "s")
            mk += f' marker-start="url(#a{c[1:]}s)"'
        da = f' stroke-dasharray="{dash}"' if dash else ""
        s.u.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{width}" stroke-linejoin="round"{mk}{da}/>')
        if label or bus:
            segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
            a, b = segs[seg] if seg is not None else max(
                segs, key=lambda q: abs(q[1][0] - q[0][0]) + abs(q[1][1] - q[0][1]))
            mx, my = a[0] + (b[0] - a[0]) * lpos, a[1] + (b[1] - a[1]) * lpos
            horiz = abs(b[0] - a[0]) >= abs(b[1] - a[1])
            if bus:
                if horiz:
                    s.o.append(f'<line x1="{mx-4:.1f}" y1="{my+6:.1f}" x2="{mx+4:.1f}" y2="{my-6:.1f}" stroke="{c}" stroke-width="1.8"/>')
                else:
                    s.o.append(f'<line x1="{mx-6:.1f}" y1="{my+4:.1f}" x2="{mx+6:.1f}" y2="{my-4:.1f}" stroke="{c}" stroke-width="1.8"/>')
            t = ((label or "") + (f" [{bus}]" if bus and bus is not True else "")).strip()
            tc = c if c != "#111111" else "#222"
            if t:
                if horiz:
                    s.text(mx + ldx, my - 9 + ldy, t, lsize, color=tc, halo=True)
                else:
                    s.text(mx + 9 + ldx, my + 4 + ldy, t, lsize, anchor="start", color=tc, halo=True)

    def svg(s):
        defs = []
        for c in sorted(s.marks):
            if c.endswith("s") and len(c) == 8:
                col = c[:-1]
                defs.append(f'<marker id="a{col[1:]}s" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="{col}"/></marker>')
            else:
                defs.append(f'<marker id="a{c[1:]}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{s.w}" height="{s.h}" viewBox="0 0 {s.w} {s.h}">'
                f'<defs>{"".join(defs)}</defs><rect width="100%" height="100%" fill="#fff"/>\n'
                + "\n".join(s.u + s.m + s.o) + "\n</svg>")

    def save(s, path):
        open(path, "w").write(s.svg())

    def legend(s, x, y, items, w=300):
        s.rect(x, y, w, 26 + 19 * len(items), fill="#fff", stroke="#999", sw=1, rx=6, layer=s.u)
        s.text(x + 10, y + 17, "Legend", 12, anchor="start", weight="bold")
        for i, (c, t) in enumerate(items):
            yy = y + 40 + 19 * i
            if c:
                s.o.append(f'<line x1="{x+10}" y1="{yy-4}" x2="{x+44}" y2="{yy-4}" stroke="{C.get(c, c)}" stroke-width="3"/>')
            s.text(x + 52, yy, t, 11, anchor="start")

#__BLOCKS__
