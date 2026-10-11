from h import *


def build():
    f = Fig(1900, 1180, "Fig 10 - Pixel Priority Mixer, Sync Delay Line and VGA Output Registers",
            "Priority  HUD > Big bullet > Bullet > Tank > Wall > Background  (one mux per level, highest priority last = closest to the output).  "
            "All inputs are aligned to the same pixel (each source has 1-2 clk latency).")
    f.region(20, 90, 1860, 640, "PART A - priority mux chain  (each stage: if valid_k then colour_k else previous result)", "#008a8a")
    bg = port(f, 40, 230, "BG_COLOR  12'h000", 10)
    mz = port(f, 40, 330, "maze_rgb[11:0]  (Fig 11)", 10, color="#008a8a")
    mzv = port(f, 40, 380, "maze_wall  (Fig 11)", 10, color="#008a8a")
    tk = port(f, 40, 480, "tank_rgb[11:0]  (Fig 9)", 10, color="#008a8a")
    tkv = port(f, 40, 530, "tank_valid  (Fig 9)", 10, color="#008a8a")
    # stage 1: wall over background
    m1 = f.mux(380, 215, 90, ins=("0", "1"), sel=None, w=40)
    f.wire([bg["r"], (330, 230), (330, m1["0"][1]), m1["0"]], bus="12") if False else f.wire([bg["r"], (330, 230), (330, m1["0"][1]), m1["0"]])
    f.wire([mz["r"], (350, 330), (350, m1["1"][1]), m1["1"]], "vid", bus="12")
    f.wire([mzv["r"], (400, 380), (400, 215 + 90 - 6.3)], "vid")
    # stage 2: tank
    m2 = f.mux(560, 215, 90, ins=("0", "1"), sel=None, w=40)
    f.wire([m1["out"], m2["0"]], bus="12", label="after wall", ldy=-2)
    f.wire([tk["r"], (520, 480), (520, m2["1"][1]), m2["1"]], "vid", bus="12")
    f.wire([tkv["r"], (580, 530), (580, 215 + 90 - 6.3)], "vid")
    # stage 3: normal bullet
    m3 = f.mux(760, 215, 90, ins=("0", "1"), sel=None, w=40)
    f.wire([m2["out"], m3["0"]], bus="12", label="after tank", ldy=-2)
    c3 = port(f, 640, m3["1"][1], "12'hFF0 yellow", 9, w=88)
    f.wire([c3["r"], m3["1"]])
    b1 = port(f, 640, 430, "bullet_valid  (Fig 9)", 10, color="#008a8a")
    f.wire([b1["r"], (780, 430), (780, 215 + 90 - 6.3)], "vid")
    # stage 4: big bullet
    m4 = f.mux(960, 215, 90, ins=("0", "1"), sel=None, w=40)
    f.wire([m3["out"], m4["0"]], bus="12", label="after bullet", ldy=-2)
    c4 = port(f, 840, m4["1"][1], "12'hF00 red", 9, w=78)
    f.wire([c4["r"], m4["1"]])
    b2 = port(f, 840, 480, "big_valid  (Fig 9)", 10, color="#008a8a")
    f.wire([b2["r"], (980, 480), (980, 215 + 90 - 6.3)], "vid")
    # stage 5: HUD
    m5 = f.mux(1160, 215, 90, ins=("0", "1"), sel=None, w=40)
    f.wire([m4["out"], m5["0"]], bus="12", label="after big", ldy=-2)
    hr = port(f, 996, 350, "hud_rgb[11:0]  (Fig 12)", 9, color="#008a8a")
    f.wire([hr["r"], (1130, 350), (1130, m5["1"][1]), m5["1"]], "vid", bus="12", seg=0, lpos=0.5)
    hv = port(f, 1040, 530, "hud_valid  (Fig 12)", 10, color="#008a8a")
    f.wire([hv["r"], (1180, 530), (1180, 215 + 90 - 6.3)], "vid")
    # active gating
    ac = port(f, 1180, 400, "active_d", 10, color="#008a8a")
    mA = f.mux(1380, 215, 90, ins=("0", "1"), sel=None, w=40)
    f.wire([m5["out"], mA["1"]], bus="12", label="pixel", ldy=-2)
    bk = port(f, 1290, mA["0"][1], "12'h000 blank", 9, w=84)
    f.wire([bk["r"], mA["0"]])
    f.wire([(ac["r"][0], 400), (1400, 400), (1400, 215 + 90 - 6.3)], "vid")
    ff = f.seq(1500, 245, 130, 50, "vga_rgb_q[11:0]", ts=11); pin(f, ff, "D", "L", 25, show=False); pin(f, ff, "Q", "R", 25, show=False)
    f.wire([mA["out"], ff["D"]], bus="12")
    o = port(f, 1700, ff["Q"][1], "vga_r/g/b[3:0]", 10, color="#008a8a")
    f.wire([ff["Q"], o["l"]], "vid", bus="12")
    f.text(1480, 360, "blank outside 640x480: output 0\n(monitor needs black during sync/porches)", 10, anchor="start", color="#555")
    f.text(60, 640, "Because later muxes override earlier ones, the final priority is HUD > Big bullet > Bullet > Tank > Wall > Background,\nexactly the order required by the project spec.  Wall colour comes from the maze renderer (Fig 11); floor = BG_COLOR.", 11, anchor="start", color="#333")
    # ------------------------------------------------ sync delay
    f.region(20, 760, 1860, 380, "PART B - sync / blank delay line  (match the mixer's pipeline depth so sync stays aligned with colour)", "#008a8a")
    hs = port(f, 40, 850, "hsync_q  (Fig 8)", 10, color="#008a8a")
    vs = port(f, 40, 930, "vsync_q  (Fig 8)", 10, color="#008a8a")
    ac2 = port(f, 40, 1010, "active_q  (Fig 8)", 10, color="#008a8a")
    outs = [(hs, "hsync_n"), (vs, "vsync_n"), (ac2, "active_d")]
    for (src, nm) in outs:
        y = src["r"][1]
        x = 260
        inv = None
        for i in range(3):
            b = f.seq(x + i * 150, y - 22, 110, 44, "FF", ts=11); pin(f, b, "D", "L", 22, show=False); pin(f, b, "Q", "R", 22, show=False)
            f.wire([(src["r"][0] if i == 0 else x + (i - 1) * 150 + 110, y), b["D"]])
        if nm != "active_d":
            n = f.gate("not", x + 3 * 150 - 10, y - 14, 34, 28)
            f.wire([(x + 2 * 150 + 110, y), n["in"]])
            o = port(f, x + 3 * 150 + 70, y, nm + "  -> VGA connector", 10, color="#008a8a")
            f.wire([n["out"], o["l"]], "vid")
        else:
            o = port(f, x + 3 * 150 - 10, y, nm + "  (to Part A)", 10, color="#008a8a")
            f.wire([(x + 2 * 150 + 110, y), o["l"]], "vid")
    f.text(900, 1100, "3 FFs = sprite ROM (1) + wall tile fetch (1) + output register (1).  Sync pulses are active-low: NOT gates make hsync_n / vsync_n.", 10, anchor="start", color="#444")
    return f
