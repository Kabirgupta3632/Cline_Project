from h import *


def build():
    f = Fig(2000, 1700, "Fig P5 - EX stage: branch comparator, next-PC logic, branch-stall logic and EX/WB register",
            "From your 'High-level EX stage block diagram': C = branch comparator, D = next-PC logic, E = branch stall logic, F = EX/WB register.  (A, B = Fig P3.)")
    part_c(f)
    part_d(f)
    part_ef(f)
    return f


def part_c(f):
    f.region(20, 90, 1960, 440, "PART C - branch comparator: 33-bit subtract with signed/unsigned extension (sketch: 'right/unsigned subtract, 33 bit')", "#3b5bdb")
    a = port(f, 40, 160, "reg_rdata1[31:0]", 10); b = port(f, 40, 300, "reg_rdata2[31:0]", 10)
    u = port(f, 40, 220, "branch_unsigned", 10, color="#2e9d3a")
    xa = f.gate("xor", 330, 140, 44, 36); xb = f.gate("xor", 330, 280, 44, 36)
    a31 = port(f, 200, 120, "A[31]", 9); b31 = port(f, 200, 330, "B[31]", 9)
    f.wire([a["r"], (190, 160)], arrow=False)
    f.wire([a31["r"], (300, 130), (300, xa["in1"][1]), xa["in1"]])
    f.wire([u["r"], (270, 220)], "ctrl", arrow=False)
    f.wire([(270, 220), (270, 150), (310, 150), (310, xa["in2"][1]), xa["in2"]][:2] + [(270, 156), (330, 156)][:0] + [(300, 150)][:0], "ctrl", arrow=False)
    f.wire([(270, 220), (270, xa["in2"][1]), xa["in2"]], "ctrl")
    f.wire([b31["r"], (300, 330), (300, xb["in1"][1]), xb["in1"]])
    f.wire([(270, 220), (270, xb["in2"][1]), xb["in2"]], "ctrl")
    f.dot((270, 220), "ctrl")
    sub = f.op(520, 190, "A33 - B33", w=150, h=100, ins=("a", "b"), ts=12, showpins=True)
    f.text(595, 260, "33-bit subtract", 9, color="#555")
    f.wire([xa["out"], (480, xa["out"][1]), (480, sub["a"][1]), sub["a"]], bus="33", label="{xa, A[31:0]}", seg=0, ldy=-2)
    f.wire([xb["out"], (490, xb["out"][1]), (490, sub["b"][1]), sub["b"]], bus="33", label="{xb, B[31:0]}", seg=0, ldy=-2)
    d = port(f, 760, sub["y"][1], "diff[32:0]", 10)
    f.wire([sub["y"], d["l"]], bus="33")
    tp = (d["r"][0] + 30, d["r"][1])
    f.wire([d["r"], tp], arrow=False); f.dot(tp)
    # outputs
    o_eq = f.op(980, 150, "diff[31:0] == 0", w=160, h=36, ins=("a",), ts=10)
    o_lt = port(f, 980, 260, "diff[32]  (A < B)", 10)
    f.wire([tp, (tp[0], o_eq["a"][1]), o_eq["a"]])
    f.wire([(tp[0], 260 + 0), o_lt["l"]][:1] + [(tp[0], 270), o_lt["l"]], arrow=True) if False else f.wire([(tp[0], tp[1]), (tp[0], o_lt["l"][1]), o_lt["l"]])
    eqp = port(f, 1250, o_eq["y"][1], "cmp_eq", 10, color="#2e9d3a"); f.wire([o_eq["y"], eqp["l"]], "ctrl")
    ltp = port(f, 1250, 350, "cmp_lt", 10, color="#2e9d3a")
    f.wire([(o_lt["r"][0], o_lt["r"][1]), (1200, o_lt["r"][1]), (1200, 350), ltp["l"]], "ctrl")
    # branch type select: funct3 -> take
    t = port(f, 1350, 200, "funct3[2:0]", 10)
    m8 = f.mux(1560, 160, 200, ins=("000 BEQ", "001 BNE", "010 -", "011 -", "100 BLT", "101 BGE", "110 BLTU", "111 BGEU"), sel=None, w=60)
    f.wire([(1530, 360), (1590, 360 + 0)][:0] + [(1590, 400), (1590, 360 - 0)][:0] + [(1590, 400), (1590, 360 - 6)], "ctrl", arrow=False) if False else None
    srcs = ["cmp_eq", "~cmp_eq", "0", "0", "cmp_lt", "~cmp_lt", "cmp_lt", "~cmp_lt"]
    for i, sname in enumerate(srcs):
        key = list(m8.p.keys())[i]
        p = port(f, 1440, m8[key][1], sname, 8, w=80)
        f.wire([p["r"], m8[key]])
    f.wire([t["b"], (t["b"][0], 440), (1590, 440), (1590, 160 + 200 - 6)], "data", bus="3", seg=1, lpos=0.5, ldy=-2)
    bt = port(f, 1700, 260, "branch_cond", 10, color="#2e9d3a")
    f.wire([m8["out"], bt["l"]], "ctrl")
    f.note(980, 480, "The unsigned bit flips the sign extension so a single 33-bit subtract gives the right 'less than' for both signed and unsigned compares.", 10)


def part_d(f):
    f.region(20, 560, 1960, 480, "PART D - next-PC logic  (fetch_pc_o = redirect ? target : PC + 4)", "#3b5bdb")
    pc = port(f, 40, 640, "PC[31:0]  (pc_ex, Fig P2)", 10)
    imm = port(f, 40, 700, "execute_imm[31:0]", 10)
    r1 = port(f, 40, 780, "reg_rdata1[31:0]", 10)
    p4 = f.op(330, 625, "PC + 4", w=100, h=36, ins=("a",))
    f.wire([pc["r"], (290, 640), (290, p4["a"][1]), p4["a"]]); f.dot((290, 640))
    ad1 = f.op(330, 690, "PC + imm", w=120, h=44, ins=("a", "b"), ts=11)
    f.wire([(290, 640), (290, ad1["a"][1]), ad1["a"]])
    f.wire([imm["r"], (310, 700), (310, ad1["b"][1]), ad1["b"]]); f.dot((310, 700))
    ad2 = f.op(330, 770, "rs1 + imm", w=120, h=44, ins=("a", "b"), ts=11)
    f.wire([r1["r"], ad2["a"]])
    f.wire([(310, 700), (310, ad2["b"][1]), ad2["b"]])
    # jalr clears bit 0
    jc = f.op(520, 770, "& ~1  (JALR)", w=130, h=36, ins=("a",), ts=10)
    f.wire([ad2["y"], jc["a"]])
    tm = f.mux(760, 690, 100, ins=("0 PC+imm", "1 rs1+imm"), sel="jalr", w=50)
    f.wire([ad1["y"], (700, ad1["y"][1]), (700, tm["0 PC+imm"][1]), tm["0 PC+imm"]], bus="32")
    f.wire([jc["y"], (720, jc["y"][1]), (720, tm["1 rs1+imm"][1]), tm["1 rs1+imm"]], bus="32")
    rm = f.mux(960, 640, 100, ins=("0", "1"), sel="branch_taken", w=50)
    f.wire([p4["y"], (900, p4["y"][1]), (900, rm["0"][1]), rm["0"]], bus="32")
    f.wire([tm["out"], (930, tm["out"][1]), (930, rm["1"][1]), rm["1"]], bus="32")
    o = port(f, 1140, rm["out"][1], "fetch_pc_o[31:0]  -> Fig P1 (PC mux)", 11, color="#3b5bdb")
    f.wire([rm["out"], o["l"]], bus="32")
    # branch_taken
    bc = port(f, 1000, 860, "branch_cond  (Part C)", 9, color="#2e9d3a"); br = port(f, 1000, 900, "is_branch", 9, color="#2e9d3a")
    jj = port(f, 1000, 940, "is_jal | is_jalr", 9, color="#2e9d3a")
    a1 = f.gate("and", 1240, 870, 40, 36)
    f.wire([bc["r"], (1210, 860), (1210, a1["in1"][1]), a1["in1"]], "ctrl"); f.wire([br["r"], (1220, 900), (1220, a1["in2"][1]), a1["in2"]], "ctrl")
    o1 = f.gate("or", 1340, 900, 40, 36)
    f.wire([a1["out"], (1310, a1["out"][1]), (1310, o1["in1"][1]), o1["in1"]], "ctrl"); f.wire([jj["r"], (1320, 940), (1320, o1["in2"][1]), o1["in2"]], "ctrl")
    bt = port(f, 1440, o1["out"][1], "branch_taken", 10, color="#2e9d3a"); f.wire([o1["out"], bt["l"]], "ctrl")
    f.text(1000, 1000, "branch_taken = (branch_cond & is_branch) | jal | jalr -> also drives wb_branch_o (Part E) and the flush shift register (Fig P1)", 10, anchor="start", color="#555")


def part_ef(f):
    f.region(20, 1070, 1960, 600, "PART E / F - branch stall logic and the EX -> WB pipeline register", "#3b5bdb")
    st = port(f, 40, 1150, "wb_stall_first_i  (Fig P1)", 10, color="#2e9d3a"); st2 = port(f, 40, 1190, "wb_stall_second_i  (Fig P1)", 10, color="#2e9d3a")
    o = f.gate("or", 380, 1160, 40, 40)
    f.wire([st["r"], (330, 1150), (330, o["in1"][1]), o["in1"]], "ctrl"); f.wire([st2["r"], (340, 1190), (340, o["in2"][1]), o["in2"]], "ctrl")
    sq = port(f, 470, o["out"][1], "squash_ex  (this instruction was fetched behind a taken branch)", 10, color="#2e9d3a")
    f.wire([o["out"], sq["l"]], "ctrl")
    f.text(40, 1250, "squash_ex = 1 -> the instruction currently in EX is a wrong-path instruction: its register-write, memory-write and branch_taken are forced to 0.", 10, anchor="start", color="#555")
    r = f.seq(1000, 1120, 420, 520, "EX -> WB Pipeline Register", ts=14, sub="captures ex_result etc. on clk;  holds on stall_read;  cleared on reset",
              L=("ex_result", "store_data (alu_operand2)", "write_address (ex_result[1:0])", "dst_reg_sel", "mem_write & ~squash", "mem_to_reg", "width_select", "reg_write & ~squash"),
              R=("wb_result", "wb_write_data", "wb_write_address", "wb_dest_reg_sel", "wb_mem_write", "wb_mem_to_reg", "wb_width", "wb_write_en"), pad=110)
    f.text(1000, 1670, "Outputs go to Fig P6 (WB / load-store unit).", 11, anchor="start", color="#333")
