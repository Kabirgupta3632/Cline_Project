from h import *

# (name, byte addr, fields)
ROWS = [("P1_TANK_POS", 0x40, "p1_x = Q[15:0]    p1_y = Q[31:16]"),
        ("P2_TANK_POS", 0x44, "p2_x = Q[15:0]    p2_y = Q[31:16]")] + \
       [("BULLET_REG_%d" % i, 0x48 + 4 * i, "b%d_x = Q[9:0]  b%d_y = Q[19:10]  b%d_act = Q[20]  b%d_big = Q[21]" % (i, i, i, i)) for i in range(8)] + \
       [("HEALTH_BAR_REG", 0x80, "hp1[7:0] = Q[7:0]   hp2[7:0] = Q[15:8]"),
        ("TANK_ANGLE_REG", 0x84, "ang1[3:0] = Q[3:0]   ang2[3:0] = Q[7:4]")]

AR, WR, DW = 215, 410, 520


def build():
    f = Fig(1850, 1560, "Fig 5 - Sprite & HUD Register File (12 x 32-bit write-only MMIO registers)",
            "Each register: comparator on d_addr[7:2]  AND  wr_en_spr  ->  select of a hold mux  ->  FF.   Same row structure repeated 12 times; "
            "outputs run continuously to the Sprite Engine, Health HUD and Collision Engine.")
    f.region(20, 90, 1810, 1440, "REGISTER ARRAY  (reset value of all registers = 0 except TANK_POS = spawn point, HEALTH = 20 / 20)", "#a36000")
    ta = port(f, 40, 135, "d_addr[7:2]")
    tw_ = port(f, 40, 175, "wr_en_spr  (Fig 2a)", color="#2e9d3a")
    td = port(f, 40, 215, "d_wdata[31:0]")
    y0, dy = 330, 100
    yend = y0 + 11 * dy + 60
    f.wire([ta["r"], (AR, 135)], bus="6", arrow=False, lpos=0.5); busline(f, AR, 135, yend, "data", 3)
    f.wire([tw_["r"], (WR, 175)], "ctrl", arrow=False); busline(f, WR, 175, yend, "ctrl", 2)
    f.wire([td["r"], (DW, 215)], bus="32", arrow=False); busline(f, DW, 215, yend, "data", 3)
    f.dot((AR, 135)); f.dot((WR, 175)); f.dot((DW, 215))
    for i, (nm, ad, fields) in enumerate(ROWS):
        y = y0 + i * dy
        idx = ad >> 2
        c = f.op(250, y + 22, "addr[7:2] == 6'd%d" % idx, w=150, h=36, ins=("a",), ts=10)
        f.wire([(AR, c["a"][1]), c["a"]]); f.dot((AR, c["a"][1]))
        g = f.gate("and", 450, y + 22, 34, 36)
        f.wire([c["y"], g["in1"]])
        f.wire([(WR, g["in2"][1]), g["in2"]], "ctrl"); f.dot((WR, g["in2"][1]), "ctrl")
        m = f.mux(580, y - 25, 50, ins=("0", "1"), sel=None, w=36)
        f.wire([g["out"], (598, g["out"][1]), m["sel"]], "ctrl")
        f.text(640, g["out"][1] + 14, "we_%d" % idx, 9, color="#2e9d3a", anchor="start", halo=True) if False else None
        f.wire([(DW, m["1"][1]), m["1"]]); f.dot((DW, m["1"][1]))
        ff = f.seq(700, y - 20, 110, 40, "FF  [31:0]", ts=11)
        pin(f, ff, "D", "L", 20, show=False); pin(f, ff, "Q", "R", 20, show=False)
        f.wire([m["out"], ff["D"]], bus="32")
        tq = (ff["Q"][0] + 30, ff["Q"][1])
        f.wire([ff["Q"], tq], arrow=False); f.dot(tq)
        f.wire([tq, (tq[0], y - 42), (560, y - 42), (560, m["0"][1]), m["0"]], label="hold", seg=1, ldy=-2, lsize=9)
        o = port(f, 900, ff["Q"][1], nm + "_q", 11, color="#a35c00")
        f.wire([tq, o["l"]], "reg", bus="32")
        f.text(900 + o["w"] + 14, y - 6, "0x%02X  %s" % (ad, nm), 11, anchor="start", weight="bold")
        f.text(900 + o["w"] + 14, y + 12, fields, 10, anchor="start", color="#444")
    f.legend(1480, 100, [("data", "address / write data"), ("ctrl", "write enable"), ("reg", "register outputs (to VGA / collision)")], w=340)
    f.text(1000, 1470, "Bullet slot fields: x,y are pixel coordinates (10 bits cover 640);  act = bullet alive;  big = special 5-damage bullet.\n"
           "Tank angle index selects one of 16 rotated sprites in the Sprite Engine ROM and the cos/sin LUT row in C.\n"
           "Software writes a bullet by sw to its BULLET_REG_n;  act=0 removes it (collision / wall-lifetime / cancel).", 11, anchor="start", color="#333")
    return f
