from h import *

ROWS = [("JALR", "{ {20{i[31]}}, i[31:20] }", "1100111"),
        ("BRANCH", "{ {20{i[31]}}, i[7], i[30:25], i[11:8], 1'b0 }", "1100011"),
        ("LOAD", "{ {20{i[31]}}, i[31:20] }", "0000011"),
        ("STORE", "{ {20{i[31]}}, i[31:25], i[11:7] }", "0100011"),
        ("ARITH-I", None, "0010011"),
        ("ARITH-R", "32'h0", "0110011"),
        ("LUI", "{ i[31:12], 12'b0 }", "0110111"),
        ("AUIPC", "{ i[31:12], 12'b0 }", "0010111"),
        ("JAL", "{ {12{i[31]}}, i[19:12], i[20], i[30:21], 1'b0 }", "1101111"),
        ("default", "32'h0", "others")]


def build():
    f = Fig(2100, 1700, "Fig P2 - Pipeline Stage 1 (ID): immediate generator, decoder, exception logic",
            "Follows your 'I-D stage' immediate-mux notebook page and the ID/EX block sketch.  RV32M adds one decode line (funct7 = 0000001, red).")
    part_a(f)
    part_b(f)
    return f


def part_a(f):
    f.region(20, 90, 2060, 640, "PART A - immediate generator: one mux selected by instruction_i[6:0] (opcode)", "#3b5bdb")
    MX, MY, MH = 1500, 130, 570
    big = f.mux(MX, MY, MH, ins=tuple(r[0] for r in ROWS), sel=None, w=70)
    for nm, expr, op in ROWS:
        y = big[nm][1]
        f.text(60, y + 4, nm, 10, anchor="start", weight="bold")
        f.text(160, y + 4, "7'b" + op if op != "others" else op, 9, anchor="start", color="#444")
        if expr:
            p = port(f, 330, y, expr, 9, w=400)
            f.wire([p["r"], big[nm]])
    y = big["ARITH-I"][1]
    sm = f.mux(1100, y - 40, 80, ins=("0", "1"), sel=None, w=40)
    p0 = port(f, 330, sm["0"][1], "{ {20{i[31]}}, i[31:20] }", 9, w=220)
    p1 = port(f, 330, sm["1"][1], "{ 27'b0, i[24:20] }  (shamt)", 9, w=220)
    f.wire([p0["r"], sm["0"]]); f.wire([p1["r"], sm["1"]])
    f.wire([sm["out"], big["ARITH-I"]])
    e1 = f.op(330, y + 70, "funct3 == 3'b001  (SLLI)", w=220, h=34, ins=("a",), ts=10)
    e2 = f.op(330, y + 118, "funct3 == 3'b101  (SRLI/SRAI)", w=220, h=34, ins=("a",), ts=10)
    ip = port(f, 215, y + 111, "i[14:12]", 9)
    f.wire([ip["r"], (290, y + 111), (290, e1["a"][1]), e1["a"]])
    f.wire([(290, y + 111), (290, e2["a"][1]), e2["a"]]); f.dot((290, y + 111))
    og = f.gate("or", 640, y + 90, 40, 40)
    f.wire([e1["y"], (600, e1["y"][1]), (600, og["in1"][1]), og["in1"]])
    f.wire([e2["y"], (610, e2["y"][1]), (610, og["in2"][1]), og["in2"]])
    sp = port(f, 740, y + 160, "is_shift_imm", 9, color="#2e9d3a")
    f.wire([og["out"], (700, og["out"][1]), (700, y + 160), sp["l"]], "ctrl")
    f.wire([sp["r"], (1140, sp["r"][1]), (1140, y + 40 - 5)], "ctrl")
    opp = port(f, 1300, 750, "instruction_i[6:0]  (opcode)", 10)
    f.wire([opp["r"], (MX + 35, 750)], arrow=False)
    f.wire([(MX + 35, 750), (MX + 35, MY + MH - 6)], "data", bus="7", seg=0, lpos=0.5)
    oo = port(f, 1700, MY + MH / 2, "ex_immediate[31:0]  -> ID/EX", 11, color="#3b5bdb")
    f.wire([big["out"], oo["l"]], bus="32")
    f.note(60, 715, "The mux picks the input whose opcode label matches (left column).  'i' = instruction_i.", 10)


def part_b(f):
    f.region(20, 760, 2060, 920, "PART B - control decoder, register fields, exception logic, ID/EX pipeline register", "#3b5bdb")
    ins = port(f, 40, 850, "instruction_i[31:0]", 10, color="#3b5bdb")
    dec = f.comb(300, 800, 380, 340, "Control Decoder", sub="case on opcode / funct3 / funct7", showpins=False)
    f.wire([ins["r"], (300, 850)], bus="32")
    outs = [("alu_op[2:0]", "ADD SUB SLL SLT SLTU XOR SRL SRA OR AND", "#2e9d3a"),
            ("immediate_sel", "operand 2 = immediate?", "#2e9d3a"),
            ("mem_write", "store", "#2e9d3a"),
            ("mem_to_reg", "load result goes to register", "#2e9d3a"),
            ("branch", "branch / jal / jalr: PC redirect", "#2e9d3a"),
            ("width_select[1:0]", "byte / half / word", "#2e9d3a"),
            ("dst_reg_sel_valid", "instruction writes a register", "#2e9d3a"),
            ("lui_auipc", "special ALU paths", "#2e9d3a"),
            ("m_ext", "funct7 = 0000001 : MUL / DIV / REM (RV32M)", "#c0392b")]
    for i, (n, d, col) in enumerate(outs):
        y = 880 + i * 28
        p = port(f, 720, y, n, 9, color=col)
        f.wire([(680, y), p["l"]], "ctrl")
        f.text(720 + p["w"] + 10, y + 4, d, 9, anchor="start", color="#555")
    f.text(60, 1170, "Register fields are plain bit slices (no logic):", 11, anchor="start", weight="bold")
    for i, n in enumerate(["rs1_select = instruction_i[19:15]", "rs2_select = instruction_i[24:20]", "dst_reg_sel = instruction_i[11:7]"]):
        port(f, 60, 1200 + i * 34, n, 10)
    f.text(60, 1340, "Exception logic (ID/EX sketch):", 11, anchor="start", weight="bold")
    il = port(f, 60, 1380, "illegal_inst", 9, color="#c0392b")
    z = port(f, 60, 1420, "instruction_i == 0", 9, color="#c0392b")
    og = f.gate("or", 330, 1390, 40, 40)
    f.wire([il["r"], (290, 1380), (290, og["in1"][1]), og["in1"]], "ctrl")
    f.wire([z["r"], (300, 1420), (300, og["in2"][1]), og["in2"]], "ctrl")
    rn = port(f, 330, 1470, "reset_n", 9, color="#2e9d3a")
    an = f.gate("and", 470, 1400, 40, 40)
    f.wire([og["out"], (440, og["out"][1]), (440, an["in1"][1]), an["in1"]], "ctrl")
    f.wire([rn["r"], (450, 1470), (450, an["in2"][1]), an["in2"]], "ctrl")
    ex = port(f, 620, an["out"][1], "exception", 10, color="#c0392b")
    f.wire([an["out"], ex["l"]], "ctrl")
    f.text(60, 1530, "PC_w[31:0] from the sketch goes to the exception logic block that raises exception_pc\n(shown in the sketch as the OR-ed PC path into the ID/EX register).", 10, anchor="start", color="#555")
    r = f.seq(1150, 800, 440, 760, "ID -> EX Pipeline Register", ts=14,
              sub="captures on clk;  holds on stall;\nsync clear to NOP on reset / flush",
              L=("ctrl signals", "ex_immediate", "pc", "rs1_select", "rs2_select", "dst_reg_sel", "exception", "m_ext"),
              R=("ctrl_ex", "imm_ex", "pc_ex", "rs1_ex", "rs2_ex", "rd_ex", "exception_ex", "m_ext_ex"), pad=120)
    f.text(1150, 1590, "All outputs go to Fig P3 (operand select + ALU).  Reads of rs1/rs2 use the register file (Fig P4).", 11, anchor="start", color="#333")
