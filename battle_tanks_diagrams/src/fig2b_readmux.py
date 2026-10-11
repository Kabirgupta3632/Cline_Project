from h import *


def build():
    f = Fig(1500, 880, "Fig 2b - MMIO Interconnect (2/2): Read-Data Path (registered select, AND-OR mux)",
            "No shared / tri-state bus: every peripheral drives its own rdata; one-hot registered chip-selects gate them into d_rdata.")
    names = [("cs_in", "rd_in[31:0]", "Input Ctrl (Fig 3)"), ("cs_tmr", "rd_tmr[31:0]", "Timers (Fig 4)"),
             ("cs_col", "rd_col[31:0]", "Collision (Fig 6)"), ("cs_maze", "rd_maze[31:0]", "Maze RAM CPU port (Fig 7)"),
             ("cs_dmem", "rd_dmem[31:0]", "Data Memory BRAM")]
    ors = f.comb(1000, 160, 130, 560, "OR\n(32-bit, 5-in)", L=("i0", "i1", "i2", "i3", "i4"), sub="unselected\nsources = 0", pad=120, showpins=False)
    # reposition: pins at known y
    for i, (cs, rd, src) in enumerate(names):
        y0 = 170 + i * 130
        c = port(f, 30, y0, cs, color="#2e9d3a")
        b = f.seq(250, y0 - 24, 90, 48, "FF", sub="", ts=12)
        pin(f, b, "D", "L", 24, show=True, size=9)
        pin(f, b, "Q", "R", 24, show=True, size=9)
        f.wire([c["r"], b["D"]], "ctrl")
        a = f.gate("and", 520, y0 - 6, 40, 44)
        f.wire([b["Q"], (440, y0), (440, a["in1"][1]), a["in1"]], "ctrl", label=cs + "_q", seg=0, ldy=-1)
        r = port(f, 30, y0 + 40, rd)
        f.wire([r["r"], (480, y0 + 40), (480, a["in2"][1]), a["in2"]], "rd", bus="32", seg=0, lpos=0.6)
        f.note(36, y0 + 68, "from " + src, 10)
        f.text(520 + 20, y0 - 14, "& {32{sel}}", 10, color="#333")
        yy = ors["x"] if False else None
        o = (1000, 220 + i * 90)
        f.wire([a["out"], (800 + i * 20, a["out"][1]), (800 + i * 20, o[1]), o], bus="32")
        f.text(o[0] + 6, o[1] + 4, "in%d" % i, 10, anchor="start", color="#222")
    ord_ = port(f, 1200, 440, "d_rdata[31:0]", color="#1f6fe0")
    f.wire([(1130, 440), ord_["l"]], "rd", bus="32")
    f.text(1330, 440, "-> RV32IM core WB / LSU\n   (load align + sign-ext)", 11, anchor="start", color="#333")
    f.text(1000, 760, "Why the select is registered:\nBRAM / peripheral rdata appears one clock after the\naddress.  cs_x_q is cs_x delayed by one clk, so the\nread mux lines up with the data (same as the core's\nwb_read_data timing).  Sprite/HUD regs are write-only\nand return 0 (not in the mux).", 11, anchor="start", color="#333")
    return f
