from h import *


def read_port(f, y0, n):
    """One read port: forward mux + x0 mux.  y0 = top of the strip."""
    rs = "rs%d_select" % n
    rd = "read_data_%d" % n
    fw = "fwd_sel%d" % n
    zr = "zero%d" % n
    f.text(40, y0 + 22, "READ PORT %d" % n, 13, anchor="start", weight="bold", color="#3b5bdb")
    # (a) forwarding compare
    a = port(f, 40, y0 + 70, "wb_dest_reg_sel[4:0]", 9, color="#d62828")
    b = port(f, 40, y0 + 110, rs + "[4:0]", 9)
    eq = f.op(300, y0 + 75, "a == b", w=100, h=40, ins=("a", "b"), ts=11, showpins=True)
    f.wire([a["r"], (260, y0 + 70), (260, eq["a"][1]), eq["a"]], "fwd")
    f.wire([b["r"], (270, y0 + 110), (270, eq["b"][1]), eq["b"]])
    we = port(f, 300, y0 + 150, "wb_write_en", 9, color="#d62828")
    g = f.gate("and", 480, y0 + 85, 40, 40)
    f.wire([eq["y"], (440, eq["y"][1]), (440, g["in1"][1]), g["in1"]])
    f.wire([we["r"], (460, y0 + 150), (460, g["in2"][1]), g["in2"]], "fwd")
    o1 = port(f, 580, g["out"][1], fw, 10, color="#2e9d3a")
    f.wire([g["out"], o1["l"]], "ctrl")
    # (b) x0 compare
    z = f.op(300, y0 + 190, rs + " == 0", w=130, h=36, ins=("a",), ts=10)
    bb = port(f, 40, y0 + 208, rs + "[4:0]", 9)
    f.wire([bb["r"], z["a"]])
    o2 = port(f, 500, z["y"][1], zr, 10, color="#2e9d3a")
    f.wire([z["y"], o2["l"]], "ctrl")
    # (c) datapath
    rf = port(f, 760, y0 + 90, rd + "[31:0]  (Register File)", 10, color="#3b5bdb")
    m1 = f.mux(1010, y0 + 60, 100, ins=("0", "1"), sel=None, w=40)
    wr = port(f, 760, m1["1"][1], "wb_result[31:0]", 10, color="#d62828")
    f.wire([rf["r"], (990, y0 + 90), (990, m1["0"][1]), m1["0"]], bus="32")
    f.wire([wr["r"], m1["1"]], "fwd", bus="32")
    p1 = cport(f, m1["sel"][0], m1["sel"][1] + 50, fw, 9, "#2e9d3a")
    f.wire([p1["t"], m1["sel"]], "ctrl")
    m2 = f.mux(1210, y0 + 60, 100, ins=("0", "1"), sel=None, w=40)
    f.wire([m1["out"], m2["0"]], bus="32")
    z0 = port(f, 1130, m2["1"][1], "32'h0", 9, w=44)
    f.wire([z0["r"], m2["1"]])
    p2 = cport(f, m2["sel"][0], m2["sel"][1] + 50, zr, 9, "#2e9d3a")
    f.wire([p2["t"], m2["sel"]], "ctrl")
    out = port(f, 1380, m2["out"][1], "reg_rdata%d[31:0]  -> Fig P3 operand select" % n, 11, color="#3b5bdb")
    f.wire([m2["out"], out["l"]], bus="32")


def build():
    f = Fig(1900, 1230, "Fig P4 - Register File and read-port logic: write-back forwarding + x0 forced to zero",
            "Each read port = register-file output -> forward mux (take wb_result if the same register is being written back) -> x0 mux.  Select polarity read from your pipeline sketch: verify.")
    f.region(20, 90, 1860, 360, "PART A - the register file itself", "#3b5bdb")
    rf = f.seq(560, 130, 340, 290, "Register File  32 x 32", sub="x0..x31 flip-flops; 2 combinational read ports;\n1 synchronous write port", ts=14,
               L=("read_reg_1", "read_reg_2", "write_reg", "write_data", "write_en"), R=("read_data_1", "read_data_2"), pad=90)
    for k, (n, src, col, w) in enumerate([("read_reg_1", "rs1_select[4:0]", "#000", "5"), ("read_reg_2", "rs2_select[4:0]", "#000", "5"),
                                          ("write_reg", "wb_dest_reg_sel[4:0]", "#d62828", "5"), ("write_data", "wb_result[31:0]", "#d62828", "32"),
                                          ("write_en", "wb_write_en", "#d62828", None)]):
        y = rf[n][1]
        p = port(f, 260, y, src, 10, color=col)
        f.wire([p["r"], rf[n]], "fwd" if col == "#d62828" else "data", bus=w)
    for n, lab in [("read_data_1", "read_data_1[31:0]"), ("read_data_2", "read_data_2[31:0]")]:
        o = port(f, 1000, rf[n][1], lab + "  -> Part B", 10, color="#3b5bdb")
        f.wire([rf[n], o["l"]], bus="32")
    f.text(1300, 200, "Write happens at the end of WB, so a value written in\nthe same cycle it is read has not reached the flip-flops yet:\nthat is why the forward mux exists.", 11, anchor="start", color="#333")
    f.region(20, 470, 1860, 320, "PART B - read port 1", "#3b5bdb")
    read_port(f, 480, 1)
    f.region(20, 810, 1860, 320, "PART C - read port 2  (same structure)", "#3b5bdb")
    read_port(f, 820, 2)
    f.text(40, 1170, "Red wires = write-back signals coming from the WB stage (Fig P6).  Green = select signals.", 11, anchor="start", color="#555")
    return f
