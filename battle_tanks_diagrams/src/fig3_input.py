from h import *


def build():
    f = Fig(1650, 1250, "Fig 3 - Input Controller: 2-FF Synchroniser + Debouncer (x12) and MMIO Input Registers",
            "Part A: one button channel (replicated 12x).  Part B: stable bits packed into P1_INPUT_REG / P2_INPUT_REG and read through a 2:1 mux.  "
            "All FFs: sync reset to 0 on rst_n.")
    f.region(20, 90, 1610, 650, "PART A - one button channel   btn_i  ->  stable_q   (instantiate 12x: p1_btn[5:0], p2_btn[5:0])", "#b35900")
    b = port(f, 40, 188, "btn_i (async)", color="#a00")
    s1 = f.seq(190, 163, 80, 50, "sync1", ts=12); pin(f, s1, "D", "L", 25, show=False); pin(f, s1, "Q", "R", 25, show=False)
    s2 = f.seq(320, 163, 80, 50, "sync2", ts=12); pin(f, s2, "D", "L", 25, show=False); pin(f, s2, "Q", "R", 25, show=False)
    f.wire([b["r"], s1["D"]])
    f.wire([s1["Q"], s2["D"]])
    f.note(190, 150, "2-FF synchroniser (metastability)", 10)
    N = (430, 188)
    f.wire([s2["Q"], N], arrow=False, label="sync2_q", ldy=-2)
    f.dot(N)
    # xor
    xr = f.gate("xor", 500, 230, 44, 34)
    f.wire([N, (430, xr["in1"][1]), xr["in1"]])
    t = port(f, 300, xr["in2"][1], "stable_q", 10)
    f.wire([t["r"], xr["in2"]])
    f.text(520, 285, "diff = sync2_q ^ stable_q", 10, color="#333")
    # counter
    cm = f.mux(760, 300, 90, ins=("0", "1"), sel="diff", w=36)
    z = port(f, 640, cm["0"][1], "20'd0", 9, w=44)
    f.wire([z["r"], cm["0"]])
    ad = f.op(600, 400, "cnt + 1", w=100, h=36, ins=("a",))
    cf = f.seq(850, 320, 100, 50, "cnt[19:0]", ts=12); pin(f, cf, "D", "L", 25, show=False); pin(f, cf, "Q", "R", 25, show=False)
    f.wire([cm["out"], cf["D"]], bus="20")
    f.wire([xr["out"], (560, xr["out"][1]), (560, 470), (778, 470), (778, 300 + 90 - 6.3)], "ctrl")
    f.wire([ad["y"], (730, ad["y"][1]), (730, cm["1"][1]), cm["1"]], bus="20")
    f.dot((960, 345))
    f.wire([cf["Q"], (960, 345)], arrow=False)
    f.wire([(960, 345), (960, 290), (570, 290), (570, ad["a"][1]), ad["a"]], label="cnt_q", seg=1, ldy=-1)
    # comparator
    cp = f.op(1000, 420, "cnt_q == DEBOUNCE_MAX", w=230, h=40, ins=("a",), ts=11)
    f.wire([(960, 345), (960, cp["a"][1]), cp["a"]])
    f.note(1000, 410, "DEBOUNCE_MAX = 10 ms x f_clk  (500_000 @ 50 MHz)", 10)
    # stable hold mux
    sm = f.mux(1330, 500, 90, ins=("0", "1"), sel="done", w=36, top=True)
    f.wire([cp["y"], (1348, cp["y"][1]), (1348, sm["sel"][1])], "ctrl", label="done", seg=0, ldy=-1)
    t2 = port(f, 1180, sm["1"][1], "sync2_q", 10)
    f.wire([t2["r"], sm["1"]])
    sf = f.seq(1410, 520, 100, 50, "stable", ts=12); pin(f, sf, "D", "L", 25, show=False); pin(f, sf, "Q", "R", 25, show=False)
    f.wire([sm["out"], sf["D"]])
    f.wire([sf["Q"], (1560, sf["Q"][1])], arrow=False)
    f.dot((1540, sf["Q"][1]))
    o = port(f, 1560, sf["Q"][1], "stable_q", 10, color="#a35c00")
    f.wire([(1540, sf["Q"][1]), (1540, 640), (1300, 640), (1300, sm["0"][1] - 0), (1330, sm["0"][1])], label="stable_q (hold)", seg=1, ldy=22)
    f.note(1180, 680, "stable_q changes only after the raw input has been\ncontinuously different for DEBOUNCE_MAX clocks", 10)
    f.note(600, 515, "cnt counts only while diff=1;\nany glitch (diff=0) clears it to 0", 10)

    # ---------------- Part B
    f.region(20, 770, 1610, 460, "PART B - register packing and MMIO read   (stable_q of all 12 channels  ->  rd_in)", "#b35900")
    names = ["FWD", "BWD", "LEFT", "RIGHT", "SHOOT", "SPEC"]
    for k, (pl, y0) in enumerate([("p1", 830), ("p2", 1010)]):
        ys = [y0 + i * 26 for i in range(6)]
        blk = f.comb(300, y0 - 20, 330, 170, "{26'b0, %s_spec ... %s_fwd}" % (pl, pl), L=tuple(names), ts=12,
                     sub="bit0=FWD bit1=BWD bit2=LEFT\nbit3=RIGHT bit4=SHOOT bit5=SPECIAL", pad=60)
        # re-place pins at ys
        for i, n in enumerate(names):
            tp = port(f, 40, blk[n][1], "%s_%s_stable" % (pl, n.lower()), 10)
            f.wire([tp["r"], blk[n]], bus=None)
        blk.p["out"] = (630, y0 + 65)
        f.PL = getattr(f, "PL", {})
        f.PL[pl] = blk["out"]
    f.rect(20, 1180, 0, 0, layer=f.u)
    mx = f.mux(820, 1030, 100, ins=("0", "1"), sel="d_addr[2]", w=40)
    f.wire([f.PL["p1"], (730, f.PL["p1"][1]), (730, mx["0"][1]), mx["0"]], bus="32", label="P1_INPUT_REG  0x8000_0000", seg=0, lpos=0.5, ldy=-1)
    f.wire([f.PL["p2"], (760, f.PL["p2"][1]), (760, mx["1"][1]), mx["1"]], bus="32", label="P2_INPUT_REG  0x8000_0004", seg=0, lpos=0.5, ldy=-1)
    ro = port(f, 960, mx["out"][1], "rd_in[31:0]", color="#1f6fe0")
    f.wire([mx["out"], ro["l"]], "rd", bus="32")
    f.text(1090, mx["out"][1] + 4, "-> Fig 2b AND-OR read mux (gated by cs_in_q)", 11, anchor="start", color="#333")
    f.text(1000, 860, "Read-only: the CPU never writes these.\nWord loads only (lw). Bits [31:6] read 0.\nPolling cost = 1 lw per player per frame.\n\nOne register read returns the *debounced*\nlevel; edge detection (e.g. 'shoot just\npressed') is done in C by comparing with the\nprevious frame's value.", 11, anchor="start", color="#333")
    return f
