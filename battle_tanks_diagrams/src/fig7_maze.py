from h import *


def build():
    f = Fig(1900, 1250, "Fig 7 - Maze Tile RAM: Two Mirrored True-Dual-Port BRAMs (20 x 20 tiles, 2 bits each)",
            "FPGA BRAM has only 2 ports, but 3 users need it (CPU, VGA, collision).  Fix: two identical RAMs;\nthe CPU writes BOTH with the same data, "
            "VGA reads copy V on port B, collision reads copy C on port B, CPU reads back copy V on port A (copy C port A is write-only).")
    f.region(20, 90, 1860, 520, "COPY V  (display)", "#7a2fa8")
    f.region(20, 640, 1860, 520, "COPY C  (collision)", "#7a2fa8")
    # CPU side signals
    wc = port(f, 40, 160, "wr_en_maze  (Fig 2a)", 10, color="#2e9d3a")
    ad = port(f, 40, 220, "d_addr[10:2]  (word index)", 10)
    wd = port(f, 40, 280, "d_wdata[1:0]", 10)
    # sub-address: word index - 0x40 (0x100 >> 2)
    sb = f.op(300, 202, "idx - 64", w=130, h=36, ins=("a",))
    f.wire([ad["r"], (270, 220), (270, sb["a"][1]), sb["a"]][:1] + [sb["a"]], bus="9")
    rng = f.op(300, 120, "idx in 64..463", w=170, h=36, ins=("a",), ts=10)
    ag = f.gate("and", 540, 150, 36, 36)
    f.wire([wc["r"], (500, 160), (500, ag["in1"][1]), ag["in1"]][:1] + [(520, 160), (520, ag["in1"][1]), ag["in1"]], "ctrl")
    f.wire([(270, 220), (270, rng["a"][1]), rng["a"]]); f.dot((270, 220))
    f.wire([rng["y"], (520, rng["y"][1]), (520, ag["in2"][1]), ag["in2"]])
    we = port(f, 640, 168, "we_cpu  (in-range write)", 10, color="#2e9d3a")
    f.wire([ag["out"], we["l"]], "ctrl")
    # distribute rails
    WE, AD, WD = 900, 930, 960
    f.wire([(we["r"][0], 168), (WE, 168)], "ctrl", arrow=False)
    f.wire([sb["y"], (AD, sb["y"][1])], arrow=False, bus="9", label="a_addr")
    f.wire([wd["r"], (WD, 280)], arrow=False, bus="2")
    for x, y0, y1, c in [(WE, 168, 820, "ctrl"), (AD, 220, 893, "data"), (WD, 280, 965, "data")]:
        busline(f, x, y0, y1, c, 2)
    f.dot((WE, 168), "ctrl"); f.dot((AD, 220)); f.dot((WD, 280))
    for k, (nm, y0) in enumerate([("V", 150), ("C", 700)]):
        r = f.mem(1100, y0 + 20, 320, 330, "Maze RAM copy %s" % nm, sub="400 x 2 bit  true dual-port BRAM\n(synchronous read, 1-clk latency)", L=("A.we", "A.addr", "A.wdata", "B.addr"), R=("A.rdata", "B.rdata"), pad=100, ts=14)
        pin(f, r, "B_addr", "L", 255, show=False)
        for nm2, key, yy in [("A.we", "A.we", 0), ("A.addr", "A.addr", 0), ("A.wdata", "A.wdata", 0)]:
            pass
        yw, ya, yd = r["A.we"][1], r["A.addr"][1], r["A.wdata"][1]
        f.wire([(WE, yw), r["A.we"]], "ctrl"); f.dot((WE, yw), "ctrl")
        f.wire([(AD, ya), r["A.addr"]]); f.dot((AD, ya))
        f.wire([(WD, yd), r["A.wdata"]]); f.dot((WD, yd))
        if nm == "V":
            pa = port(f, 1560, r["A.rdata"][1], "rd_maze[1:0]  (zero-extend 32)", 10, color="#1f6fe0")
            f.wire([r["A.rdata"], pa["l"]], "rd", bus="2")
            f.text(1560, r["A.rdata"][1] + 30, "-> Fig 2b read mux (cs_maze_q)", 10, anchor="start", color="#333")
            pb = port(f, 700, r["B.addr"][1], "vga_tile_addr[8:0]  (Fig 11)", 10, color="#008a8a")
            f.wire([pb["r"], r["B.addr"]], "vid", bus="9")
            po = port(f, 1560, r["B.rdata"][1], "vga_tile_data[1:0] (Fig 11)", 10, color="#008a8a")
            f.wire([r["B.rdata"], po["l"]], "vid", bus="2")
        else:
            pb = port(f, 700, r["B.addr"][1], "addr_q[8:0]  (Fig 6b)", 10, color="#8a6d00")
            f.wire([pb["r"], r["B.addr"]], "mem", bus="9")
            po = port(f, 1560, r["B.rdata"][1], "tile[1:0] -> wall = tile[1]|tile[0]", 10, color="#8a6d00")
            f.wire([r["B.rdata"], po["l"]], "mem", bus="2")
            f.text(1560, r["A.rdata"][1] + 4, "(copy C port A read-data unused)", 10, anchor="start", color="#777")
    f.text(60, 400, "Port A (CPU):  write with sw to 0x8000_0100 + 4*(20*row+col), read with lw.\nPort B (read-only): one reader per copy -> no arbitration, no stalls.\nCopy C only needs reading; port A on both copies is write-enabled by the same we_cpu.\nTile code: 0 floor  1 wall  2 breakable  3 unused.\nSoftware loads the maze once per round: 400 stores.", 11, anchor="start", color="#333")
    return f
