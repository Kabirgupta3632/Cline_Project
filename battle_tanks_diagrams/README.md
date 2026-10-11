# Battle Tanks - block diagrams (gate level, split into figures)

All files are in `out/` (PNG + SVG). Generator code is in `src/` (Python -> SVG; `render.mjs` -> PNG).
Regenerate one figure:  `python3 -c "import fig5_sprregs as m; m.build().save('x.svg')"`  then  `node render.mjs x.svg`.
(`render.mjs` expects `@resvg/resvg-js` and `dejavu-fonts-ttf` under `/tmp/r/node_modules` - edit the paths for your machine.)

## Figures

### System / peripherals
| Fig | Content |
|---|---|
| 1 | Top-level system overview |
| 2a | MMIO interconnect: address decode + write enables |
| 2b | MMIO interconnect: registered-select AND-OR read mux (no tri-state bus) |
| 3 | Input controller: 2-FF sync, debouncer, packing, read mux |
| 4 | Cooldown timers: 1 ms prescaler, down-counter channel, trigger decode, status |
| 5 | Sprite & HUD register file (12 write-only registers) |
| 6a-6d | Collision engine: AABB cell, single-port wall scan, bullet-bullet / bullet-tank matrices, sticky W1C masks |
| 7 | Maze RAM as two mirrored dual-port BRAMs |
| 8 | VGA timing generator |
| 9 | Sprite engine (tank / bullet cells, combine) |
| 10 | Pixel priority mixer + sync delay line |
| 11 | Maze tile renderer |
| 12 | Health HUD |

### CPU pipeline (RV32IM, 3 stages)
| Fig | Content |
|---|---|
| P0 | Pipeline overview: how P1-P7 connect |
| P1 | IF: PC register, NOP muxes, branch-flush shift register |
| P2 | ID: immediate generator (opcode mux), decoder, exception logic, ID/EX register |
| P3 | EX: operand select, ALU core with 8:1 result mux |
| P4 | Register file, write-back forwarding muxes, x0 forcing |
| P5 | EX: branch comparator, next-PC logic, branch stall, EX/WB register |
| P6 | WB: store byte-lane / byte-enable muxes, load align + sign-extend, result mux |
| P7a | RV32M multiplier (MUL / MULH / MULHSU / MULHU) |
| P7b | RV32M iterative divider, divide-by-zero / overflow, stall FSM |
| P7c | RV32M integration into the ALU result mux and stall / bubble control |

## How these were checked (and what was NOT)
The image viewer in my environment rejected the rendered PNGs from Fig 10 onward, so those figures were NOT looked at by eye.
`src/lint.py` was used instead; it checks for text-on-text overlap, wires through labels, arrows ending in empty space, and mux inputs
with no wire. Remaining lint notes are mostly a label sitting on the wire it names (intended). **Please open every figure from 10 on
(10, 11, 12, P0-P7) and look at it before putting it in a report.**

## Things to verify against your RTL
The pipeline figures (P1-P6) were drawn from your sketches, but several details were not legible and are my reading:
- Polarity / inputs of the NOP-insert and hold muxes in P1 (`upd_en` expression).
- Forward-mux polarity in P4, and exact funct3 -> branch condition map in P5.
- Which squash bits gate which write enables in P5 / P6.
System-level choices not in the project spec: 24 px tiles, 2-bit tile code, 16 tank angles, 8 bullet slots, 12-bit RGB, 1 ms timer
prescaler, 50 MHz clock assumption, data memory at 0x0000_0000 with addr[31] = MMIO, extra registers TANK_ANGLE_REG 0x84 and
collision masks 0x24..0x2C, 8x8 hearts in a strip at x = 480..639.
Figure P7b uses a restoring divider (32 clocks); P7a uses one 33x33 signed multiplier for all four variants.
