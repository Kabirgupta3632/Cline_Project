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

