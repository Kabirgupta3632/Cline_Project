from h import *


def build():
    f = Fig(1900, 1330, "Fig 6d - Collision Engine (3/3): Sticky Hit Registers (write-1-to-clear) and CPU Read Path",
            "Hits are latched until the CPU clears them, so a hit lasting less than one software frame is never missed.  Registers 0x20..0x2C, word access.")
    # ------------------------------------------------------------------ A  one bit
    f.region(20, 90, 1860, 380, "PART A - one sticky bit  (instantiate for every bit of WALL_MASK[7:0], BB_MASK[7:0], BTK_MASK[7:0], TANK_MASK[1:0])", "#8a6d00")
    st = port(f, 40, 200, "set_i  (wall_set / bb_hit / btk_hit / tank_set)", 10, color="#2e9d3a")
    og = f.gate("or", 480, 190, 44, 40)
    f.wire([st["r"], (440, 200), (440, og["in1"][1]), og["in1"]], "ctrl")
    ng = f.gate("not", 600, 280, 34, 28)
    ag = f.gate("and", 700, 195, 44, 40)
    ff = f.seq(820, 190, 110, 50, "bit_q", ts=12); pin(f, ff, "D", "L", 25, show=False); pin(f, ff, "Q", "R", 25, show=False)
    f.wire([og["out"], (660, og["out"][1]), (660, ag["in1"][1]), ag["in1"]])
    f.wire([ng["out"], (680, ng["out"][1]), (680, ag["in2"][1]), ag["in2"]])
    f.wire([ag["out"], ff["D"]])
    q = ff["Q"]; tq = (q[0] + 40, q[1]); f.wire([q, tq], arrow=False); f.dot(tq)
    f.wire([tq, (tq[0], 140), (440, 140), (440, og["in2"][1]), og["in2"]], label="hold (sticky)", seg=1, ldy=-2)
    o = port(f, 1040, q[1], "bit_q  (-> read path, Part B)", 10, color="#1f6fe0")
    f.wire([tq, o["l"]], "rd")
    wen = port(f, 40, 280, "wr_en_col  (Fig 2a)", 10, color="#2e9d3a")
    sel = port(f, 40, 330, "d_addr[3:2] == this reg", 10)
    wd = port(f, 40, 380, "d_wdata[bit]", 10)
    a1 = f.gate("and", 340, 295, 36, 40)
    a2 = f.gate("and", 450, 305, 36, 40)
    f.wire([wen["r"], (300, 280), (300, a1["in1"][1]), a1["in1"]], "ctrl")
    f.wire([sel["r"], (320, 330), (320, a1["in2"][1]), a1["in2"]])
    f.wire([a1["out"], (410, a1["out"][1]), (410, a2["in1"][1]), a2["in1"]])
    f.wire([wd["r"], (430, 380), (430, a2["in2"][1]), a2["in2"]])
    f.wire([a2["out"], (560, a2["out"][1]), (560, ng["in"][1]), ng["in"]], label="clr_i", seg=0, ldy=-2)
    f.text(1100, 250, "Priority: clear wins over set when both occur in the same clock\n(ANDing ~clr after the OR) - a persistent hit is simply re-set next clock.\n\nThe CPU clears by writing 1s:   sw  mask, 0x8000_0024 (etc.)\nWriting 0s changes nothing, so a read-modify-write is never needed.", 11, anchor="start", color="#333")
    # ------------------------------------------------------------------ B read path
    f.region(20, 500, 1860, 800, "PART B - packing and MMIO read   (word index = d_addr[3:2];  rd_col goes to Fig 2b)", "#8a6d00")
    regs = [("0x20 COLLISION_FLAG", "{29'b0, tank_hit_any, bb_any, wall_any}", "bit0 = any wall hit    bit1 = any bullet-bullet    bit2 = any bullet-tank"),
            ("0x24 WALL_MASK", "{24'b0, wall_q[7:0]}", "bit i = bullet i touched a wall since last clear"),
            ("0x28 BB_MASK", "{24'b0, bb_q[7:0]}", "bit i = bullet i hit another bullet (both bits set -> cancel pair)"),
            ("0x2C HIT_MASK", "{22'b0, tank_q[1:0], btk_q[7:0]}", "[7:0] which bullet hit a tank    [9:8] which tank was hit (bit8=P1, bit9=P2)")]
    mux = f.mux(1100, 600, 330, ins=("0", "1", "2", "3"), sel="d_addr[3:2]", w=46)
    for i, (nm, expr, note) in enumerate(regs):
        y = 580 + i * 160
        p = f.comb(110, y, 520, 90, nm, ts=12, sub=expr + "\n" + note, showpins=False)
        yy = mux[str(i)][1]
        f.wire([(630, y + 45), (880 + 20 * i, y + 45), (880 + 20 * i, yy), mux[str(i)]], "rd", bus="32", seg=0, lpos=0.5, ldy=-2)
    f.text(60, 560, "0x20 bits come from three 8-input OR reductions of the sticky registers:", 11, anchor="start", weight="bold")
    for k, (src, dst) in enumerate([("wall_q[7:0]", "wall_any"), ("bb_q[7:0]", "bb_any"), ("btk_q[7:0]", "tank_hit_any")]):
        x0 = 130 + k * 200
        p = port(f, x0, 1235, src, 9, color="#a35c00")
        g = f.gate("or", x0 + p["w"] + 30, 1215, 40, 40)
        f.wire([p["r"], g["in1"]][:1] + [(p["r"][0] + 15, 1235), (p["r"][0] + 15, g["in1"][1]), g["in1"]], "reg", bus="8")
        o = port(f, g["out"][0] + 20, 1235, dst, 9, color="#2e9d3a")
        f.wire([g["out"], o["l"]], "ctrl")
    f.text(60, 1280, "wall_any -> bit0,  bb_any -> bit1,  tank_hit_any -> bit2 of COLLISION_FLAG (0x20)", 10, anchor="start", color="#333")
    ro = port(f, 1300, mux["out"][1], "rd_col[31:0]", 11, color="#1f6fe0")
    f.wire([mux["out"], ro["l"]], "rd", bus="32")
    f.text(1430, mux["out"][1] + 4, "-> Fig 2b (gated by cs_col_q)", 11, anchor="start", color="#333")
    f.text(1000, 1000, "How software uses it (per frame):\n1. flags = COLLISION_FLAG;  if (flags == 0) skip everything.\n2. m = HIT_MASK;  bullet index i = lowest set bit of m[7:0];\n   big = BULLET_REG_i.big  ->  damage 5 or 1 to the tank in m[9:8].\n3. bb = BB_MASK; deactivate every set bullet (both sides of a pair cancel).\n4. w = WALL_MASK; reflect those bullets (vx or vy sign flip) in C.\n5. sw all handled bits back to clear them (write-1-to-clear).", 11, anchor="start", color="#333")
    return f
