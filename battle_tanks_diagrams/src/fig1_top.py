from lib2 import Fig, pin, busline, vtext

BUS, RD, RR, XY = 975, 1010, 1545, 1885     # vertical rails
PX, PW = 1060, 330                            # peripheral column


def build():
    f = Fig(2760, 1260, "Fig 1 - Battle Tanks: Top-Level System Block Diagram (FPGA fabric)",
            "RV32IM 3-stage CPU runs the game rules in C; everything per-pixel / per-cycle / per-deadline is hardware.  "
            "Top-level view only; gate-level detail is in Figs 2-10.")
    cpu_part(f)
    periph_part(f)
    vga_part(f)
    legend_part(f)
    return f


def cpu_part(f):
    osc = f.io(30, 90, 150, 60, "Board Oscillator", sub="100 MHz")
    pin(f, osc, "o", "R", 44, show=False)
    rst = f.io(30, 180, 150, 60, "Reset Button", sub="active-low")
    pin(f, rst, "o", "R", 44, show=False)
    ck = f.comb(250, 90, 230, 160, "Clock / Reset Gen", sub="PLL/MMCM -> clk_sys\n25 MHz pixel enable\n2-FF reset synchroniser")
    pin(f, ck, "clk_in", "L", 52)
    pin(f, ck, "rst_btn", "L", 142)
    pin(f, ck, "pix_ce", "R", 60)
    pin(f, ck, "clk_sys, rst_n", "R", 130)
    f.wire([osc["o"], (215, osc["o"][1]), (215, ck["clk_in"][1]), ck["clk_in"]], "clk")
    f.wire([rst["o"], (215, rst["o"][1]), (215, ck["rst_btn"][1]), ck["rst_btn"]], "ctrl")
    f.wire([ck["clk_sys, rst_n"], (520, ck["clk_sys, rst_n"][1])], "clk")
    f.text(528, ck["clk_sys, rst_n"][1] + 4, "clk_sys, rst_n -> every clocked block\n(wires omitted for clarity)", 11, anchor="start", color="#555")
    f.PIXCE = ck["pix_ce"]

    f.region(30, 290, 570, 340, "RV32IM CPU SUBSYSTEM", "#3b5bdb")
    imem = f.mem(50, 340, 140, 100, "Instr. Mem", sub="BRAM\nprogram.hex")
    pin(f, imem, "addr", "B", 70, show=False)
    pin(f, imem, "rdata", "R", 80)
    core = f.cpu(260, 330, 320, 280, "RV32IM Core",
                 sub="3-stage: IF/ID -> EX -> WB\nMUL in EX (1-2 clk)\nDIV/REM 32 clk -> pipeline_stall\nbyte-lane LSU in WB")
    pin(f, core, "inst_addr", "L", 175)
    pin(f, core, "inst", "L", 70)
    pin(f, core, "d_addr", "R", 90)
    pin(f, core, "d_wdata", "R", 130)
    pin(f, core, "d_we, d_wstrb", "R", 170)
    pin(f, core, "d_rdata", "R", 210)
    f.wire([core["inst_addr"], (120, core["inst_addr"][1]), imem["addr"]], bus="32", label="inst_addr", seg=0, lpos=0.5)
    f.wire([imem["rdata"], (225, imem["rdata"][1]), (225, core["inst"][1]), core["inst"]], bus="32", label="inst", seg=2, lpos=0.6, ldy=-1)

    dm = f.mem(690, 100, 190, 100, "Data Memory", sub="BRAM @ 0x0000_0000\nstack, globals, sin/cos LUT")
    pin(f, dm, "wr", "B", 50, show=False)
    pin(f, dm, "rd", "B", 140, show=False)
    ic = f.comb(690, 290, 190, 900, "MMIO Bus\nInterconnect")
    for n, y, w in [("d_addr", 90, "32"), ("d_wdata", 130, "32"), ("d_we, d_wstrb", 170, "5")]:
        pin(f, ic, n, "L", y + 40)
        f.wire([core[n], ic[n]], "ctrl" if w == "5" else "data", bus=w, label=n if w != "5" else "we, wstrb", ldy=-1)
    pin(f, ic, "d_rdata", "L", 250)
    f.wire([ic["d_rdata"], core["d_rdata"]], "rd", bus="32", label="d_rdata", ldy=-1)
    pin(f, ic, "dmem_wr", "T", 50, show=False)
    pin(f, ic, "dmem_rd", "T", 140, show=False)
    f.wire([ic["dmem_wr"], dm["wr"]], "data", bus=True, label="addr, wdata, we", ldx=-100)
    f.wire([dm["rd"], ic["dmem_rd"]], "rd", bus="32", label="rdata", ldx=28)
    f.text(785, 640, "addr[31]=0 -> Data Mem\naddr[31]=1 -> MMIO window\naddr[11:2] -> cs_* decode\nread mux selects source\nfrom registered cs", 11, color="#333")
    pin(f, ic, "bus_out", "R", 30, show=False)
    pin(f, ic, "rd_in", "R", 890, show=False)
    f.IC = ic

    # software panel
    f.rect(30, 660, 600, 250, fill="#f7f7f7", stroke="#666", sw=1.5, rx=6, dash="6 4", layer=f.u)
    f.text(330, 684, "Game software (C, -march=rv32im) in Instr/Data Mem", 13, weight="bold")
    steps = ["1. lw P1/P2_INPUT_REG (poll buttons)",
             "2. turn / move: angle idx -> cos/sin LUT x speed (MUL)",
             "3. SHOOT & TIMER_STATUS ready? spawn bullet, sw TIMER_TRIGGER",
             "4. advance bullets, specular reflect on walls (MUL / DIV / REM)",
             "5. lw COLLISION_FLAG -> damage 1 / 5, cancel bullets",
             "6. sw TANK_POS, BULLET_REG_0..7, HEALTH_BAR_REG",
             "7. game over / respawn / sw MAZE_RAM tile map"]
    for i, t in enumerate(steps):
        f.text(44, 712 + i * 25, t, 12, anchor="start", color="#222")


def periph_part(f):
    ic = f.IC
    b1 = f.io(PX, 90, 150, 56, "P1 buttons x6", ts=12, sub="FWD BWD L R SHOOT SPEC")
    b2 = f.io(PX + 180, 90, 150, 56, "P2 buttons x6", ts=12, sub="FWD BWD L R SHOOT SPEC")
    pin(f, b1, "o", "B", 75, show=False)
    pin(f, b2, "o", "B", 75, show=False)
    inp = f.io(PX, 200, PW, 140, "Input Controller", fill="#fde9d9",
               sub="12x (2-FF sync + debounce)\nP1_INPUT_REG 0x8000_0000 (R)\nP2_INPUT_REG 0x8000_0004 (R)\n[5:0] = FWD BWD LEFT RIGHT SHOOT SPEC")
    pin(f, inp, "p1", "T", 75, show=False)
    pin(f, inp, "p2", "T", 255, show=False)
    pin(f, inp, "cs / addr", "L", 100)
    pin(f, inp, "rdata", "L", 125)
    f.wire([b1["o"], inp["p1"]], "data", bus="6", label="p1_btn", ldx=-34)
    f.wire([b2["o"], inp["p2"]], "data", bus="6", label="p2_btn", ldx=34)
    tm = f.seq(PX, 370, PW, 170, "Cooldown Timers", fill="#d9f2d9",
               sub="TIMER_STATUS 0x8000_0010 (R)\nTIMER_TRIGGER 0x8000_0014 (W)\nP1/P2 shoot 0.5 s, P1/P2 special 20 s\n1 ms prescaler, 4 down-counters\nready bits [3:0]: CPU polls, no busy-wait")
    pin(f, tm, "cs / wdata", "L", 120)
    pin(f, tm, "rdata", "L", 150)
    sr = f.seq(PX, 570, PW, 210, "Sprite & HUD Register File", fill="#fdeacc",
               sub="write-only (0x8000_0040 ..)\nP1/P2_TANK_POS  {y[15:0], x[15:0]}\nBULLET_REG_0..7  x, y, active, big\nHEALTH_BAR_REG  P1[7:0]  P2[15:8]\nTANK_ANGLE_REG 0x84 (added, Fig 5)")
    pin(f, sr, "cs / wdata", "L", 170)
    pin(f, sr, "shadow", "R", 110, show=False)
    f.text(PX + PW - 8, 570 + 114, "shadow regs", 10, anchor="end", color="#a36000")
    co = f.comb(PX, 810, PW, 180, "Collision Engine", fill="#fff3c4",
                sub="COLLISION_FLAG 0x8000_0020 + masks\nAABB cells (Fig 6): wall scan x8 (1 port),\nbullet-bullet x28, bullet-tank x16\nsticky W1C masks 0x20..0x2C")
    pin(f, co, "cs / addr", "L", 130)
    pin(f, co, "rdata", "L", 155)
    pin(f, co, "regs", "R", 90)
    pin(f, co, "tile_addr", "B", 90, show=False)
    pin(f, co, "wall_bit", "B", 240, show=False)
    mz = f.mem(PX, 1040, PW, 170, "Maze Tile RAM (20 x 20)",
               sub="MAZE_RAM_BASE 0x8000_0100 (R/W)\ntwo mirrored dual-port BRAMs (Fig 7)\nV: CPU + VGA fetch   C: CPU + collision\nCPU writes both copies")
    pin(f, mz, "cs / addr / wdata", "L", 125)
    pin(f, mz, "rdata", "L", 150)
    pin(f, mz, "b_addr", "R", 90)
    pin(f, mz, "b_data", "R", 130)
    pin(f, mz, "c_addr", "T", 90, show=False)
    pin(f, mz, "c_data", "T", 240, show=False)
    f.wire([co["tile_addr"], mz["c_addr"]], "mem", bus="9", label="tile_addr")
    f.wire([mz["c_data"], co["wall_bit"]], "rd", bus="2", label="wall_bit")
    f.SR, f.CO, f.MZ, f.INP, f.TM = sr, co, mz, inp, tm
    # rails
    y0 = ic["bus_out"][1]
    f.wire([ic["bus_out"], (BUS, y0)], "ctrl", arrow=False, width=2.2)
    vtext(f, BUS - 8, 900, "MMIO bus: addr, wdata, we, wstrb, cs_*", 11, "#2e9d3a", "bold")
    vtext(f, RD + 16, 595, "per-peripheral rdata -> AND-OR mux (Fig 2b)", 11, "#1f6fe0", "bold")
    y1 = ic["rd_in"][1]
    f.wire([(RD, y1), ic["rd_in"]], "rd", bus="32", label="", width=2.2)
    busline(f, BUS, y0, mz["cs / addr / wdata"][1], "ctrl", 3)
    busline(f, RD, inp["rdata"][1], y1, "rd", 3)
    for b, pn, rd, lab in [(inp, "cs / addr", "rdata", "cs_in"), (tm, "cs / wdata", "rdata", "cs_tmr"), (sr, "cs / wdata", None, "cs_spr"),
                           (co, "cs / addr", "rdata", "cs_col"), (mz, "cs / addr / wdata", "rdata", "cs_maze")]:
        y = b[pn][1]
        f.wire([(BUS, y), b[pn]], "ctrl")
        f.dot((BUS, y), "ctrl")
        f.text(1040, y - 6, lab, 9, anchor="end", color="#2e9d3a", halo=True)
        if rd:
            y2 = b[rd][1]
            f.wire([b[rd], (RD, y2)], "rd")
            f.dot((RD, y2), "rd")



def vga_part(f):
    sr, co, mz = f.SR, f.CO, f.MZ
    f.region(1600, 190, 1140, 1040, "VGA DISPLAY ENGINE  (clk_sys + 25 MHz pixel enable)", "#008a8a")
    tg = f.vid(1640, 240, 210, 160, "VGA Timing Gen", sub="800 x 525 counters\n640x480 @ 60 Hz")
    pin(f, tg, "pix_ce", "L", 90)
    pin(f, tg, "sync", "R", 50)
    pin(f, tg, "x, y", "R", 130)
    p = f.PIXCE
    f.wire([p, (500, p[1]), (500, 84), (1580, 84), (1580, tg["pix_ce"][1]), tg["pix_ce"]], "clk", label="pix_ce (25 MHz enable)", seg=2, lpos=0.12, ldy=-1)
    f.wire([tg["x, y"], (XY, tg["x, y"][1])], "vid", arrow=False)
    f.text(1868, tg["x, y"][1] - 8, "x[9:0], y[9:0]", 10, anchor="end", color="#008a8a", halo=True)

    se = f.vid(1925, 450, 250, 300, "Sprite Engine", sub="per-pixel hit tests: 2 tanks + 8 bullets\n(6x6 normal / 12x12 big box compare)\ntank ROM: 16 angles x 1-bit mask\nbullet ROM: disc mask")
    pin(f, se, "regs", "L", 60)
    pin(f, se, "x, y", "L", 100)
    pin(f, se, "tank_px", "R", 150)
    pin(f, se, "bullet_px", "R", 190)
    pin(f, se, "big_px", "R", 230)
    hu = f.vid(1925, 780, 250, 180, "Health HUD", sub="2 x 20 heart slots\nheart i lit if i < hearts\nheart sprite ROM")
    pin(f, hu, "regs", "L", 100)
    pin(f, hu, "x, y", "L", 140)
    pin(f, hu, "hud_px", "R", 100)
    mr = f.vid(1925, 1000, 250, 190, "Maze Tile Renderer", sub="tile col/row = x/24, y/24\n(counter based, no divider)\ntile code -> wall / floor colour")
    pin(f, mr, "x, y", "L", 38)
    pin(f, mr, "tile_addr", "L", 130)
    pin(f, mr, "tile_data", "L", 170)
    pin(f, mr, "maze_px", "R", 110)
    xy_end = mr["x, y"][1]
    busline(f, XY, tg["x, y"][1], xy_end, "vid", 3)
    for b in (se, hu, mr):
        y = b["x, y"][1]
        f.wire([(XY, y), b["x, y"]], "vid")
        f.dot((XY, y), "vid")
    f.wire([mr["tile_addr"], mz["b_addr"]], "mem", bus="9", label="tile_addr")
    f.wire([mz["b_data"], mr["tile_data"]], "mem", bus="2", label="tile_data")

    # shadow-register rail
    ys = sr["shadow"][1]
    f.wire([sr["shadow"], (RR, ys)], "reg", arrow=False, width=2.2)
    f.text(RR - 8, ys - 24, "tank pos, bullets,\nhearts, angle", 10, anchor="end", color="#a36000", halo=True)
    busline(f, RR, se["regs"][1], co["regs"][1], "reg", 3)
    f.dot((RR, ys), "reg")
    for b in (se, hu):
        y = b["regs"][1]
        f.wire([(RR, y), b["regs"]], "reg")
        f.dot((RR, y), "reg")
    f.wire([(RR, co["regs"][1]), co["regs"]], "reg")

    # mixer + sync
    sd = f.vid(2270, 240, 190, 150, "Sync / Blank\nDelay Line", sub="align with mixer latency")
    pin(f, sd, "sync", "L", 50)
    pin(f, sd, "hs", "R", 100)
    pin(f, sd, "vs", "R", 130)
    pin(f, sd, "act", "B", 95, show=False)
    f.wire([tg["sync"], sd["sync"]], "vid", label="hsync, vsync, active", ldy=-1)
    mx = f.vid(2270, 450, 190, 740, "Pixel Priority\nMixer", sub="priority  HUD > Bullet >\nTank > Wall > Background\n(registered 12-bit RGB out)")
    pin(f, mx, "act", "T", 95, show=False)
    pin(f, mx, "tank", "L", 150)
    pin(f, mx, "bullet", "L", 190)
    pin(f, mx, "big", "L", 230)
    pin(f, mx, "hud", "L", 430)
    pin(f, mx, "maze", "L", 660)
    pin(f, mx, "rgb", "R", 300)
    f.wire([sd["act"], mx["act"]], "vid", label="active_d", ldx=6)
    f.wire([se["tank_px"], mx["tank"]], "vid", bus="13", label="rgb+v", lsize=9)
    f.wire([se["bullet_px"], mx["bullet"]], "vid", bus="13", label="rgb+v", lsize=9)
    f.wire([se["big_px"], mx["big"]], "vid", bus="13", label="rgb+v", lsize=9)
    f.wire([hu["hud_px"], mx["hud"]], "vid", bus="13", label="rgb+v", lsize=9)
    f.wire([mr["maze_px"], mx["maze"]], "vid", bus="12", label="rgb", lsize=9)
    vg = f.io(2510, 270, 200, 560, "VGA Connector\n(DB15 / PMOD)", sub="R-2R resistor DAC\nor on-board 12-bit DAC")
    pin(f, vg, "hs", "L", 70)
    pin(f, vg, "vs", "L", 100)
    pin(f, vg, "rgb", "L", 480)
    f.wire([sd["hs"], vg["hs"]], "vid", label="hsync_n", ldy=-1)
    f.wire([sd["vs"], vg["vs"]], "vid", label="vsync_n", ldy=-1)
    f.wire([mx["rgb"], vg["rgb"]], "vid", bus="12", label="vga_rgb", ldy=-1)
    mon = f.io(2510, 890, 200, 90, "Monitor", sub="640 x 480 @ 60 Hz")
    pin(f, mon, "t", "T", 100, show=False)
    f.wire([(2610, 830), mon["t"]], "vid", label="VGA cable", ldx=10)


def legend_part(f):
    f.legend(30, 930, [("data", "data bus (width in [ ])"), ("ctrl", "control / MMIO bus / chip select"), ("rd", "MMIO read-data return"),
                       ("reg", "sprite / HUD shadow registers"), ("vid", "pixel / video path"), ("mem", "RAM address / data path"), ("clk", "clock / reset")], w=340)
    f.text(400, 948, "Block colours:", 11, anchor="start", weight="bold")
    for i, (c, t) in enumerate([("#d9f2d9", "clocked register / FSM"), ("#fff3c4", "combinational"), ("#efdcfa", "memory (BRAM)"),
                                ("#d6f5f5", "video pipeline"), ("#ffe0e0", "board / off-chip"), ("#dde8ff", "CPU core")]):
        f.rect(400, 960 + i * 22, 22, 14, fill=c, layer=f.u)
        f.text(430, 972 + i * 22, t, 11, anchor="start")
