"""Layout lint for generated SVGs: text-text overlap, wire-through-text, text outside canvas."""
import re, sys, html


def parse(path):
    s = open(path).read()
    W = float(re.search(r'width="([\d.]+)"', s).group(1)); H = float(re.search(r'height="([\d.]+)"', s).group(1))
    texts = []
    for m in re.finditer(r'<text x="([\d.\-]+)" y="([\d.\-]+)" ([^>]*)>(.*?)</text>', s):
        x, y, attrs, t = float(m[1]), float(m[2]), m[3], html.unescape(m[4])
        size = float(re.search(r'font-size="([\d.]+)"', attrs)[1])
        anc = re.search(r'text-anchor="(\w+)"', attrs)[1]
        w = len(t) * size * 0.60
        x0 = x - w / 2 if anc == 'middle' else (x if anc == 'start' else x - w)
        texts.append((x0, y - size * 0.8, x0 + w, y + size * 0.2, t, size))
    segs = []
    for m in re.finditer(r'<path d="(M[^"]*)" fill="none" stroke="(#[0-9a-f]+)" stroke-width="([\d.]+)"', s):
        pts = [tuple(map(float, p.split(','))) for p in re.findall(r'[\d.\-]+,[\d.\-]+', m[1])]
        if float(m[3]) < 1: continue
        for a, b in zip(pts, pts[1:]):
            segs.append((a, b))
    return W, H, texts, segs


def inter(a, b):
    return min(a[2], b[2]) - max(a[0], b[0]) > 2 and min(a[3], b[3]) - max(a[1], b[1]) > 2


def lint(path):
    W, H, T, S = parse(path)
    bad = []
    for i, a in enumerate(T):
        if a[0] < 0 or a[2] > W or a[1] < 0 or a[3] > H:
            bad.append(('outside', a[4]))
        for b in T[i + 1:]:
            if inter(a, b):
                bad.append(('text-overlap', a[4], b[4]))
    for a in T:
        if a[5] < 9.5: pass
        for (p, q) in S:
            x0, x1 = sorted((p[0], q[0])); y0, y1 = sorted((p[1], q[1]))
            if x0 == x1 and a[0] + 1 < x0 < a[2] - 1 and y0 < a[3] - 2 and y1 > a[1] + 2:
                bad.append(('wire-thru-text', a[4], (p, q)))
            if y0 == y1 and a[1] + 1 < y0 < a[3] - 1 and x0 < a[2] - 2 and x1 > a[0] + 2:
                bad.append(('wire-thru-text', a[4], (p, q)))
    return bad


if __name__ == '__main__':
    for p in sys.argv[1:]:
        b = lint(p)
        print(p, len(b), 'issues')
        seen = set()
        for x in b[:int(__import__('os').environ.get('N', '25'))]:
            print('  ', x)


def path_bbox(d):
    toks = re.findall(r'[MLHVQAZ]|-?[\d.]+', d)
    xs, ys = [], []
    cx = cy = 0.0
    i = 0
    cmd = None
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd == 'Z': continue
        if cmd in 'ML':
            cx, cy = float(toks[i]), float(toks[i + 1]); i += 2
        elif cmd == 'H':
            cx = float(toks[i]); i += 1
        elif cmd == 'V':
            cy = float(toks[i]); i += 1
        elif cmd == 'Q':
            xs.append(float(toks[i])); ys.append(float(toks[i + 1]))
            cx, cy = float(toks[i + 2]), float(toks[i + 3]); i += 4
        elif cmd == 'A':
            cx, cy = float(toks[i + 5]), float(toks[i + 6]); i += 7
        else:
            i += 1
        xs.append(cx); ys.append(cy)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def shapes(path):
    s = open(path).read()
    boxes = []
    for m in re.finditer(r'<rect x="([\d.\-]+)" y="([\d.\-]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="(#[0-9a-fA-F]+)"', s):
        x, y, w, h = map(float, m.groups()[:4])
        boxes.append((x, y, x + w, y + h))
    for m in re.finditer(r'<path d="(M[^"]*)" fill="#[0-9a-fA-F]+"', s):
        bb = path_bbox(m[1])
        if bb: boxes.append(bb)
    return boxes


def arrows(path):
    s = open(path).read()
    out = []
    for m in re.finditer(r'<path d="(M[^"]*)" fill="none" stroke="(#[0-9a-f]+)" stroke-width="([\d.]+)"[^>]*marker-end', s):
        pts = [tuple(map(float, p.split(','))) for p in re.findall(r'[\d.\-]+,[\d.\-]+', m[1])]
        out.append(pts)
    return out


def dangling(path):
    B = shapes(path)
    bad = []
    for pts in arrows(path):
        e = pts[-1]
        ok = any(b[0] - 4 <= e[0] <= b[2] + 4 and b[1] - 4 <= e[1] <= b[3] + 4 for b in B)
        if not ok:
            bad.append(('arrow-ends-in-space', e))
    return bad


if __name__ == '__main__':
    for p in sys.argv[1:]:
        d = dangling(p)
        print(p, len(d), 'dangling arrows', d[:8])
