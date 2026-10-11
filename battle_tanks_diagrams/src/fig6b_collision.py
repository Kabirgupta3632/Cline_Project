from h import *


def mux8(f, x, y, label, sel="scan[2:0]"):
    m = f.mux(x, y, 150, ins=tuple("%d" % i for i in range(8)), sel=sel, w=40, top=False)
    return m


def build():
    f = Fig(2000, 2380, "Fig 6b - Collision Engine: Bullet-Wall Scan, Bullet-Bullet Matrix, Bullet-Tank Cells, Hit-Mask Registers",
            "Fixes: ONE wall-lookup port is time-shared by a 3-bit scan counter (8 clocks per sweep); pair/tank tests use 44 parallel Fig-6a cells; "
            "outputs are per-bullet hit masks (CPU can tell WHICH bullet / tank).")
    # ===================================================================== A
    f.region(20, 90, 1960, 800, "PART A - bullet-wall scan (one maze-RAM lookup per clock, 8 bullets per sweep)", "#8a6d00")
    sc = f.seq(60, 150, 110, 50, "scan[2:0]", ts=12); pin(f, sc, "D", "L", 25, show=False); pin(f, sc, "Q", "R", 25, show=False)
    ad = f.op(60, 230, "scan + 1", w=110, h=36, ins=("a",))
    f.wire([ad["y"], (190, ad["y"][1]), (190, 130), (40, 130), (40, sc["D"][1]), sc["D"]], bus="3", seg=1, ldy=-2)
    tq = (sc["Q"][0] + 30, sc["Q"][1]); f.wire([sc["Q"], tq], arrow=False); f.dot(tq)
    f.wire([tq, (tq[0], 290), (30, 290), (30, ad["a"][1]), ad["a"]])
    SB = 235     # scan rail x
    f.wire([tq, (SB, tq[1])], arrow=False, label="scan_q")
    busline(f, SB, tq[1], 700, "data", 3)
    # four 8:1 muxes
    srcs = [("bN_x[9:0]", 330), ("bN_y[9:0]", 480), ("bN_big", 630), ("bN_act", 780)]
    outs = {}
    for k, (nm, yy) in enumerate(srcs[:2]):
        m = f.mux(330, yy - 70, 140, ins=tuple(str(i) for i in range(8)), sel=None, w=40)
        p = port(f, 120, yy - 70 + 20, nm.replace("N", "0..7"), 10, color="#a35c00")
        f.wire([p["r"], (330, p["r"][1])][:1] + [m["0"]][:0] + [(310, p["r"][1]), (310, m["0"][1]), m["0"]], "reg", bus="8x10")
        f.wire([(SB, m["sel"][1]), m["sel"]][::-1][::-1] if False else [(SB, m["sel"][1] + 0), (m["sel"][0], m["sel"][1] + 0)], arrow=False)
        f.wire([(SB, m["sel"][1]), m["sel"]], "ctrl") if False else None
        outs[nm] = m["out"]; f.dot((SB, m["sel"][1]))
    # remaining muxes (act/big) smaller, placed lower
    for k, (nm, yy) in enumerate(srcs[2:]):
        m = f.mux(330, 500 + k * 130 + 40, 90, ins=("0..7",), sel=None, w=40)
        p = port(f, 120, m["0..7"][1], nm.replace("N", "0..7"), 10, color="#a35c00")
        f.wire([p["r"], m["0..7"]], "reg", bus="8")
        outs[nm] = m["out"]
        f.wire([(SB, m["sel"][1]), m["sel"]], "ctrl"); f.dot((SB, m["sel"][1]))
    return f
