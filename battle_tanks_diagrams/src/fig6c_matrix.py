from h import *


def orgate(f, x, y, names, out, h=None, color="#2e9d3a"):
    n = len(names)
    h = h or max(40, 18 * n + 8)
    g = f.gate("or", x, y, 46, h)
    for i, nm in enumerate(names):
        yy = y + 6 + (h - 12) * (i + 0.5) / n
        f.text(x - 8, yy + 3, nm, 9, anchor="end", color="#333")
        f.wire([(x - 4, yy), (x + 6, yy)], arrow=False, width=1.2)
    o = port(f, x + 80, y + h / 2, out, 10, color=color)
    f.wire([g["out"], o["l"]], "ctrl")
    return o


def build():
    f = Fig(2200, 1420, "Fig 6c - Collision Engine (2/3): Bullet-Bullet Pair Matrix (28 cells) and Bullet-Tank Cells (16 cells)",
            "Every cell is the Fig-6a overlap cell.  All 44 evaluate in parallel every clock; named nets (pIJ, tkT_I) feed the OR gates on the right.")
    f.region(20, 90, 1130, 700, "PART A - bullet <-> bullet:  cell (i,j) = overlap( b_i , b_j ),  i < j   ->  net pIJ", "#8a6d00")
    f.text(40, 130, "cell inputs: A = {b_i_x, b_i_y, size_i, b_i_act}   B = {b_j_x, b_j_y, size_j, b_j_act}   (size = 12 if bN_big else 6)", 11, anchor="start", color="#333")
    for j in range(1, 8):
        f.text(80 + (j - 1) * 105 + 45, 168, "b%d" % j, 11, weight="bold", color="#8a6d00")
    for i in range(7):
        f.text(48, 208 + i * 55, "b%d" % i, 11, weight="bold", color="#8a6d00")
        for j in range(i + 1, 8):
            x = 80 + (j - 1) * 105
            y = 180 + i * 55
            f.block(x, y, 90, 40, "ovl  p%d%d" % (i, j), fill="#fff3c4", ts=12, rx=14, showpins=False)
    f.region(1170, 90, 1010, 700, "bb_hit[k] = OR of every pair containing bullet k   (pair (i,j) feeds both i and j)", "#8a6d00")
    for k in range(8):
        names = ["p%d%d" % (min(k, m), max(k, m)) for m in range(8) if m != k]
        x = 1260 + (k % 4) * 230
        y = 140 + (k // 4) * 320
        orgate(f, x + 40, y, names, "bb_hit[%d]" % k)
    f.text(1200, 780, "outputs: bb_hit[7:0]  (bit k = bullet k overlaps ANOTHER live bullet)  ->  Fig 6d sticky BB_MASK", 11, anchor="start", color="#2e9d3a", weight="bold")
    f.region(20, 820, 1130, 580, "PART B - bullet <-> tank:  cell (T,i) = overlap( tank_T , b_i )  ->  net tkT_i     (tank box 20x20, always alive)", "#8a6d00")
    for t in range(2):
        f.text(48, 880 + t * 120, "tank %d" % (t + 1), 11, anchor="start", weight="bold", color="#8a6d00")
        for i in range(8):
            x = 120 + i * 128
            y = 860 + t * 120
            f.block(x, y, 112, 40, "ovl  tk%d_%d" % (t + 1, i), fill="#fff3c4", ts=11, rx=14, showpins=False)
            f.text(x + 56, y + 58, "b%d" % i, 10, color="#555")
    f.text(40, 1120, "Tank operand = {P1/P2_TANK_POS x,y (Fig 5), w=h=20, act=1}.   Bullet operand = b_i.", 11, anchor="start", color="#333")
    f.text(40, 1150, "No owner bit: a bullet that bounces back may hit its own tank (classic tank rules).\nSoftware spawns new bullets 24 px in front of the muzzle, so they do not overlap the shooter on frame 0.", 11, anchor="start", color="#333")
    f.region(1170, 820, 1010, 580, "tank-hit reduction", "#8a6d00")
    for t in range(2):
        names = ["tk%d_%d" % (t + 1, i) for i in range(8)]
        orgate(f, 1290 + t * 380, 870, names, "tank%d_hit" % (t + 1))
    f.text(1200, 1060, "tank_set[t] = tankT_hit   (tank T struck this clock)", 11, anchor="start", color="#2e9d3a", weight="bold")
    f.text(1200, 1100, "Which bullet landed (so software can read its big flag: 5 dmg vs 1, and deactivate it):", 11, anchor="start", color="#333")
    for k in range(8):
        x = 1230 + (k % 4) * 240
        y = 1130 + (k // 4) * 80
        a = f.gate("or", x, y, 40, 36)
        f.text(x - 6, y + 10, "tk1_%d" % k, 9, anchor="end")
        f.text(x - 6, y + 29, "tk2_%d" % k, 9, anchor="end")
        o = port(f, x + 60, y + 18, "btk_hit[%d]" % k, 9, color="#2e9d3a")
        f.wire([a["out"], o["l"]], "ctrl")
    f.text(40, 1340, "outputs: tank_set[1:0] and btk_hit[7:0] -> Fig 6d sticky registers.", 11, anchor="start", color="#2e9d3a", weight="bold")
    return f
