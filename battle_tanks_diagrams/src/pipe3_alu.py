from h import *


def build():
    f = Fig(2000, 1500, "Fig P3 - Pipeline Stage 2 (EX): operand select and ALU core with 8:1 result mux",
            "From your 'ALU Operand Selection' and 'ALU Core + Supported Operations' sketches.  Operand 1 needs no mux; operand 2 = register or immediate.")
    f.region(20, 90, 1960, 200, "PART A - ALU operand selection", "#3b5bdb")
    r1 = port(f, 40, 150, "reg_rdata1[31:0]", 10)
    o1 = port(f, 700, 150, "alu_operand1[31:0]", 10, color="#3b5bdb")
    f.wire([r1["r"], o1["l"]], bus="32", label="no mux needed", ldy=-2)
    r2 = port(f, 40, 210, "reg_rdata2[31:0]", 10)
    im = port(f, 40, 255, "execute_imm[31:0]", 10)
    mx = f.mux(300, 190, 90, ins=("0", "1"), sel="immediate_sel", w=40)
    f.wire([r2["r"], (260, 210), (260, mx["0"][1]), mx["0"]], bus="32")
    f.wire([im["r"], (270, 255), (270, mx["1"][1]), mx["1"]], bus="32")
    o2 = port(f, 700, mx["out"][1], "alu_operand2[31:0]", 10, color="#3b5bdb")
    f.wire([mx["out"], o2["l"]], bus="32")
    f.region(20, 310, 1960, 1170, "PART B - ALU core: five parallel units + special paths, 8:1 result mux", "#3b5bdb")
    a = port(f, 40, 380, "alu_operand1[31:0]", 10, color="#3b5bdb"); b = port(f, 40, 420, "alu_operand2[31:0]", 10, color="#3b5bdb")
    RA, RB = 250, 280
    f.wire([a["r"], (RA, 380)], arrow=False); f.wire([b["r"], (RB, 420)], arrow=False)
    f.dot((RA, 380)); f.dot((RB, 420))
    units = [
        ("Adder / Subtractor", "sub_sel ? A - B : A + B", "add_sub_result", ["alu_sub (add/sub select)"]),
        ("Shift Unit", "SLL: A << B[4:0]   SRL: A >> B[4:0]   SRA: A >>> B[4:0]", "shift_result", ["alu_arith (SRA vs SRL)"]),
        ("Logic Unit", "AND  OR  XOR", "logic_result", ["alu_op[1:0]"]),
        ("Compare (SLT / SLTU)", "SLT : signed(A) < signed(B)    SLTU : A < B", "slt_result", ["unsigned?"]),
        ("MUL / DIV unit (RV32M)", "MUL MULH MULHSU MULHU DIV DIVU REM REMU", "m_result", ["m_ext (Fig P5)"]),
    ]
    ys = []
    for i, (nm, rule, out, ctl) in enumerate(units):
        y = 360 + i * 130
        col = "#c0392b" if "RV32M" in nm else "#000"
        u = f.comb(380, y, 640, 90, nm, sub=rule, ts=13, showpins=False, tcolor=col, stroke=col)
        f.wire([(RA, y + 28), (380, y + 28)]); f.dot((RA, y + 28))
        f.wire([(RB, y + 60), (380, y + 60)]); f.dot((RB, y + 60))
        cp = port(f, 540, y - 30 if False else y + 100, ctl[0], 9, color="#2e9d3a")
        f.wire([(cp["t"][0], cp["t"][1]), (cp["t"][0], y + 90)], "ctrl", arrow=True)
        po = port(f, 1060, y + 45, out + "[31:0]", 10, color="#3b5bdb")
        f.wire([(1020, y + 45), po["l"]], bus="32")
        ys.append(y + 45)
    busline(f, RA, 380, 360 + 4 * 130 + 28, "data", 3); busline(f, RB, 420, 360 + 4 * 130 + 60, "data", 3)
    y = 360 + 5 * 130
    sp = f.comb(380, y, 640, 90, "Special paths", sub="LUI: execute_imm   JAL/JALR: PC + 4 (link)   STORE: alu_operand2", ts=13, showpins=False)
    pc = port(f, 40, y + 28, "PC[31:0]", 10); ei = port(f, 40, y + 62, "execute_imm[31:0]", 10)
    f.wire([pc["r"], (380, y + 28)]); f.wire([ei["r"], (380, y + 62)])
    f.wire([(RB, y + 62 - 0), (RB, y + 62)][:1] + [(RB, y + 75), (380, y + 75)]) if False else None
    po = port(f, 1060, y + 45, "special_result[31:0]", 10, color="#3b5bdb"); f.wire([(1020, y + 45), po["l"]], bus="32")
    ys.append(y + 45)
    # 8:1 result mux (6 used inputs + 2 spare)
    rm = f.mux(1500, 380, 700, ins=("0 add/sub", "1 shift", "2 logic", "3 slt", "4 m_result", "5 special", "6 spare", "7 spare"), sel=None, w=70)
    names = ["add_sub_result", "shift_result", "logic_result", "slt_result", "m_result", "special_result"]
    for i, n in enumerate(names):
        key = list(rm.p.keys())[i]
        w0 = tw(n + "[31:0]", 10)
        f.wire([(1060 + w0, ys[i]), (1200 + i * 25, ys[i]), (1200 + i * 25, rm[key][1]), rm[key]], bus="32", seg=0, lpos=0.5) if False else f.wire([(1060 + w0, ys[i]), (1230 + i * 22, ys[i]), (1230 + i * 22, rm[key][1]), rm[key]])
    for k in ("6 spare", "7 spare"):
        zp = port(f, 1380, rm[k][1], "32'h0", 9, w=44)
        f.wire([zp["r"], rm[k]])
    dc = f.comb(1450, 1300, 200, 120, "ALU Operation Decoder", sub="alu_op[2:0] + lui / auipc /\njal / jalr / mem_write", ts=11, showpins=False)
    f.wire([(1550, 1300), (1535, 1080 + 0), (1535, 1075)][:1] + [(1535, 1075 + 0)][:0] + [(1535, 1300 - 0)][:0] + [(1535, 1300)], "ctrl", arrow=False) if False else None
    f.wire([(1535, 1300), (1535, 1078)], "ctrl", label="select[2:0]", seg=0, ldx=14)
    ro = port(f, 1700, rm["out"][1], "ex_result[31:0]", 11, color="#3b5bdb")
    f.wire([rm["out"], ro["l"]], bus="32")
    return f
