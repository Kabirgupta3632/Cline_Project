from h import *


def build():
    f = Fig(1750, 1010, "Fig 2a - MMIO Interconnect (1/2): Address Decode and Write Enables",
            "Pure combinational.  addr[31]=1 selects the MMIO window; addr[11:3] picks a peripheral; each write enable = cs & d_we")
    A, M = 250, 300           # rails: address bus, addr[31]
    WE = 640
    s_a = port(f, 30, 100, "d_addr[31:0]")
    s_m = port(f, 30, 140, "d_addr[31]")
    s_w = port(f, 30, 180, "d_we")
    f.wire([s_a["r"], (A, 100)], bus="32", arrow=False)
    busline(f, A, 100, 880, "data", 3)
    f.wire([s_m["r"], (M, 140)], arrow=False)
    busline(f, M, 140, 890, "data", 2)
    f.wire([s_w["r"], (WE, 180)], "ctrl", arrow=False)
    busline(f, WE, 180, 900, "ctrl", 2)
    f.dot((A, 100)); f.dot((M, 140))
    f.note(36, 215, "slices of the core data-bus address / strobes", 10)

    rows = [("cs_in", "addr[11:3] == 9'h000", "P1/P2_INPUT_REG 0x00,0x04 (read-only: no write enable)", False, 280),
            ("cs_tmr", "addr[11:3] == 9'h002", "TIMER_STATUS/TRIGGER 0x10,0x14", True, 390),
            ("cs_col", "addr[11:4] == 8'h02", "COLLISION_FLAG 0x20 (W1C), WALL/BB/HIT_MASK 0x24..0x2C", True, 500)]
    for nm, lab, note, we, y in rows:
        decode_row(f, A, M, WE, y, nm, lab, note, we)
    # sprite: two ranges ORed
    ys = 650
    c1 = f.op(340, ys - 55, "addr[11:6] == 6'h01", w=160, h=40, ins=("a",))
    c2 = f.op(340, ys + 5, "addr[11:3] == 9'h010", w=160, h=40, ins=("a",))
    for c in (c1, c2):
        yy = c["a"][1]
        f.wire([(A, yy), c["a"]], label="addr[11:3]" if c is c2 else "addr[11:6]", ldy=-2)
        f.dot((A, yy))
    og = f.gate("or", 540, ys - 12, 36, 32)
    f.wire([c1["y"], (520, c1["y"][1]), (520, og["in1"][1]), og["in1"]])
    f.wire([c2["y"], (520, c2["y"][1]), (520, og["in2"][1]), og["in2"]])
    f.note(345, ys - 62, "0x40..0x7F : TANK_POS, BULLET_REG_0..7", 10)
    f.note(345, ys + 62, "0x80..0x87 : HEALTH_BAR_REG, TANK_ANGLE_REG", 10)
    ag = f.gate("and", 600, ys - 12, 34, 36)
    f.wire([og["out"], (592, og["out"][1]), (592, ag["in1"][1]), ag["in1"]])
    ty = ys + 80
    f.wire([(M, ty), (584, ty), (584, ag["in2"][1]), ag["in2"]]); f.dot((M, ty))
    finish_row(f, WE, ag, "cs_spr", True)
    # maze
    ym = 780
    cm = f.op(340, ym - 20, "addr[11:8] in 1..7", w=160, h=40, ins=("a",))
    f.wire([(A, cm["a"][1]), cm["a"]], label="addr[11:8]", ldy=-2); f.dot((A, cm["a"][1]))
    f.note(345, ym + 40, "0x100..0x73F : MAZE_RAM (400 words)", 10)
    am = f.gate("and", 600, ym - 14, 34, 36)
    f.wire([cm["y"], (560, cm["y"][1]), (560, am["in1"][1]), am["in1"]])
    ty = ym + 30
    f.wire([(M, ty), (584, ty), (584, am["in2"][1]), am["in2"]]); f.dot((M, ty))
    finish_row(f, WE, am, "cs_maze", True)
    # data memory
    yd = 890
    nt = f.gate("not", 340, yd - 14, 34, 28)
    f.wire([(M, yd), nt["in"]]); f.dot((M, yd))
    f.text(318, yd - 8, "addr[31]", 9, anchor="end", color="#444", halo=True)
    f.note(380, yd + 30, "addr[31] = 0 : data memory (stack, globals, LUT)", 10)
    f.wire([nt["out"], (700, nt["out"][1])], arrow=False)
    pd = port(f, 480, yd - 40, "cs_dmem", color="#2e9d3a")
    f.wire([(500, yd), (500, yd - 29)], "ctrl", arrow=False); f.dot((500, yd), "ctrl")
    g1 = f.gate("and", 700, yd - 14, 34, 36)
    f.wire([(700 - 30, nt["out"][1]), (700 - 30, g1["in1"][1]), g1["in1"]], arrow=True)
    f.wire([(WE, g1["in2"][1]), g1["in2"]], "ctrl"); f.dot((WE, g1["in2"][1]), "ctrl")
    g2 = f.gate("and", 800, yd - 14, 36, 36)
    f.wire([g1["out"], (780, g1["out"][1]), (780, g2["in1"][1]), g2["in1"]])
    ws = port(f, 30, 960, "d_wstrb[3:0]")
    f.wire([ws["r"], (770, 960), (770, g2["in2"][1]), g2["in2"]], "ctrl", bus="4")
    o = port(f, 900, yd, "dmem_we[3:0]", color="#2e9d3a")
    f.wire([g2["out"], o["l"]], "ctrl", bus="4")
    f.text(1010, yd + 4, "-> Data Memory byte-write enables  (bit i = cs_dmem & d_we & d_wstrb[i])", 10, anchor="start", color="#444")
    # to Fig 2b
    f.legend(1280, 100, [("data", "address / data slices"), ("ctrl", "control (cs, we)")], w=260)
    f.text(1290, 300, "Outputs used elsewhere:", 12, anchor="start", weight="bold")
    f.text(1290, 322, "cs_in cs_tmr cs_col cs_spr cs_maze cs_dmem\n -> Fig 2b read-data mux select\nwr_en_tmr / wr_en_col / wr_en_spr / wr_en_maze\n -> peripheral write ports (Figs 4,5,6d,7)\naddr[6:2] and d_wdata go straight to peripherals\n(MMIO is word-access only: wstrb ignored)", 11, anchor="start", color="#333")
    return f


def decode_row(f, A, M, WE, y, nm, lab, note, we):
    c = f.op(340, y - 20, lab, w=170, h=40, ins=("a",))
    yy = c["a"][1]
    f.wire([(A, yy), c["a"]], label=lab.split(" ==")[0].split(" in")[0], ldy=-2); f.dot((A, yy))
    f.note(345, y - 28, note, 10)
    g = f.gate("and", 600, y - 14, 34, 36)
    f.wire([c["y"], (560, c["y"][1]), (560, g["in1"][1]), g["in1"]])
    ty = y + 30
    f.wire([(M, ty), (584, ty), (584, g["in2"][1]), g["in2"]]); f.dot((M, ty))
    finish_row(f, WE, g, nm, we)


def finish_row(f, WE, g, nm, we):
    y = g["out"][1]
    p = port(f, 1000 if False else 880, y - 40 if we else y, nm, color="#2e9d3a")
    if we:
        f.dot((g["out"][0] + 12, y), "data")
        a = f.gate("and", 700, y - 14, 34, 36)
        f.wire([g["out"], a["in1"]][:1] + [(g["out"][0] + 12, y), (g["out"][0] + 12, a["in1"][1]), a["in1"]])
        f.wire([(WE, a["in2"][1]), a["in2"]], "ctrl"); f.dot((WE, a["in2"][1]), "ctrl")
        w = port(f, 880, y + 6, "wr_en_" + nm[3:], color="#2e9d3a")
        f.wire([a["out"], w["l"]], "ctrl")
        f.wire([(g["out"][0] + 12, y), (g["out"][0] + 12, y - 40), p["l"]], "ctrl", seg=1)
    else:
        f.wire([g["out"], p["l"]], "ctrl")
