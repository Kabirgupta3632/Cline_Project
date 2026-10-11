from h import *

RED = "#c0392b"


def build():
    f = Fig(2000, 1100, "Fig P7c - RV32M integration: result select into the ALU and pipeline stall / bubble control",
            "The M unit sits in EX beside the ALU.  Its result enters input 4 of the ALU result mux (Fig P3); a DIV/REM holds the pipeline until done.")
    f.region(20, 90, 1960, 400, "PART A - M-unit result select and ALU result-mux input 4", RED)
    ml = port(f, 40, 170, "mul_result[31:0]  (Fig P7a)", 10, color=RED)
    dv = port(f, 40, 250, "div_result[31:0]  (Fig P7b)", 10, color=RED)
    m = f.mux(460, 150, 130, ins=("0 MUL*", "1 DIV/REM"), sel=None, w=50)
    f.wire([ml["r"], (360, 170), (360, m["0 MUL*"][1]), m["0 MUL*"]], bus="32")
    f.wire([dv["r"], (380, 250), (380, m["1 DIV/REM"][1]), m["1 DIV/REM"]], bus="32")
    sp = cport(f, m["sel"][0], m["sel"][1] + 50, "funct3[2]  (1 = DIV/REM)", 9, "#2e9d3a"); f.wire([sp["t"], m["sel"]], "ctrl")
    o = port(f, 700, m["out"][1], "m_result[31:0]", 10, color=RED); f.wire([m["out"], o["l"]], bus="32")
    f.text(900, 200, "m_result -> input 4 of the 8:1 ALU result mux (Fig P3).\nALU select = 3'b100 when m_ext = 1.", 11, anchor="start", color="#333")
    f.text(40, 400, "funct3 map:  000 MUL  001 MULH  010 MULHSU  011 MULHU   |   100 DIV  101 DIVU  110 REM  111 REMU", 11, anchor="start", color="#555")
    f.region(20, 520, 1960, 540, "PART B - stall: hold IF/ID, bubble into EX/WB until done", RED)
    st = port(f, 40, 600, "pipeline_stall  (Fig P7b)", 10, color=RED)
    f.wire([st["r"], (300, 600)], "ctrl", arrow=False); f.dot((300, 600), "ctrl")
    t = [("PC hold mux select", "-> Fig P1 (stall_read_i OR pipeline_stall)", 660),
         ("IF/ID hold  (instruction register)", "-> Fig P1/P2 hold muxes", 740),
         ("ID/EX hold", "-> Fig P2 pipeline register: keeps the DIV in EX", 820)]
    for nm, d, y in t:
        p = port(f, 520, y, nm, 10, color="#2e9d3a")
        f.wire([(300, y), p["l"]], "ctrl")
        f.text(520 + p["w"] + 14, y + 4, d, 10, anchor="start", color="#555")
    busline(f, 300, 600, 820, "ctrl", 2)
    f.dot((300, 660), "ctrl"); f.dot((300, 740), "ctrl")
    # EX/WB bubble
    g = f.gate("and", 800, 900, 40, 40)
    a = port(f, 520, 890, "reg_write", 9, color="#2e9d3a"); n = f.gate("not", 620, 920, 30, 28)
    b = port(f, 460, 934, "pipeline_stall", 9, color=RED, w=100)
    f.wire([a["r"], (760, 890), (760, g["in1"][1]), g["in1"]], "ctrl")
    f.wire([b["r"], n["in"]], "ctrl")
    f.wire([n["out"], (730, n["out"][1]), (730, g["in2"][1]), g["in2"]], "ctrl")
    o2 = port(f, 920, g["out"][1], "reg_write_to_WB  (0 while stalled = NOP bubble)", 10, color="#2e9d3a"); f.wire([g["out"], o2["l"]], "ctrl")
    f.text(40, 990, "While the divider runs, the DIV stays in EX and the instruction behind it is held in ID: WB sees a bubble (writes disabled) so nothing wrong is committed.", 10, anchor="start", color="#555")
    return f
