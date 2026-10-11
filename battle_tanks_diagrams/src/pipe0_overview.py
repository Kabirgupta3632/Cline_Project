from h import *


def build():
    f = Fig(2400, 1000, "Fig P0 - RV32IM 3-stage pipeline: overview (how Figs P1 - P7 connect)",
            "IF/ID  ->  EX  ->  WB.  Memories: instruction BRAM, data side = MMIO interconnect (Figs 2a / 2b).  Red wires: write-back forwarding / branch redirect.")
    f.region(20, 90, 640, 800, "STAGE 1 : IF / ID", "#3b5bdb")
    f.region(690, 90, 780, 800, "STAGE 2 : EX", "#3b5bdb")
    f.region(1500, 90, 880, 800, "STAGE 3 : WB", "#3b5bdb")
    im = f.mem(60, 150, 150, 90, "Instr. Memory", sub="BRAM", L=("addr",), R=("read_data",), pad=60)
    pc = f.seq(60, 290, 150, 80, "PC + NOP muxes", sub="Fig P1", ts=12, R=("pc_o",), pad=55)
    f.wire([pc["pc_o"], (240, pc["pc_o"][1]), (240, 130), (40, 130), (40, im["addr"][1]), im["addr"]], bus="32", label="inst_fetch_pc", seg=1, lpos=0.5, ldy=-2)
    dec = f.comb(280, 150, 340, 140, "Decode", sub="control decoder, immediate generator,\nexception logic  (Fig P2)", ts=13, L=("instruction",), R=("ctrl, imm, pc",), pad=75)
    f.wire([im["read_data"], (250, im["read_data"][1]), (250, dec["instruction"][1]), dec["instruction"]], bus="32")
    rf = f.seq(280, 330, 340, 200, "Register File + read ports", sub="forwarding + x0 mux  (Fig P4)", ts=13, L=("rs1/rs2 select", "wb_result, wb_dest, wb_en"), R=("rdata1", "rdata2"), pad=80)
    idex = f.seq(280, 570, 340, 150, "ID -> EX pipeline register", sub="ctrl, imm, pc, rs addresses, exception (Fig P2)", ts=12, L=("in",), R=("out",), pad=95)
    f.wire([dec["ctrl, imm, pc"], (640, dec["ctrl, imm, pc"][1]), (640, 545), (260, 545), (260, idex["in"][1]), idex["in"]], bus=True)
    ex = f.comb(730, 150, 320, 260, "Operand select + ALU", sub="adder, shifter, logic, compare, special paths,\n8:1 result mux  (Fig P3)", ts=13, L=("ctrl", "rdata1", "rdata2", "imm, pc"), R=("ex_result", "alu_op2"), pad=90)
    mu = f.comb(730, 440, 320, 120, "RV32M unit", sub="MUL / DIV / REM,  pipeline_stall  (Fig P7)", ts=13, L=("op1, op2",), R=("m_result",), pad=75, tcolor="#c0392b", stroke="#c0392b")
    br = f.comb(730, 590, 320, 130, "Branch comparator + next-PC", sub="33-bit subtract, PC+imm / rs1+imm,\nbranch stall logic  (Fig P5)", ts=12, L=("rdata1/2, imm, pc",), R=("fetch_pc_o", "wb_branch_o"), pad=85)
    exwb = f.seq(1090, 150, 340, 570, "EX -> WB pipeline register", sub="ex_result, store data, dst reg, mem_write, mem_to_reg,\nwidth, reg_write, squash bits  (Fig P5)", ts=12, L=("in",), R=("out",), pad=110)
    for src, dst, ysrc in [(ex["ex_result"], exwb["in"], None)]:
        pass
    f.wire([ex["ex_result"], (1075, ex["ex_result"][1]), (1075, exwb["in"][1]), exwb["in"]], bus="32")
    ex.p["m_in"] = (1050 - 0, 200)
    f.wire([mu["m_result"], (1065, mu["m_result"][1]), (1065, 200), (1050, 200)], bus="32", seg=1)
    f.text(1060, 428, "m_result (ALU input 4)", 9, anchor="end", color="#333")
    f.wire([idex["out"], (660, idex["out"][1]), (660, ex["ctrl"][1]), ex["ctrl"]], bus=True)
    f.wire([rf["rdata1"], (650, rf["rdata1"][1]), (650, ex["rdata1"][1]), ex["rdata1"]], bus="32")
    f.wire([rf["rdata2"], (680, rf["rdata2"][1]), (680, ex["rdata2"][1]), ex["rdata2"]], bus="32")
    wb = f.comb(1520, 150, 330, 200, "Store align + byte enables", sub="data, wb_write_byte, address (Fig P6 A/B)", ts=12, L=("in",), R=("to mem",), pad=80)
    ld = f.comb(1520, 400, 330, 200, "Load align + sign-extend", sub="result mux ex_result / load  (Fig P6 C)", ts=12, L=("in", "rdata"), R=("wb_result",), pad=100)
    f.wire([exwb["out"], (1480, exwb["out"][1]), (1480, wb["in"][1]), wb["in"]], bus=True)
    f.wire([(1480, exwb["out"][1]), (1480, ld["in"][1]), ld["in"]], bus=True); f.dot((1480, exwb["out"][1]))
    mem = f.comb(1880, 150, 480, 200, "Data side", sub="MMIO interconnect + data memory\n(Figs 2a, 2b)", ts=13, L=("w",), R=("r",), pad=90, fill="#efdcfa")
    f.wire([wb["to mem"], mem["w"]], bus="32+")
    f.wire([(2070, 350), (2070, 520), (1500 - 0, 520)][:0] + [mem["r"][0:1][0], ], arrow=False) if False else None
    f.wire([(mem["x"] + mem["w"] if False else 2260, mem["r"][1]), (2260, 520), (1500, 520)][:0] + [mem["r"], (2270, mem["r"][1]), (2270, 520), (1500 - 10, 520), (1500 - 10, ld["rdata"][1]), ld["rdata"]][:0], arrow=False) if False else None
    f.wire([mem["r"], (2370, mem["r"][1]), (2370, 640), (1490, 640), (1490, ld["rdata"][1]), ld["rdata"]], "rd", bus="32", label="wb_read_data", seg=2, lpos=0.5, ldy=-2)
    # redirect / forwarding (red)
    f.wire([br["fetch_pc_o"], (1060, br["fetch_pc_o"][1]), (1060, 830), (35, 830), (35, 335), (60, 335)], "fwd", bus="32", label="fetch_pc_i", seg=2, ldy=-2)
    f.wire([ld["wb_result"], (1870, ld["wb_result"][1]), (1870, 860), (260, 860), (260, rf["wb_result, wb_dest, wb_en"][1]), rf["wb_result, wb_dest, wb_en"]], "fwd", bus="32", label="wb_result / forwarding", seg=2, ldy=-2)
    f.text(60, 940, "stall_read_i (data-memory read in flight) and pipeline_stall (M unit) freeze the PC / IF-ID registers; wb_stall_first / second squash wrong-path instructions after a taken branch (Fig P1).", 11, anchor="start", color="#555")
    return f
