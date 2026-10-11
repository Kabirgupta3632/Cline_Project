# Battle Tanks - block diagrams (gate level, split into figures)

All files are in `out/` (PNG + SVG). Generator code is in `src/` (Python -> SVG, `render.mjs` -> PNG).

| Fig | Content | Status |
|---|---|---|
| 1 | Top-level system overview (updated to match the fixes) | checked |
| 2a | MMIO interconnect: address decode + write enables | checked |
| 2b | MMIO interconnect: registered-select AND-OR read mux | checked |
| 3 | Input controller: 2-FF sync, debouncer, packing, read mux | checked |
| 4 | Cooldown timers: 1 ms prescaler, down-counter, trigger decode, status | checked |
| 5 | Sprite & HUD register file (12 regs) | checked |
| 6a | Collision: AABB overlap cell | checked |
| 6b | Collision: single-port wall scan | checked |
| 6c | Collision: bullet-bullet matrix, bullet-tank cells | checked |
| 6d | Collision: sticky W1C registers + read path | checked |
| 7 | Maze RAM: two mirrored dual-port BRAMs | checked |
| 8 | VGA timing generator | checked |
| 9 | Sprite engine (tank / bullet cells, combine) | checked |
| 10 | Pixel priority mixer + sync delay line | rendered, NOT visually reviewed |

## Not drawn yet
- RV32IM pipeline stages (IF/ID, EX, MUL/DIV unit, WB/LSU) - Fig 1 still shows the core as one box.
- Fig 11 (maze tile renderer) and Fig 12 (health HUD). Figs 7, 9 and 10 refer to them by number.

## Design choices not given in the project spec (change to match your RTL)
24 px tiles, 2-bit tile code, 16 tank angles, 8 bullet slots, 12-bit RGB, 1 ms timer prescaler,
50 MHz clock assumption in notes, data memory at 0x0000_0000, addr[31] = MMIO window,
extra registers TANK_ANGLE_REG 0x84 and collision masks 0x24..0x2C.
