# Report tables — Battle Tanks on Nexys A7

Derived from the rendered block diagrams only (Figs 1–12 and P0–P7); not an RTL implementation audit. **All implementation filenames below are proposed.** Replace them with your actual filenames before submission. These are design modules, not claims that each is implemented or newly authored. CPU wrappers and their submodules overlap hierarchically; do not count them twice in resource totals.

## 3. Module Summary (Table Only)

| Module | Purpose | File (proposed) | Software/Hardware module? |
|---|---|---|---|
| System top level (Fig 1) | Connect CPU, memories, MMIO, game peripherals and VGA | `battle_tanks_top.v` | Hardware (Verilog) |
| Clock/reset generator (Fig 1) | Derive system clock/pixel enable; synchronize reset | `clock_reset.v` + Clocking Wizard IP | Hardware (Verilog/IP) |
| RV32IM CPU wrapper (P0) | Three-stage IF/ID → EX → WB processor | `rv32im_core.v` | Hardware (Verilog) |
| Instruction fetch/PC control (P1) | PC update/hold, instruction-valid NOP selection and branch-flush tags | `fetch.v` | Hardware (Verilog) |
| Decode/immediate/exception/ID-EX (P2) | Decode RV32IM controls, construct immediates, flag illegal instructions and register EX inputs | `decode.v` | Hardware (Verilog) |
| Register file and forwarding (P4) | 32×32 registers, two read ports, WB forwarding and x0 forcing | `regfile.v` | Hardware (Verilog) |
| Operand selection and ALU (P3) | Arithmetic, shift, logic, compare and special result paths | `alu.v` | Hardware (Verilog) |
| Branch/next-PC and EX-WB (P5) | Branch comparison, jump target, squash gating and WB pipeline registers | `branch_writeback_pipe.v` | Hardware (Verilog) |
| Load/store and WB selection (P6) | Byte/halfword/word store lanes, load alignment/sign extension and result mux | `load_store_unit.v` | Hardware (Verilog) |
| RV32M multiplier (P7a) | One shared 33×33 signed multiplier for MUL/MULH/MULHSU/MULHU; pictured 1–2-clock options | `mul.v` | Hardware (Verilog/DSP) |
| RV32M divider/remainder (P7b) | 32-iteration DIV/DIVU/REM/REMU; zero/overflow bypass | `div_rem.v` | Hardware (Verilog) |
| RV32M integration (P7c) | Select MUL/DIV result; freeze pipeline and insert no-write bubbles while dividing | `rv32m_unit.v` | Hardware (Verilog) |
| Instruction memory (Fig 1) | Synchronous BRAM containing compiled CPU program | `instruction_memory.v` + `program.hex` | Hardware (BRAM wrapper; HEX initialization data) |
| Data memory (Fig 1) | BRAM for stack, globals, software game state and sin/cos table | `data_memory.v` | Hardware (BRAM/Verilog) |
| MMIO interconnect (Figs 2a/2b) | Address decode, peripheral write enables and registered-select read mux | `mmio_interconnect.v` | Hardware (Verilog) |
| Input controller (Fig 3) | Twelve two-FF synchronizers/debouncers; pack two read-only player inputs | `input_controller.v` | Hardware (Verilog) |
| Cooldown timers (Fig 4) | Shared 1-ms prescaler and four down-counters; trigger/status MMIO | `cooldown_timers.v` | Hardware (Verilog) |
| Sprite/HUD register bank (Fig 5) | Twelve 32-bit registers for tanks, eight bullets, angles and health | `sprite_registers.v` | Hardware (Verilog) |
| Collision engine wrapper (Figs 6a–6d) | Connect overlap matrices, wall scanner and sticky flags | `collision_engine.v` | Hardware (Verilog) |
| AABB overlap cell (Fig 6a) | Live-object X/Y overlap test; reused in 44 pair cells | `aabb_overlap.v` | Hardware (Verilog) |
| Bullet-wall scanner (Fig 6b) | Share one maze read port across eight bullet centres; align delayed hit identity | `bullet_wall_scan.v` | Hardware (Verilog) |
| Bullet collision matrices (Fig 6c) | 28 bullet-bullet and 16 bullet-tank tests; reduce hit masks | `collision_matrices.v` | Hardware (Verilog) |
| Sticky collision registers (Fig 6d) | Hold wall/pair/tank hits; W1C clearing and MMIO reads | `collision_flags.v` | Hardware (Verilog) |
| Mirrored maze RAM (Fig 7) | Two 400×2-bit dual-port copies; CPU writes both, VGA/collision read independently | `maze_ram.v` | Hardware (BRAM/Verilog) |
| VGA timing generator (Fig 8) | 800×525 total raster, 640×480 visible; coordinates, sync and active | `vga_timing.v` | Hardware (Verilog) |
| Sprite engine (Fig 9) | Per-pixel tests for two tanks/eight bullets; shape/valid combination | `sprite_engine.v` | Hardware (Verilog) |
| Tank shape ROM (Fig 9) | 16 angles ×20×20 one-bit shapes; two concurrent tank readers | `tank_sprite_rom.v` | Hardware (ROM/Verilog) |
| Bullet shape ROM (Fig 9) | 6×6 normal and 12×12 special masks; eight concurrent readers | `bullet_sprite_rom.v` | Hardware (ROM/Verilog) |
| Maze tile renderer (Fig 11) | 24-pixel tile counters, RAM address and registered wall/colour stream | `maze_renderer.v` | Hardware (Verilog) |
| Health HUD (Fig 12) | Two rows of 20 hearts; full/empty colour determined by health | `health_hud.v` | Hardware (Verilog) |
| Heart shape ROM (Fig 12) | Shared 8×8 one-bit heart mask | `heart_rom.v` | Hardware (ROM/Verilog) |
| Pixel mixer/output register (Fig 10) | Priority HUD > big bullet > bullet > tank > wall > background; blank and RGB444 | `pixel_mixer.v` | Hardware (Verilog) |
| Sync/blank delay (Fig 10) | Delay active/sync controls alongside rendered pixels | `video_sync_delay.v` | Hardware (Verilog) |
| Game software (Fig 1) | Poll inputs; move/aim; spawn/advance/reflect bullets; handle damage/cancellation; update registers; game-over/respawn and maze setup | `game.c` | Software (C running on FPGA RV32IM CPU) |

## 4. Hardware Resource Estimates

**Pre-synthesis planning estimates, not measured Vivado utilization.** Nexys A7 has 100T and 50T variants; choose the table matching your FPGA marking or Vivado target. Do not substitute advertised "logic cells" for LUTs. BRAM below uses **36-Kib-equivalent Block RAM Tiles**, the unit in Vivado's summary, not bytes or external DDR memory.

### Nexys A7-100T — XC7A100T

| Resource | Maximum Available | Estimated Usage | % utilization |
|---|---:|---:|---:|
| BRAM (36-Kib-equivalent tiles) | 135 (270 ×18-Kib blocks) | ≈24 | ≈17.78% |
| DSP blocks (DSP48E1) | 240 | ≈4 | ≈1.67% |
| LUTs (6-input) | 63,400 | ≈8,000 | ≈12.62% |
| FF | 126,800 | ≈3,000 | ≈2.37% |

### Nexys A7-50T — XC7A50T

| Resource | Maximum Available | Estimated Usage | % utilization |
|---|---:|---:|---:|
| BRAM (36-Kib-equivalent tiles) | 75 (150 ×18-Kib blocks) | ≈24 | ≈32.00% |
| DSP blocks (DSP48E1) | 120 | ≈4 | ≈3.33% |
| LUTs (6-input) | 32,600 | ≈8,000 | ≈24.54% |
| FF | 65,200 | ≈3,000 | ≈4.60% |

If your table uses18-Kib blocks instead: maximum270 / usage48 for100T, maximum150 / usage48 for50T; percentages unchanged. 48 is an equivalent count, not a prediction of the exact primitive mixture.

### Assumptions and basis — include this note with the resource table

- **Memory sizes are NOT in Fig1.** Assume **64 KiB instruction BRAM +16 KiB data BRAM**, 32-bit words. At common1024×32 RAMB36 configuration, instruction memory takes16 tiles and data4: **20 total**. These are provisional budgets; adjust to the compiled program/linker map.
- Fig7 has two **400×2-bit maze copies**. Allocate one RAMB18 to each =1 RAMB36 equivalent. They cannot be collapsed to one single-port RAM just because the data is small.
- Fig9 has **16×20×20=6,400 bits** of tank-mask data; padded angle/dy/dx addressing can use16,384 bits. Allocate two RAMB18 instances for simultaneous tanks =1 RAMB36 equivalent. Shared true-dual-port ROM could instead serve both tanks in one RAMB18. Small bullet/heart ROMs are assumed LUT ROM, replicated for eight bullet readers; counted in LUT estimate.
- Base:20 CPU memory +1 maze +1 tank ROM =**22 equivalents**; add2 planning tiles for mapping/layout uncertainty =**24 budget**, not exact physical usage. No framebuffer, cache, DDR controller, ILA/debug core, or FPGA-to-laptop transport is shown/included. VGA renders per pixel. Added features need new estimates.
- P7a has **one33×33 multiplier**, not one per MUL variant. Four DSP48E1 slices is a reasonable initial25×18 primitive decomposition with LUT combining logic; reserve **4–6 DSP** until synthesis. P7b is shift/subtract division, not a DSP multiplier. C arithmetic shares CPU hardware. Wall conversion by constant683 assumed LUT shift/add; if inferred into DSPs, add utilization.
- LUT budget:CPU (FF-register-file muxes, ALU/control/divider) ≈3,200; collision≈3,000; video/ROM≈1,000; other MMIO/input/timer/register glue≈800 → **8,000**. Fig6a estimates≈60 LUT/cell ×44 =2,640 before optimization. Shared endpoints can reduce this; carry/mux/timing replication can increase it. This is heuristic, not mapped usage.
- FF basis:CPU register file≈1,024 (992 with x0 optimized out); input12×(20+2+1)=276; cooldown4×15+17=77; sprite bank12×32=384 before unused-bit pruning. Subtotal≈1,761, plus pipeline/divider state, collision delays/sticky bits and video registers. **3,000 FF** is a rounded budget; constant/unused fields may disappear.
- Broad planning ranges: **LUT6,000–12,000; FF2,500–4,500; DSP4–6**. BRAM depends mainly on memory sizes, ROM inference/read-port replication. Each extra4 KiB of32-bit CPU memory typically adds one RAMB36 at1024×32.
- Final numbers require **Vivado `report_utilization`** for the actual part after synthesis/implementation. Fit does not establish timing closure. Your diagrams show substantial hardware contribution, but list only actually implemented/modified modules as completed original work.

### Capacity references

- AMD **DS180 Table4**:100T =135 RAMB36 /240 DSP /15,850 slices;50T =75 RAMB36 /120 DSP /8,150 slices. [Official PDF](https://docs.amd.com/api/khub/documents/2LByHkO~nSZXcei2D55fTg/content).
- AMD **UG474**:4 LUT/8 FF per slice; exact100T counts63,400/126,800 and50T counts32,600/65,200. [Official table](https://docs.amd.com/r/en-US/ug474_7Series_CLB/7-Series-FPGA-CLB-Resources).
- [Nexys A7 manual](https://digilent.com/reference/programmable-logic/nexys-a7/reference-manual): verify board variant. Also verify input wiring: twelve game buttons may require an external keypad/controller.

