from h import *

RED = "#c0392b"


def build():
    f = Fig(2000, 1420, "Fig P7a - RV32M (1/2): multiplier unit (MUL / MULH / MULHSU / MULHU)",
            "One 33 x 33 signed multiplier covers all four variants: bit 32 of each operand = operand[31] AND 'operand is signed'.  Maps onto DSP48 slices.")
    # ---------------------------------------------------------------- A
    f.region(20, 90, 1960, 400, "PART A - which operands are signed?  (funct3 decode)", RED)
    f1 = port(f, 40, 170, "funct3[1]", 10, color="#2e9d3a")
    f0 = port(f, 40, 270, "funct3[0]", 10, color="#2e9d3a")
    X = 160
    f.wire([f1["r"], (X, 170)], "ctrl", arrow=False); f.dot((X, 170), "ctrl")
    n1 = f.gate("not", 260, 156, 30, 28)
    f.wire([(X, 170), n1["in"]], "ctrl")
    sb = port(f, 420, n1["out"][1], "signedB = ~funct3[1]", 10, color="#2e9d3a")
    f.wire([n1["out"], sb["l"]], "ctrl")
    na = f.gate("nand", 260, 240, 40, 40)
    f.wire([(X, 170), (X, na["in1"][1]), na["in1"]], "ctrl")
    f.wire([f0["r"], (230, 270), (230, na["in2"][1]), na["in2"]], "ctrl")
    sa = port(f, 420, na["out"][1], "signedA = ~(funct3[1] & funct3[0])", 10, color="#2e9d3a")
    f.wire([na["out"], sa["l"]], "ctrl")
    f.text(40, 350, "funct3:  000 MUL   001 MULH (signed x signed)   010 MULHSU (signed x unsigned)   011 MULHU (unsigned x unsigned)", 11, anchor="start", color="#333")
    f.text(40, 375, "MUL returns the low 32 bits, identical for signed and unsigned, so its sign choice is irrelevant.", 10, anchor="start", color="#555")
    f.text(40, 400, "signedA = 0 only for MULHU;   signedB = 0 for MULHSU and MULHU.", 10, anchor="start", color="#555")
    # ---------------------------------------------------------------- B
    f.region(20, 510, 1960, 520, "PART B - extend both operands to 33 bits and multiply", RED)
    mul = f.comb(900, 560, 340, 330, "33 x 33 signed multiplier", sub="product = A33 * B33  (66 bits)\n1 clk (DSP48) or 2-clk pipelined", ts=13,
                 L=("A33[32:0]", "B33[32:0]"), R=("product[65:0]",), pad=130)
    a = port(f, 40, 600, "alu_operand1[31:0]", 10, color="#3b5bdb")
    b = port(f, 40, 820, "alu_operand2[31:0]", 10, color="#3b5bdb")
    a31 = port(f, 260, 640, "A[31]", 9, w=46); b31 = port(f, 260, 860, "B[31]", 9, w=46)
    spa = port(f, 260, 690, "signedA", 9, w=60, color="#2e9d3a"); spb = port(f, 260, 910, "signedB", 9, w=60, color="#2e9d3a")
    ga = f.gate("and", 460, 650, 40, 40); gb = f.gate("and", 460, 870, 40, 40)
    f.wire([a31["r"], (420, 640), (420, ga["in1"][1]), ga["in1"]]); f.wire([spa["r"], (430, 690), (430, ga["in2"][1]), ga["in2"]], "ctrl")
    f.wire([b31["r"], (420, 860), (420, gb["in1"][1]), gb["in1"]]); f.wire([spb["r"], (430, 910), (430, gb["in2"][1]), gb["in2"]], "ctrl")
    # concatenation boxes
    ca = f.comb(620, 600, 200, 120, "{ ext, A[31:0] }", sub="bit 32 = A[31]&signedA", ts=11, L=("ext", "A"), R=("A33",), pad=60)
    cb = f.comb(620, 820, 200, 120, "{ ext, B[31:0] }", sub="bit 32 = B[31]&signedB", ts=11, L=("ext", "B"), R=("B33",), pad=60)
    f.wire([ga["out"], (590, ga["out"][1]), (590, ca["ext"][1]), ca["ext"]])
    f.wire([a["r"], (560, 600), (560, ca["A"][1]), ca["A"]], "data", bus="32")
    f.wire([gb["out"], (590, gb["out"][1]), (590, cb["ext"][1]), cb["ext"]])
    f.wire([b["r"], (560, 820), (560, cb["B"][1]), cb["B"]], "data", bus="32")
    f.wire([ca["A33"], (860, ca["A33"][1]), (860, mul["A33[32:0]"][1]), mul["A33[32:0]"]], bus="33")
    f.wire([cb["B33"], (870, cb["B33"][1]), (870, mul["B33[32:0]"][1]), mul["B33[32:0]"]], bus="33")
    pr = port(f, 1320, mul["product[65:0]"][1], "product[65:0]", 10, color=RED)
    f.wire([mul["product[65:0]"], pr["l"]], bus="66")
    # ---------------------------------------------------------------- C
    f.region(20, 1050, 1960, 340, "PART C - pick low / high half  (funct3[1:0] = 00 -> MUL low word;  01, 10, 11 -> high word)", RED)
    pi = port(f, 40, 1130, "product[65:0]", 10, color=RED)
    mx = f.mux(560, 1100, 100, ins=("0 low", "1 high"), sel=None, w=50)
    lo = port(f, 330, mx["0 low"][1], "product[31:0]", 9, w=100); hi = port(f, 330, mx["1 high"][1], "product[63:32]", 9, w=110)
    f.wire([lo["r"], mx["0 low"]]); f.wire([hi["r"], mx["1 high"]])
    f.wire([pi["r"], (200, 1130)], arrow=False)
    n = f.gate("or", 260, 1240, 40, 36)
    g1 = port(f, 40, 1250, "funct3[1]", 9, color="#2e9d3a"); g0 = port(f, 40, 1290, "funct3[0]", 9, color="#2e9d3a")
    f.wire([g1["r"], (230, 1250), (230, n["in1"][1]), n["in1"]], "ctrl"); f.wire([g0["r"], (240, 1290), (240, n["in2"][1]), n["in2"]], "ctrl")
    hs = port(f, 360, n["out"][1], "high_sel = funct3[1] | funct3[0]", 9, color="#2e9d3a")
    f.wire([n["out"], hs["l"]], "ctrl")
    f.wire([(hs["r"][0], hs["r"][1]), (585, hs["r"][1]), (585, 1100 + 100 - 7)], "ctrl")
    mo = port(f, 760, mx["out"][1], "mul_result[31:0]  -> Fig P7b result select", 11, color=RED)
    f.wire([mx["out"], mo["l"]], bus="32")
    return f
