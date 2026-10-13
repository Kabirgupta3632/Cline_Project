const pptxgen = require('pptxgenjs');
const fs = require('fs');
const D = '/workspace/battle_tanks_diagrams/';
const timing = JSON.parse(fs.readFileSync(D + 'timing/out/timing_values.json'))[0];

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pptx.title = 'Battle Tanks - RV32IM FPGA project';
const FONT = 'Arial';
const C = { dark: '1F2937', blue: '2F5DA8', lblue: 'DCE8FA', red: 'C0392B', lred: 'FADBD8',
  green: '2E8B57', lgreen: 'D9F0E3', orange: 'E67E22', lorange: 'FDEBD0', grey: 'E5E7EB',
  mgrey: '9CA3AF', yellow: 'FFF3C4' };

// rough text-fit check (Arial avg char ~0.52 em)
function fitCheck(label, text, pt, wIn, hIn) {
  const lines = String(text).split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length * 0.52 * pt / 72 / (wIn - 0.2))), 0);
  const need = lines * pt * 1.2 / 72;
  if (need > hIn + 0.01) console.warn(`FIT WARNING ${label}: need ${need.toFixed(2)}in > ${hIn}in (${lines} lines)`);
}

function title(s, text, n) {
  s.addText(text, { x: 0.5, y: 0.25, w: 12.3, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.dark, margin: 0 });
  s.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.98, w: 12.33, h: 0, line: { color: C.blue, width: 2 } });
  if (n) s.addText(`${n} / 7`, { x: 11.8, y: 7.1, w: 1.0, h: 0.3, fontFace: FONT, fontSize: 12, color: C.mgrey, align: 'right', margin: 0 });
}
function bullets(s, items, x, y, w, h, pt = 20, opts = {}) {
  const runs = [];
  items.forEach((it, i) => {
    const parts = Array.isArray(it) ? it : [{ text: it }];
    parts.forEach((p, j) => {
      const o = { fontFace: FONT, fontSize: pt, color: C.dark, ...(p.options || {}) };
      if (j === 0) { o.bullet = opts.nobullet ? false : { indent: 20 }; }
      if (j === parts.length - 1 && i < items.length - 1) o.breakLine = true;
      runs.push({ text: p.text, options: o });
    });
  });
  const flat = items.map(it => (Array.isArray(it) ? it.map(p => p.text).join('') : it)).join('\n');
  fitCheck('bullets@' + x + ',' + y, flat, pt, w - 0.3, h);
  s.addText(runs, { x, y, w, h, valign: 'top', margin: 0, paraSpaceAfter: opts.space ?? 6 });
}
const B = (t) => ({ text: t, options: { bold: true } });
const N = (t) => ({ text: t });
function arrow(s, x1, y1, x2, y2, o = {}) {
  s.addShape(pptx.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: o.color || C.dark, width: o.width || 2, dashType: o.dash, endArrowType: o.noHead ? undefined : 'triangle', beginArrowType: o.both ? 'triangle' : undefined } });
}
function box(s, x, y, w, h, text, o = {}) {
  s.addText(text, { x, y, w, h, shape: o.round ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, rectRadius: 0.08,
    fill: { color: o.fill || C.lblue }, line: { color: o.line || C.blue, width: o.lw || 1.5 },
    fontFace: FONT, fontSize: o.pt || 14, bold: o.bold !== false, color: o.color || C.dark, align: 'center', valign: 'middle', margin: 2 });
}
function label(s, text, x, y, w, h, o = {}) {
  s.addText(text, { x, y, w, h, fontFace: FONT, fontSize: o.pt || 12, color: o.color || C.dark, italic: o.italic, bold: o.bold,
    align: o.align || 'center', valign: 'middle', margin: 0 });
}

/* ---------------- Slide 1 ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'Battle Tanks on FPGA: Overview + Scope', 1);
  const prob = 'RV32I has no multiply/divide, so game math is slow.';
  fitCheck('prob', 'Problem: ' + prob, 20, 12.3, 0.8);
  s.addText([{ text: 'Problem: ', options: { bold: true, color: C.red } }, { text: prob }],
    { x: 0.5, y: 1.1, w: 12.3, h: 0.5, fontFace: FONT, fontSize: 20, color: C.dark, margin: 0, valign: 'top' });
  const sys = 'Two-player tank game on a Nexys A7. A 3-stage RV32IM CPU runs game rules in C; hardware handles buttons, timers, collisions and VGA. Our modification: RV32M unit (MUL/DIV/REM) with pipeline stall.';
  fitCheck('sys', 'System: ' + sys, 20, 12.3, 1.3);
  s.addText([{ text: 'System: ', options: { bold: true, color: C.blue } }, { text: sys }],
    { x: 0.5, y: 1.7, w: 12.3, h: 1.15, fontFace: FONT, fontSize: 20, color: C.dark, margin: 0, valign: 'top' });
  s.addText('System Scope', { x: 0.5, y: 2.95, w: 5, h: 0.45, fontFace: FONT, fontSize: 24, bold: true, color: C.dark, margin: 0 });
  const rows = [
    ['Commitment', C.red, C.lred, 1.1, ['RV32M unit (MUL/DIV/REM) verified and integrated with stall', 'C program on CPU moves two tanks on a VGA maze using buttons']],
    ['Goal', C.blue, C.lblue, 1.1, ['Bullets with wall reflection, collision flags, cooldowns', 'Health hearts on screen; damage logic in C; full FPGA demo']],
    ['Stretch', C.green, C.lgreen, 0.6, ['Single-player mode: software-controlled enemy tank']],
  ];
  let y = 3.5;
  rows.forEach(([name, col, lc, h, items]) => {
    box(s, 0.5, y, 2.2, h, name, { fill: lc, line: col, pt: 20 });
    bullets(s, items, 2.95, y + 0.08, 9.9, h - 0.1, 20, { space: 4 });
    y += h + 0.12;
  });
  s.addNotes('1-1.5 min. Problem: base RV32I has no hardware multiply/divide; our game needs cos/sin x speed and bullet reflection. System: CPU runs game rules in C, everything per-pixel / per-cycle is hardware. Our modification is the RV32M unit. Commitment = must-have; Goal = planned; Stretch = only if time remains.');
}

/* ---------------- Slide 2 ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'System Architecture', 2);
  // CPU container
  s.addShape(pptx.ShapeType.roundRect, { x: 0.35, y: 1.05, w: 8.55, h: 1.85, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: C.blue, width: 1.5, dashType: 'dash' } });
  label(s, 'RV32IM CPU (3 stages)', 0.45, 1.03, 2.6, 0.22, { pt: 11, color: C.blue, bold: true, align: 'left' });
  box(s, 0.5, 1.35, 1.5, 0.75, 'Instr. Mem\n(BRAM)', { fill: C.lblue, pt: 13 });
  box(s, 2.3, 1.35, 1.9, 0.75, '1 · IF/ID\nPC · Decode · RegFile', { pt: 13 });
  box(s, 4.5, 1.35, 1.9, 0.75, '2 · EX\nALU · Branch', { pt: 13 });
  box(s, 6.7, 1.35, 1.9, 0.75, '3 · WB\nLoad/Store · Write-back', { pt: 13 });
  arrow(s, 2.0, 1.72, 2.3, 1.72); arrow(s, 4.2, 1.72, 4.5, 1.72); arrow(s, 6.4, 1.72, 6.7, 1.72);
  box(s, 4.5, 2.3, 1.9, 0.38, 'NEW  RV32M: MUL · DIV/REM', { fill: C.lred, line: C.red, lw: 3, pt: 12, color: C.red });
  arrow(s, 5.45, 2.3, 5.45, 2.1, { color: C.red, width: 3, both: true });
  // stall (red dashed) RV32M -> IF/ID
  arrow(s, 4.5, 2.49, 3.4, 2.49, { color: C.red, noHead: true, dash: 'dash' });
  arrow(s, 3.4, 2.49, 3.4, 2.1, { color: C.red, dash: 'dash' });
  label(s, 'pipeline_stall', 3.45, 2.28, 1.0, 0.2, { pt: 11, color: C.red, align: 'left' });
  // WB -> IF/ID forwarding (blue)
  arrow(s, 7.0, 2.1, 7.0, 2.78, { color: C.blue, noHead: true });
  arrow(s, 7.0, 2.78, 2.6, 2.78, { color: C.blue, noHead: true });
  arrow(s, 2.6, 2.78, 2.6, 2.1, { color: C.blue });
  label(s, 'WB forwarding', 0.5, 2.66, 2.0, 0.22, { pt: 11, color: C.blue, align: 'right' });
  // WB -> bus, Data mem
  arrow(s, 7.9, 2.1, 7.9, 3.05, { color: C.dark, both: true });
  box(s, 9.2, 1.35, 1.9, 0.75, 'Data Memory\n(BRAM)', { fill: C.lblue, pt: 13 });
  arrow(s, 10.15, 2.1, 10.15, 3.05, { color: C.dark, both: true });
  // legend
  box(s, 11.4, 1.3, 0.25, 0.22, '', { fill: C.lblue }); label(s, 'base CPU', 11.7, 1.3, 1.2, 0.22, { align: 'left' });
  box(s, 11.4, 1.6, 0.25, 0.22, '', { fill: C.lred, line: C.red }); label(s, 'CPU modification', 11.7, 1.6, 1.4, 0.22, { align: 'left' });
  box(s, 11.4, 1.9, 0.25, 0.22, '', { fill: C.lgreen, line: C.green }); label(s, 'game hardware', 11.7, 1.9, 1.4, 0.22, { align: 'left' });
  // MMIO bus
  box(s, 0.35, 3.05, 12.6, 0.4, 'MMIO bus  (addr · wdata · we  →  registered read mux)', { fill: C.yellow, line: C.mgrey, pt: 14 });
  // peripherals
  const per = [['Collision\n(hit flags)', 0.4], ['Sprite/HUD\nregisters', 2.8], ['Maze Tile\nRAM', 5.2], ['Input\ncontroller', 7.6], ['Cooldown\ntimers', 10.0]];
  per.forEach(([t, x]) => {
    box(s, x, 3.75, 2.3, 0.7, t, { fill: C.lgreen, line: C.green, pt: 13 });
    arrow(s, x + 1.15, 3.45, x + 1.15, 3.75, { color: C.dark, both: true });
  });
  // video row
  box(s, 0.4, 4.95, 2.1, 0.65, 'VGA timing\n(x, y, sync)', { fill: C.lgreen, line: C.green, pt: 13 });
  box(s, 2.8, 4.95, 4.7, 0.65, 'Sprite engine · Maze renderer · HUD', { fill: C.lgreen, line: C.green, pt: 13 });
  box(s, 7.8, 4.95, 2.0, 0.65, 'Pixel mixer\n(priority)', { fill: C.lgreen, line: C.green, pt: 13 });
  box(s, 10.1, 4.95, 1.4, 0.65, 'VGA out', { fill: C.lgreen, line: C.green, pt: 13 });
  box(s, 11.8, 4.95, 1.15, 0.65, 'Monitor', { fill: 'FFFFFF', line: C.dark, pt: 13 });
  arrow(s, 2.5, 5.27, 2.8, 5.27, { color: C.green }); arrow(s, 7.5, 5.27, 7.8, 5.27, { color: C.green });
  arrow(s, 9.8, 5.27, 10.1, 5.27, { color: C.green }); arrow(s, 11.5, 5.27, 11.8, 5.27, { color: C.green });
  arrow(s, 3.95, 4.45, 3.95, 4.95, { color: C.green }); arrow(s, 6.35, 4.45, 6.35, 4.95, { color: C.green });
  label(s, 'positions, angles, health', 0.4, 4.52, 3.5, 0.3, { pt: 11, color: C.green, align: 'right' });
  label(s, 'maze tiles', 6.45, 4.52, 1.4, 0.3, { pt: 11, color: C.green, align: 'left' });
  bullets(s, [
    [B('Modification: '), N('RV32M unit plugs into the EX stage; ALU gets its result')],
    [B('Control: '), N('divider asserts pipeline_stall; PC and IF/ID freeze')],
    [B('Data: '), N('CPU writes sprite regs over MMIO; video reads them every pixel')],
  ], 0.5, 5.8, 12.3, 1.3, 20, { space: 4 });
  s.addNotes('2 min. Left to right: CPU with three stages IF/ID, EX, WB. Red block = our modification: RV32M unit attached to EX. When a divide runs, it raises pipeline_stall and freezes the front of the pipeline; write-back forwarding feeds results back to the register-file read. Data side goes through the MMIO bus to the game peripherals. C code writes sprite/HUD registers and maze RAM; the VGA engine reads them per pixel and the pixel mixer outputs RGB to the monitor. Collision flags are computed in hardware, C reads them and applies damage/reflection. Branch redirect (EX -> PC) is omitted for clarity; shown in the timing slide. Full diagram: backup slide.');
}

/* ---------------- Slide 3 (timing) ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'Timing Diagram: 28 cycles, real instruction sequence', 3);
  const NC = 28, gx = 2.3, gw = 10.65, cw = gw / NC, rh = 0.37, y0 = 1.1;
  const R = {}; timing.rows.forEach(r => R[r.name] = r.values);
  const rowsDef = ['cycle', 'clk_sys', 'IF/ID', 'EX', 'WB', 'stall_read_i', 'branch_taken', 'fwd_sel1', 'fwd_sel2', 'm_ext_EX (MUL)'];
  const ry = (i) => y0 + i * rh;
  rowsDef.forEach((n, i) => label(s, n, 0.35, ry(i), 1.9, rh, { pt: 12, align: 'left', bold: i >= 2 && i <= 4 }));
  for (let c = 0; c < NC; c++) label(s, String(c), gx + c * cw, ry(0), cw, rh, { pt: 11, color: '6B7280' });
  // clock
  for (let c = 0; c < NC; c++) {
    const x = gx + c * cw, top = ry(1) + 0.08, bot = ry(1) + rh - 0.08, L = { color: C.dark, width: 1.25 };
    s.addShape(pptx.ShapeType.line, { x, y: top, w: 0, h: bot - top, line: L });
    s.addShape(pptx.ShapeType.line, { x, y: top, w: cw / 2, h: 0, line: L });
    s.addShape(pptx.ShapeType.line, { x: x + cw / 2, y: top, w: 0, h: bot - top, line: L });
    s.addShape(pptx.ShapeType.line, { x: x + cw / 2, y: bot, w: cw / 2, h: 0, line: L });
  }
  // instruction rows
  function seq(rowName, ri) {
    const raw = R[rowName].slice(0, NC);
    const disp = raw.map(v => v.replace(/\((req|ret|hold)\)/, ''));
    let c = 0;
    while (c < NC) {
      let e = c; while (e + 1 < NC && disp[e + 1] === disp[c]) e++;
      const len = e - c + 1, t = disp[c];
      let fill = C.lblue, line = C.blue, col = C.dark;
      if (t === 'NOP') { fill = C.grey; line = C.mgrey; col = '6B7280'; }
      else if (t.includes('×')) { fill = C.lred; line = C.red; col = C.red; }
      else if (len > 1) { fill = C.lorange; line = C.orange; }
      s.addText(t, { x: gx + c * cw + 0.01, y: ry(ri) + 0.03, w: len * cw - 0.02, h: rh - 0.06, shape: pptx.ShapeType.rect,
        fill: { color: fill }, line: { color: line, width: 1 }, fontFace: FONT, fontSize: t === 'NOP' ? 10 : 14, bold: true, color: col, align: 'center', valign: 'middle', margin: 0 });
      c = e + 1;
    }
  }
  seq('IF + ID instruction', 2); seq('EX instruction', 3); seq('MEM + WB instruction', 4);
  // bit rows
  const bits = [['stall_read_i', 5, C.orange], ['branch_taken', 6, C.red], ['fwd_sel1', 7, C.blue], ['fwd_sel2', 8, C.blue], ['m_ext_EX', 9, C.green]];
  bits.forEach(([n, ri, col]) => {
    s.addShape(pptx.ShapeType.rect, { x: gx, y: ry(ri) + 0.03, w: gw, h: rh - 0.06, fill: { color: 'F9FAFB' }, line: { color: C.grey, width: 0.75 } });
    R[n].slice(0, NC).forEach((v, c) => { if (v) s.addText('1', { x: gx + c * cw + 0.01, y: ry(ri) + 0.03, w: cw - 0.02, h: rh - 0.06, shape: pptx.ShapeType.rect,
      fill: { color: col }, line: { color: col }, fontFace: FONT, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0 }); });
  });
  // vertical grid
  for (let c = 0; c <= NC; c += 1) s.addShape(pptx.ShapeType.line, { x: gx + c * cw, y: ry(2), w: 0, h: 8 * rh - 0.0, line: { color: 'E5E7EB', width: 0.5 } });
  // legend line
  s.addText('Instructions: A addi · B add · C lw · D add · E sw · F mul · G bne (not taken) · H beq (taken) · J, K wrong path · L sw · M lw · N addi (uses M)   |   orange = held/stalled, red = squashed',
    { x: 0.35, y: ry(10) + 0.05, w: 12.6, h: 0.6, fontFace: FONT, fontSize: 14, color: '4B5563', margin: 0, valign: 'top' });
  bullets(s, [
    [B('Forwarding: '), N('B takes A\'s result in cycle 4; D takes lw data in cycle 7')],
    [B('Load stall: '), N('lw waits 1 cycle (6, 16); pipeline holds, single write')],
    [B('Taken branch H (11): '), N('J, K squashed; fetch resumes at target L')],
    [B('Multi-cycle: '), N('MUL 1 clock; DIV/REM stalls pipeline ≈33 clocks')],
  ], 0.5, 5.55, 12.3, 1.5, 20, { space: 4 });
  s.addNotes('2 min. Real sequence: addi, add, lw, add, sw, mul, bne, beq, ... Cycle 4: B reads A result through write-back forwarding (fwd_sel1/2). Cycle 6: lw C is waiting for data (stall_read_i); D is held in EX, resumes at 7 and gets the loaded value forwarded. mul F executes in one clock (m_ext_EX at cycle 9). beq H is taken in cycle 11: the two younger instructions J and K are squashed (no store, no register write), PC jumps to 64 so L enters. Cycle 16: lw from the input register (MMIO) waits one cycle, N gets forwarded data. Multi-cycle: DIV/REM runs 32 iterations; pipeline_stall stays high from start through done (~33 clocks), then the result is written back once; divide-by-zero and INT_MIN/-1 bypass the iterations (backup slide). NOTE: diagram is an illustrative sequence derived from the block diagrams; replace with a real simulation waveform when available.');
}

/* ---------------- Slide 4 ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'Design + Verification Plan', 4);
  s.addText('Implementation Plan', { x: 0.5, y: 1.15, w: 6.0, h: 0.5, fontFace: FONT, fontSize: 24, bold: true, color: C.blue, margin: 0 });
  bullets(s, [
    [B('1. MUL unit '), N('→ mul.v + testbench')],
    [B('2. DIV/REM unit '), N('→ div_rem.v + testbench')],
    [B('3. RV32M in pipeline '), N('(stall, bubble) → integrated simulation')],
    [B('4. MMIO + VGA + game.c '), N('→ full simulation, then FPGA')],
  ], 0.5, 1.75, 6.0, 4.6, 20, { nobullet: true, space: 14 });
  s.addShape(pptx.ShapeType.line, { x: 6.75, y: 1.2, w: 0, h: 5.3, line: { color: C.mgrey, width: 1 } });
  s.addText('Verification Plan', { x: 7.0, y: 1.15, w: 5.8, h: 0.5, fontFace: FONT, fontSize: 24, bold: true, color: C.red, margin: 0 });
  bullets(s, [
    [B('Module level: '), N('self-checking testbenches vs. golden results')],
    [B('Edge cases: '), N('signed/unsigned MULH variants, ÷0, INT_MIN ÷ −1, REM sign')],
    [B('Processor level: '), N('C programs in simulation: mul/div test, then game.c')],
  ], 7.0, 1.75, 5.8, 4.6, 20, { space: 14 });
  s.addNotes('1.5-2 min. Each step ends with something we can show: steps 1-2 are module + testbench, step 3 is an integrated simulation running assembly with mul/div between dependent instructions, step 4 is the full system in simulation and then on the board. Verification: testbenches compare against expected values (directed + random vectors). Edge cases: MULH/MULHSU/MULHU sign handling, divide by zero returns all ones (REM returns the dividend), INT_MIN / -1 returns INT_MIN with remainder 0 and no exception. Processor level: compile C with rv32im, run in simulation, check registers/memory, then game.c.');
}

/* ---------------- Slide 5 ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'Timeline', 5);
  const hd = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.blue }, fontFace: FONT, fontSize: 20 } });
  const cell = (t, o = {}) => ({ text: t, options: { fontFace: FONT, fontSize: 20, color: C.dark, valign: 'middle', ...o } });
  s.addTable([
    [hd('When'), hd('Milestone (concrete deliverables)')],
    [cell('By 25 Oct', { bold: true }), cell('mul.v + div_rem.v pass their testbenches (incl. ÷0, INT_MIN ÷ −1)')],
    [cell('By 1 Nov', { bold: true }), cell('Minimum system: CPU + RV32M runs a C test in simulation; VGA shows maze + tanks')],
    [cell('Final phase', { bold: true }), cell('Integration: game.c with bullets, collision, health; timing closed; FPGA demo on Nexys A7')],
  ], { x: 0.5, y: 1.4, w: 12.3, colW: [2.4, 9.9], rowH: [0.55, 1.1, 1.3, 1.3], border: { type: 'solid', color: C.mgrey, pt: 1 }, fill: { color: 'FFFFFF' } });
  s.addText('Dependencies: modules first, then pipeline integration, then game software, then bitstream', { x: 0.5, y: 6.0, w: 12.3, h: 0.5, fontFace: FONT, fontSize: 20, italic: true, color: C.dark, margin: 0 });
  s.addNotes('1-1.5 min. Three milestones. 25 Oct: at least one module tested - we plan both the multiplier and divider with testbenches. 1 Nov: minimum working system = CPU with RV32M running a C test, and VGA showing maze and tanks. Final phase: integration of the full game and the FPGA demo. TODO: insert exact final-phase date.');
}

/* ---------------- Slide 6 ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'Team Responsibilities', 6);
  const hd = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.blue }, fontFace: FONT, fontSize: 20 } });
  const cell = (t, o = {}) => ({ text: t, options: { fontFace: FONT, fontSize: 20, color: C.dark, valign: 'middle', ...o } });
  const rows = [
    ['A', 'MUL / MULH / MULHSU / MULHU + testbench'],
    ['B', 'DIV / DIVU / REM / REMU + stall control + testbench'],
    ['C', 'Pipeline integration + hazards + C test programs'],
    ['D', 'MMIO peripherals, VGA, game.c, FPGA build + demo'],
  ];
  s.addTable([[hd('Member'), hd('Responsibility')], ...rows.map(r => [cell(r[0], { bold: true, align: 'center' }), cell(r[1])])],
    { x: 0.5, y: 1.4, w: 12.3, colW: [1.8, 10.5], rowH: [0.55, 0.85, 0.85, 0.85, 0.85], border: { type: 'solid', color: C.mgrey, pt: 1 }, fill: { color: 'FFFFFF' } });
  s.addText('Interfaces: A/B → C: result + pipeline_stall;  C ↔ D: MMIO register map', { x: 0.5, y: 5.6, w: 12.3, h: 0.5, fontFace: FONT, fontSize: 20, italic: true, color: C.dark, margin: 0 });
  s.addNotes('1 min. Four non-overlapping areas. A owns the multiplier, B the divider and its stall control, C the pipeline and hazard logic plus C test programs, D the game hardware (MMIO, VGA), game.c and the FPGA demo. Interfaces are fixed early: m_result / pipeline_stall between A,B and C; MMIO register map between C and D. TODO: replace A-D with real names.');
}

/* ---------------- Slide 7 ---------------- */
{
  const s = pptx.addSlide();
  title(s, 'Demo Plan + Challenges', 7);
  s.addText('Demo Plan', { x: 0.5, y: 1.1, w: 5, h: 0.45, fontFace: FONT, fontSize: 24, bold: true, color: C.blue, margin: 0 });
  const dx = [0.5, 4.8, 9.1], dw = 3.7;
  const dem = [['Input', 'Player buttons + game.c in instruction memory', C.lblue, C.blue],
    ['Processing', 'CPU runs game in C; hardware checks collisions and renders', C.lgreen, C.green],
    ['Output', 'VGA monitor: maze, tanks, bullets, health hearts', C.lorange, C.orange]];
  dem.forEach(([h, t, f, l], i) => {
    s.addText([{ text: h, options: { bold: true, fontSize: 22, breakLine: true } }, { text: t, options: { fontSize: 18 } }],
      { x: dx[i], y: 1.65, w: dw, h: 1.75, shape: pptx.ShapeType.rect, fill: { color: f }, line: { color: l, width: 2 }, fontFace: FONT, color: C.dark, align: 'center', valign: 'middle', margin: 6 });
    if (i < 2) arrow(s, dx[i] + dw + 0.05, 2.52, dx[i + 1] - 0.05, 2.52, { width: 3 });
  });
  fitCheck('demo3', dem[1][1], 18, dw - 0.2, 1.1);
  s.addText('Challenges', { x: 0.5, y: 3.75, w: 5, h: 0.45, fontFace: FONT, fontSize: 24, bold: true, color: C.red, margin: 0 });
  bullets(s, [
    [B('Stalls: '), N('32-clock divide must freeze pipeline, no double write')],
    [B('Signed/unsigned: '), N('MULH variants, ÷0, INT_MIN ÷ −1 overflow')],
    [B('Hazards: '), N('load wait + forwarding + branch squash together')],
    [B('FPGA timing: '), N('33×33 multiplier path at 50 MHz; VGA sync alignment')],
  ], 0.5, 4.3, 12.3, 2.5, 20, { space: 8 });
  s.addNotes('1-1.5 min. Demo: Input = player buttons plus the compiled game program in instruction memory. Processing = CPU polls buttons, moves tanks, spawns bullets, reads hardware collision flags; the VGA engine renders per pixel. Output = visible on a VGA monitor connected to the FPGA. Challenges: stalls, signed/unsigned and corner cases, hazard combinations, FPGA timing closure. Be ready: Nexys A7 has only 5 buttons, so 12 game inputs need external buttons/PMOD wiring.');
}

/* ---------------- Backup slides ---------------- */
{
  const s = pptx.addSlide();
  s.addText('Backup: DIV/REM multi-cycle timing', { x: 0.5, y: 0.25, w: 12.3, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.dark, margin: 0 });
  s.addImage({ path: D + 'timing/out/02_rv32m.png', x: 0.4, y: 1.1, w: 12.5, h: 12.5 * 964 / 2702 });
  bullets(s, ['Start → 32 busy clocks (pipeline_stall = 1) → done → write-back',
    '÷0 and INT_MIN ÷ −1 bypass the iterations, no exception'], 0.5, 5.8, 12.3, 1.1, 20);
  s.addNotes('Backup for Q&A. Sheet B of the timing diagrams (illustrative, derived from block diagrams).');
}
{
  const s = pptx.addSlide();
  s.addText('Backup: full system block diagram', { x: 0.5, y: 0.25, w: 12.3, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.dark, margin: 0 });
  s.addImage({ path: D + 'out/fig1_top_level.png', x: 0.4, y: 1.1, w: 12.5, h: 12.5 * 1260 / 2760 });
  s.addNotes('Backup for Q&A: gate-level top-level diagram (Fig 1).');
}

pptx.writeFile({ fileName: '/workspace/Battle_Tanks_Presentation.pptx' }).then(f => console.log('wrote', f));
