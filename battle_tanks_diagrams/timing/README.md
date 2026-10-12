# Battle Tanks — timing diagrams derived from block diagrams only

## Scope and reading convention

Only the rendered block diagrams in `../out/` were analysed: Figs 1–12 and P0–P7. No RTL, C program, or diagram-generator code was used as a source of timing behaviour. These are **illustrative test scenarios, not measured simulation waveforms**. Stimulus and assumptions below are necessary because the diagrams do not specify a complete executable program or every control edge.

The sheets follow the supplied photograph: clock at top, numbered cycle columns, boxed bus values, square high/low control waveforms. A column is the interval immediately after its left rising edge. Registered results of activity in column n appear in column n+1. `—` means irrelevant/not consumed, not an electrical unknown; `NOP` is a real bubble/no-side-effect instruction. Numbers are decimal unless prefixed `0x`; masks and RGB values are hexadecimal. Register writes take effect at the right-hand edge of their column.

**There is no honest, exhaustive, continuous <30-clock trace of this system.** P7b alone requires 32 divider iterations; debounce takes about 500,000 clocks at the pictured 50 MHz assumption; cooldown takes 500 ms or 20 s. Each sheet has fewer than 30 visible columns. Sheets with `//` gaps contain explicitly separated time windows, NOT a faster implementation. The CPU and collision sheets are continuous 28-clock examples. The sheets are independent tests, not successive portions of one 28-clock game run. Cases are representative coverage, not exhaustive verification of every instruction, geometry, or simultaneous event.

## Important diagram findings and chosen conventions

1. **FPGA computes and renders the game.** Fig 1 contains an RV32IM CPU and VGA connector, not a host-link/game protocol. A laptop generally cannot accept VGA video directly; a suitable capture interface is needed, or a separately designed FPGA-to-laptop link. None is invented here. The depicted second tank is P2; autonomous enemy AI is not specified.
2. **Reflection and damage are software actions.** Fig 6b scans bullet centres; Fig 6c compares live AABBs; Fig 6d latches flags. No hardware `reflect`, velocity, damage, or game-over signal is drawn. Such annotations in the sheets are labelled `sw.*` or test stimulus.
3. **Collision sticky bits are clear-dominant:** `q_next = (q | set) & ~clear` (Fig 6d). A persisting collision can set the flag again after a clear. Writing zero cannot clear it. Bullet-bullet sets both involved bits; inactive bullets are excluded. HIT_MASK packs bullet bits [7:0] and tank bits [9:8]. No ownership bit prevents self-hits.
4. **Wall scan takes two clocks to reach `wall_set`.** The tile-address register and synchronous RAM each add one clock. `scan_d` and `act_d` must match that delay. The sticky bit changes on the following edge. Scanning eight slots does NOT mean a given slot's flag appears immediately or that reflection is automatic. Wall testing is centre-tile sampling, not swept collision or a wall-normal calculation.
5. **MMIO read selects are delayed one clock** (Fig 2b). The sheets assume the low address bits/selected word are held through response consumption; Fig 3/6d show combinational word selection, not a separately registered word address. Stores commit once; read completion does not write a peripheral.
6. **CPU assumptions:** one-cycle synchronous instruction-memory latency, execution-stage register reads with WB forwarding, one wait column for each data read, then a qualified single write-back. IF/ID contains the instruction returned from the preceding fetch PC. On a read wait, PC/IF/ID/ID/EX/EX-WB hold; the held EX instruction has no side effect until release. This is a selected convention, not a uniquely specified implementation.
7. **Branch assumptions:** two younger instructions from the BRAM fetch stream get squash tags. Their register/store/branch effects are suppressed; target instructions are not suppressed. P1's `upd_en`, NOP-mux polarity and P5/P6's EX-versus-WB squash alignment are inconsistent/ambiguous, so literal gate-level branch penalty and combined stall/flush timing cannot be certified. Squash pulses shown are aligned tags under this convention.
8. **Store-path assumption:** effective address = rs1 + immediate, store payload = forwarded rs2, captured separately. P3/P5 label the same ALU operand/result inconsistently for these roles. Byte-lane behaviour follows P6; MMIO is word-only and ignores byte strobes (Fig 2a).
9. **M unit:** select the pictured one-clock multiplier option. Normal DIV/REM uses a start edge, 32 busy iteration edges, a registered done cycle and one WB cycle. P7b special cases bypass iteration: division by zero returns all ones, remainder by zero returns the dividend; signed INT_MIN / -1 returns INT_MIN and remainder zero, without an exception.
10. **Display convention:** use a 50 MHz `clk_sys` and alternating `pix_ce` (25 MHz), consistent with Figs 3/4. Fig 8's frame calculation instead assumes 100 MHz and four clocks/pixel. If your actual system uses 100 MHz, change enable spacing to four. Positive sync-window flags are named `hs_win_q`/`vs_win_q`, delayed three FFs and inverted exactly once at the connector, following Fig 10. Fig 8's polarity annotations are conflicting.
11. **Display latency caveat:** mixer-source tests use already aligned input streams. Fig 10's literal active chain gives `active_d[n] = active_q[n-3]`, and the final RGB register consumes `active_d` one clock later. Sync has only the three shown FFs. This reveals a potential one-clock blank/RGB versus sync alignment discrepancy; the drawings do not establish a fully aligned coordinate-to-connector pipeline. Boundary sheets show that convention, not a claimed fix. Tile restart must be qualified by `pix_ce & h_end`; Fig 11's unqualified X restart can reset early while the pixel counter holds.

## Deliverables

- **`out/battle_tanks_timing.pdf`** — all sheets plus assumptions, instruction key, case explanations and signal definitions.
- **`index.html`** — browser viewer; **`out/*.png`** — images; **`out/*.svg`** — scalable versions.
- **`SIGNALS.md`** — explanation and source figure for **every plotted signal**.
- **`out/timing_values.json`** — exact per-column values.

### Sheet guide

| Sheet | Important cases | Columns |
|---|---|---:|
| A: CPU pipeline | Reset; add/MUL/logic/shift/compare; both forwarding ports; load waits; taken/not-taken branch; squash blocks wrong-path writes; MMIO; SB | 28 continuous |
| B: RV32M | Normal DIV stall/start/busy/done/single commit; zero-divisor DIV/REM; signed overflow DIV/REM | 24, with 20 clocks omitted |
| C: Collisions | Wall/floor; inactive suppression; normal/special tank hit; bullet pair; sticky hold; clear wins set; re-latch; software reflection/removal/health | 28 continuous test clocks |
| D: Input/timers | Bounce; 2-FF synchronization; accepted press/release; poll return; trigger/tick priority; busy retrigger; hold; expiry/ready | 28, separated windows |
| E: Pixel mixer | All priorities; P2-over-P1 colour; full/empty hearts; transparent fallback; blank overrides live layers; RGB register | 28 continuous input-test clocks |
| F: Horizontal VGA | Visible blank; HS low/high; line wrap; enable hold; delayed sync/blank | 28, four windows |
| G: Vertical VGA | Visible blank; VS low/high; frame wrap; enabled line-end increments | 28, four windows |
| H: Memory/render | Mirrored maze write/read; tile boundary24; RAM/output delays; bullet ROM/activity delay; heart colour/valid pipeline | 28, four windows |
| I: CPU corners | LB/LBU/LH/LHU; SH lanes; x0 reads; JALR low-bit clearing; illegal/zero exception detect/reset qualifier | 28, seven tests |

## Sheet A: illustrative instruction key

Invented to exercise the **pictured hardware**, not recovered from game code. Decimal PC is an instruction address. Initial x10=0x100, x11=0x80000000; RAM[0x100]=32; P1 input=0x10. Other consumed initial registers zero.

| Label | PC | Instruction | Purpose / result |
|---|---:|---|---|
| A | 0 | `addi x1,x0,10` | x1=10 |
| B | 4 | `add x2,x1,x1` | Both ports forward A; x2=20 |
| C | 8 | `lw x3,0(x10)` | Request6, return/commit7; x3=32 |
| D | 12 | `add x4,x3,x2` | Held at6; load forwarded7; x4=52 |
| E | 16 | `sw x4,4(x10)` | Forward D payload; write52 at WB9 |
| F | 20 | `mul x5,x1,x2` | x5=200; one-clock multiplier |
| G | 24 | `bne x1,x1,+40` | NOT taken |
| H | 28 | `beq x5,x5,+36` | Taken EX11; fetch target64 at12 |
| J | 32 | `sw x5,64(x11)` | Wrong-path store MUST NOT occur |
| K | 36 | `addi x6,x0,99` | Wrong-path register write MUST NOT occur |
| L | 64 | `sw x1,20(x11)` | TIMER_TRIGGER=0xA, both special channels |
| M | 68 | `lw x7,0(x11)` | Input request16/return17; x7=16 |
| N | 72 | `addi x8,x7,0` | Held16; input forwarded17; x8=16 |
| O | 76 | `sb x8,1(x10)` | Byte0x10 into lane1; strobe0010 |
| P | 80 | `addi x9,x0,-1` | x9=0xFFFFFFFF |
| Q | 84 | `slt x12,x9,x0` | Signed -1<0 gives1 |
| R | 88 | `or x13,x1,x2` | 10 OR20 =30 |
| S | 92 | `sw x0,72(x11)` | Bullet0 inactive |
| T | 96 | `lui x14,0x12345` | x14=0x12345000 |
| U | 100 | `srai x15,x9,4` | -1 remains -1 |
| V | 104 | `xor x16,x0,x0` | x16=0 |
| W | 108 | `sw x5,64(x11)` | Correct-path P1 position value200 |

IF/ID follows fetch PC by one column. Taken EX11 still leaves K (BRAM return of PC36) in IF/ID12. J/K effects are suppressed; target L executes14. Load completion qualification is assumed: a held raw write-enable must not commit invalid data repeatedly.


## Sheet C: important transitions

- **Wall:** scan slot0 at0 → wall_set2 → sticky WALL_MASK3. Clear5 removes it at6; later scan re-detects10. Software flips its stored velocity and writes an outside-wall position13; scan16 returns floor18. Final clear14 stays clear. Hardware detects a non-floor centre tile, **not wall orientation**. This test assumes a vertical wall. Horizontal reflection would flip vy; corner/oblique response needs a software policy not shown.
- **Normal hit:** bullet3 overlaps P2 during6–10 → HIT_MASK=0x208 at7. Clear8 wins one edge, then overlap re-latches10. Software removes bullet10, writes health19 at11 (visible12), clears12. Separation before final acknowledgement avoids re-latching and repeated damage.
- **Bullet pair:** bullets1/2 overlap15–18 → BB_MASK=0x06 at16. Clear16 wins; re-latches18. Removed by writes18/19; clear20 persists.
- **Special hit:** big bullet4 overlaps P1 during21–23 → HIT_MASK=0x110 at22. Removed23, P1 health15 written24 (visible25), cleared26. Five-point damage is a CPU-requested health write, not collision arithmetic.
- **Self-hit:** no ownership field; a reflected live bullet overlapping its own tank has the same hit timing. Fig6c treats tanks as active even at software health zero.

## Limits: cases that cannot be reconstructed

The diagrams do not specify enemy AI, bullet velocity registers, actual instruction order, aim updates, full-slot policy, bullet lifetime counters, game-over/respawn FSM, health clamp, wall-normal/corner reflection, or exception-handler timing. Health=0 uses the same Fig5 register write as other health values, but no hardware `game_over` signal exists in these drawings. No-ready firing/full slots/lifetime are software decisions not to write an active bullet (or to write act=0). Hardware reloads a cooldown on any trigger regardless of ready.

AABB uses strict overlap: mere edge touching is not a hit; act=0 suppresses hits. No swept collision prevents tunnelling; centre-wall sampling may miss a bullet edge touching a neighbouring tile. Several collision types can set independent masks simultaneously. Software ordering/duplicate damage is unspecified. HIT_MASK aggregates bullets and tanks, not each bullet→tank pairing, so multiple hits can need extra bookkeeping.

RAM reset contents and same-address cross-port read/write modes are unspecified. ROM bits cannot be inferred. Reset/stall priority, flush-chain enable, stalled branches, and exception recovery need RTL confirmation. W1C semantics are clear for the event masks used here; aggregate0x20 clear mapping is not fully drawn. These are representative cases, not exhaustive program verification.

## Reproduce and check

`python3 make_timing.py` generates SVG/JSON/signal definitions/HTML with the Python standard library. `python3 test_timing.py` checks cycle lengths, CPU sequencing, write qualification, real divider count, scan delay, sticky priority, debounce, timers, VGA recurrences and rendering pipelines. These check **our diagram data**, not RTL.

PNG: `node export_png.cjs /path/to/@resvg/resvg-js /path/to/font.ttf`. PDF (Pillow + ReportLab required): `python3 export_pdf.py`. Prebuilt outputs are included, so no installation is needed to view them.

