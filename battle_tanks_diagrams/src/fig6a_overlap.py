from h import *


def build():
    f = Fig(1950, 900, "Fig 6a - Collision Engine: Axis-Aligned Bounding-Box (AABB) Overlap Cell",
            "The one combinational cell replicated 28x (bullet-bullet) and 16x (bullet-tank).   A and B overlap  <=>  they overlap on X  AND  on Y  AND  both are alive.")
    f.region(20, 90, 1910, 780, "overlap(A, B)   - all positions are top-left pixel coordinates, sizes in pixels", "#8a6d00")
    ox = axis_test(f, 50, 150, "A.x[9:0]", "A.w[4:0]", "B.x[9:0]", "B.w[4:0]", "X-axis test")
    oy = axis_test(f, 50, 430, "A.y[9:0]", "A.h[4:0]", "B.y[9:0]", "B.h[4:0]", "Y-axis test")
    a1 = f.gate("and", 800, 330, 40, 40)
    f.wire([ox, (770, ox[1]), (770, a1["in1"][1]), a1["in1"]], label="x_ovl", seg=0, ldy=-2)
    f.wire([oy, (770, oy[1]), (770, a1["in2"][1]), a1["in2"]], label="y_ovl", seg=0, ldy=-2)
    a2 = f.gate("and", 940, 340, 40, 40)
    f.wire([a1["out"], (900, a1["out"][1]), (900, a2["in1"][1]), a2["in1"]])
    pa = port(f, 800, 560, "A.act", 10, color="#a00")
    pb = port(f, 800, 610, "B.act", 10, color="#a00")
    a3 = f.gate("and", 880, 580, 36, 36)
    f.wire([pa["r"], (860, 560), (860, a3["in1"][1]), a3["in1"]])
    f.wire([pb["r"], (870, 610), (870, a3["in2"][1]), a3["in2"]])
    f.wire([a3["out"], (950, a3["out"][1]), (950, 400), (920, 400), (920, a2["in2"][1]), a2["in2"]][:2] + [(950, a2["in2"][1] + 0), a2["in2"]])
    o = port(f, 1080, a2["out"][1], "overlap", 12, color="#2e9d3a")
    f.wire([a2["out"], o["l"]], "ctrl")
    # size mux section
    f.region(1200, 130, 700, 400, "Bullet size select (fed to w/h of a bullet operand)", "#8a6d00")
    sm = f.mux(1500, 260, 100, ins=("0", "1"), sel="b_big", w=40, top=True)
    s6 = port(f, 1300, sm["0"][1], "5'd6   (normal 6x6)", 10)
    s12 = port(f, 1300, sm["1"][1], "5'd12  (big 12x12)", 10)
    f.wire([s6["r"], sm["0"]]); f.wire([s12["r"], sm["1"]])
    bg = port(f, 1450, 190, "bN_big  (Fig 5)", 10, color="#a35c00")
    f.wire([(1520, 201), sm["sel"]], "reg")
    so = port(f, 1700, sm["out"][1], "bN_w = bN_h", 11)
    f.wire([sm["out"], so["l"]], bus="5")
    f.text(1230, 400, "Tank operand: x,y from P1/P2_TANK_POS, w = h = 20 (constant), act = 1.\nBullet operand: x,y,act,big from BULLET_REG_n; w = h from the mux above.\n\nSmall adders: A.x + A.w is only a 10-bit + 5-bit add,\nso the whole cell is 4 small adders + 4 comparators + 5 AND gates (~60 LUTs).\nAll 44 cells evaluate in parallel in one clock.", 11, anchor="start", color="#333")
    return f
