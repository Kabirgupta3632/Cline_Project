#!/usr/bin/env python3
"""Render hand-derived scenarios, NOT a hardware simulator. No source diagrams modified."""
from pathlib import Path
import html, json
ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'out'
OUT.mkdir(exist_ok=True)
SHEETS = []

def sheet(name, title, labels, subtitle, breaks=()):
    s = dict(name=name, title=title, labels=[str(x) for x in labels], subtitle=subtitle,
             breaks=list(breaks), rows=[], notes=[])
    SHEETS.append(s)
    return s

def row(s, name, values, explanation, kind='auto'):
    if kind == 'auto':
        kind = 'bit' if all(type(v) is int and v in (0, 1) for v in values) else 'bus'
    assert len(values) == len(s['labels']), (s['name'], name, len(values))
    if kind == 'bit':
        assert all(v in (0, 1) for v in values), name
    s['rows'].append(dict(name=name, values=values, explanation=explanation, kind=kind))

def bits(n, highs):
    return [int(i in highs) for i in range(n)]

def bus(n, entries, default='—'):
    a = [default] * n
    for i, v in entries.items():
        a[i] = str(v)
    return a

def render(s):
    n = len(s['labels']); cw = 100; left = 278; top = 150; rh = 47
    width = left + n*cw + 24
    height = top + (len(s['rows'])+1)*rh + 65 + 22*len(s['notes'])
    a = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
         '<rect width="100%" height="100%" fill="white"/>',
         '<style>text{font-family:DejaVu Sans,Arial,sans-serif;fill:#182638} .grid{stroke:#d4dbe3;stroke-width:1} .wave{fill:none;stroke:#182638;stroke-width:2} .bus{fill:#f6f9fc;stroke:#29425f;stroke-width:1.4}</style>']
    def text(x,y,t,size=15,anchor='start',color=None):
        extra = f' style="fill:{color}"' if color else ''
        clean = str(t).replace('→','->').replace('…','...')
        a.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}"{extra}>{html.escape(clean)}</text>')
    text(24,35,s['title'],25)
    text(24,65,s['subtitle'],16)
    text(24,92,'Column = after left rising edge; outputs latch at next edge. — = not consumed. // = omitted time / independent boundary window.',15)
    for i,l in enumerate(s['labels']):
        x = left+i*cw
        a.append(f'<path class="grid" d="M{x} {top-35} V{top+(len(s["rows"])+1)*rh}"/>')
        text(x+cw/2,top-15,l,16,'middle')
    rows = [dict(name='clk_sys',kind='clock',values=[0]*n)] + s['rows']
    for j,r in enumerate(rows):
        y = top+j*rh
        a.append(f'<path class="grid" d="M20 {y+rh} H{width-24}"/>')
        text(24,y+rh/2+5,r['name'],16)
        hi,lo = y+9,y+rh-9
        if r['kind']=='clock':
            d = f'M{left} {lo}'
            for i in range(n):
                x=left+i*cw
                d+=f' V{hi} H{x+cw/2} V{lo} H{x+cw}'
            a.append(f'<path class="wave" d="{d}"/>')
        elif r['kind']=='bit':
            d=''
            for i,v in enumerate(r['values']):
                x=left+i*cw; yy=hi if v else lo
                d+=(f'M{x} {yy}' if i==0 else f' V{yy}')+f' H{x+cw}'
                if v: text(x+cw/2,y+rh/2+5,'1',13,'middle')
            a.append(f'<path class="wave" d="{d}"/>')
        else:
            i=0
            while i<n:
                k=i+1
                while k<n and r['values'][k]==r['values'][i] and k not in s['breaks']: k+=1
                x=left+i*cw; end=left+k*cw
                a.append(f'<path class="bus" d="M{x} {y+rh/2} L{x+8} {hi} H{end-8} L{end} {y+rh/2} L{end-8} {lo} H{x+8} Z"/>')
                t=str(r['values'][i]); size=min(16,max(10,int((end-x-18)/max(1,len(t))*1.65)))
                text((x+end)/2,y+rh/2+5,t,size,'middle'); i=k
    for b in s['breaks']:
        x=left+b*cw
        a.append(f'<rect x="{x-6}" y="{top-35}" width="12" height="{(len(rows))*rh+35}" fill="white"/>')
        for y in range(top-30,top+len(rows)*rh,47):
            text(x,y+22,'//',16,'middle','#b35c13')
    y=top+len(rows)*rh+26
    for note in s['notes']:
        text(24,y,note,15); y+=22
    (OUT/(s['name']+'.svg')).write_text('\n'.join(a)+'\n</svg>\n')

# A: continuous CPU trace; synchronous instruction fetch returns after one column.
n=28
s=sheet('01_cpu_pipeline','A. RV32IM pipeline — 28 continuous clk_sys cycles',range(n),
        'Reset, forwarding, read wait, taken / not-taken branch, squash, MUL, MMIO and byte store. Selected control assumptions: see README.')
pc=[0,0,4,8,12,16,20,20,24,28,32,36,64,68,72,76,80,80,84,88,92,96,100,104,108,112,116,120]
IF=['NOP','NOP','A','B','C','D','E','E','F','G','H','J','K×','L','M','N','O','O','P','Q','R','S','T','U','V','W','NOP','NOP']
EX=['NOP','NOP','NOP','A','B','C','D(hold)','D','E','F','G','H','J×','K×','L','M','N(hold)','N','O','P','Q','R','S','T','U','V','W','NOP']
WB=['NOP','NOP','NOP','NOP','A','B','C(req)','C(ret)','D','E','F','G','H','J×','K×','L','M(req)','M(ret)','N','O','P','Q','R','S','T','U','V','W']
row(s,'reset',bits(n,[0]),'Active-high internal CPU reset. Establishes PC=0 and bubbles; reset_n = NOT reset. P1/P2.')
row(s,'fetch_pc [31:0]',pc,'Instruction BRAM address, not IF/ID instruction PC. Holds on read wait; redirects to 64 after H. P1.')
row(s,'IF + ID instruction',IF,'Returned instruction decoded now; fetch PC is one column ahead. × marks wrong-path work.')
row(s,'EX instruction',EX,'Executing instruction, or held behind a read wait. P2/P3/P7.')
row(s,'MEM + WB instruction',WB,'req/ret are request/completion of the SAME load, not two instructions. P5/P6.')
row(s,'stall_read_i',bits(n,[6,16]),'Chosen one-column data-read wait; pipeline holds. Load commits only on return. P1/P5/P6.')
row(s,'branch_taken',bits(n,[11]),'H taken in EX; G at 10 NOT taken. Wrong-path redirects suppressed. P5.')
row(s,'squash_EX tags [1:0]',bus(n,{12:'01',13:'10'},'00'),'Semantic younger-instruction tags corresponding to P1 first/second squash. Raw alignment ambiguous.')
row(s,'squash_WB',bits(n,[13,14]),'Semantic squash qualifier disables J/K WB effects. Annotation, not an additional drawn FF.')
ops={3:(0,10,0,0),4:(10,10,1,1),5:(256,0,10,0),7:(32,20,3,2),8:(256,4,10,4),9:(10,20,1,2),10:(10,10,1,1),11:(200,200,5,5),14:(2147483648,20,11,1),15:(2147483648,0,11,0),17:(16,0,7,0),18:(256,1,10,8),19:(0,-1,0,0),20:(-1,0,9,0),21:(10,20,1,2),22:(2147483648,72,11,0),23:(0,'0x12345000',0,0),24:(-1,4,9,0),25:(0,0,0,0),26:(2147483648,64,11,5)}
row(s,'ALU operand 1',bus(n,{k:v[0] for k,v in ops.items()}),'Consumed EX operand 1. — for held/squashed work. P3/P4.')
row(s,'ALU operand 2',bus(n,{k:v[1] for k,v in ops.items()}),'EX register/immediate; store offset is NOT payload. Separate store payload assumed. P3.')
row(s,'rs1_select',bus(n,{k:v[2] for k,v in ops.items()}),'EX operand source register. x0 forced to zero. P4.')
row(s,'rs2_select',bus(n,{k:v[3] for k,v in ops.items()}),'Second source or store-payload register; immediate instructions have no consumed rs2. P4.')
row(s,'fwd_sel1',bits(n,[4,7,17]),'WB-to-EX forwarding: A→B, C→D, M→N. P4; EX reads assumed.')
row(s,'fwd_sel2',bits(n,[4,8,18]),'WB-to-EX source 2/store forwarding: A→B, D→E, N→O. P4.')
row(s,'m_ext_EX',bits(n,[9]),'F is MUL. ALU mux input 4; chosen one-clock multiplier, no DIV stall. P7a/P7c.')
writes={4:(1,10),5:(2,20),7:(3,32),8:(4,52),10:(5,200),17:(7,16),18:(8,16),20:(9,-1),21:(12,1),22:(13,30),24:(14,'0x12345000'),25:(15,-1),26:(16,0)}
row(s,'wb_write_en',bits(n,writes),'Qualified architectural register write; zero for load request/stores/branches/squash. P4/P6.')
row(s,'wb_dest_reg_sel',bus(n,{k:v[0] for k,v in writes.items()},'0'),'Destination when write enabled; zero here means no write.')
row(s,'wb_result',bus(n,{k:v[1] for k,v in writes.items()}),'Consumed ALU/MUL/load write-back value. P6.')

# Additional CPU bus rows.
stores={9:('0x00000104','0x00000034','1111'),15:('0x80000014','0x0000000A','1111'),19:('0x00000101','0x10101010','0010'),23:('0x80000048','0x00000000','1111'),27:('0x80000040','0x000000C8','1111')}
row(s,'d_we / store_en',bits(n,stores),'Actual WB write pulse. Squashed J cannot write; read wait cannot repeat a store. P6/Fig 2a.')
addresses={k:v[0] for k,v in stores.items()}; addresses.update({6:'0x00000100',7:'0x00000100',16:'0x80000000',17:'0x80000000'})
row(s,'d_addr',bus(n,addresses),'Data/MMIO byte address held across load response; store effective address distinct from payload. P5/Fig 2a.')
row(s,'d_wdata',bus(n,{k:v[1] for k,v in stores.items()}),'Lane-replicated payload; SB drives 0x10101010 but writes only enabled byte. P6.')
row(s,'d_wstrb [3:0]',bus(n,{k:v[2] for k,v in stores.items()},'0000'),'Data-memory byte enables; MMIO ignores strobes and requires word access. P6/Fig 2a.')
row(s,'cs_in',bits(n,[16,17]),'Input peripheral address selected; selection does not imply a write. Fig 2a.')
row(s,'cs_in_q',bits(n,[17,18]),'One-clock registered input select; only column 17 response is consumed. Fig 2b.')
row(s,'wr_en_tmr',bits(n,[15]),'Timer selection AND d_we; L triggers both special channels with 0xA. Figs 2a/4.')
row(s,'wr_en_spr',bits(n,[23,27]),'Sprite selection AND d_we; S clears bullet 0, W updates P1 position. Figs 2a/5.')
s['notes']=['Initial test state: x10=0x100; x11=0x80000000; RAM[0x100]=32; P1_INPUT=0x10. Other consumed initial registers = 0.',
 'H is BEQ at PC 28 → PC 64. J/K must never commit. Independent illustrative sequence, not the real game software.']

# B: real elapsed divider labels; no shortening of hardware iteration count.
labels=[0,1,2,3,4,5,6,7,8,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43]
n=len(labels)
s=sheet('02_rv32m','B. RV32M — normal division and immediate special-case bypass',labels,
        '24 visible columns; clocks 9–28 OMITTED (20 genuine busy clocks). Normal DIV requires 32 iterations; real elapsed time exceeds 30.',[9])
row(s,'EX operation', ['DIV -100/7']*14+['NOP','NOP','DIV 5/0','NOP','REM 5/0','NOP','DIV MIN/-1','NOP','REM MIN/-1','NOP'],'MIN = signed 0x80000000. Special cases bypass iteration. P7b.')
row(s,'fetch_pc', [100]*14+[104,108,112,116,120,124,128,132,136,140],'PC held until done then increments. P7c hold convention.')
row(s,'start',bits(n,[0]),'Pulse loads abs(dividend)=100 and clears remainder before BUSY. P7b.')
row(s,'busy',bits(n,range(1,13)),'High during 32 real iteration columns 1–32; special cases never BUSY. P7b.')
row(s,'cnt_q [4:0]',bus(n,{i:labels[i]-1 for i in range(1,13)}),'Iteration index 0–31. Omitted clocks contain indices 8–27. P7b.')
row(s,'last_cycle',bits(n,[12]),'cnt_q=31 during column 32; final iteration completes on next edge. P7b.')
row(s,'done',bits(n,[13,16,18,20,22]),'Normal registered completion at 33; immediate bypass for zero/overflow. P7b.')
row(s,'pipeline_stall',bits(n,range(13)),'is_div_op AND NOT done. High at start and BUSY; freezes PC/IF/ID/EX. P7b/P7c.')
row(s,'div_by_zero',bits(n,[16,18]),'DIV gives all ones; REM gives dividend. No trap. P7b.')
row(s,'overflow',bits(n,[20,22]),'Signed MIN/-1: DIV gives MIN, REM gives zero. Not an exception. P7b.')
row(s,'m_result',bus(n,{13:'-14',16:'0xFFFFFFFF',18:'5',20:'0x80000000',22:'0'}),'Selected result; normal signed quotient truncates toward zero. P7b/P7c.')
row(s,'reg_write_to_WB',bits(n,[13,16,18,20,22]),'Enabled only when done. Busy columns insert no-write bubbles. P7c.')
row(s,'wb_write_en',bits(n,[14,17,19,21,23]),'Single commit one clock after result capture, no repeated busy write. P4/P6.')
row(s,'wb_result',bus(n,{14:'-14',17:'0xFFFFFFFF',19:'5',21:'0x80000000',23:'0'}),'Committed results. Normal REM -100/7 would use same stall and return -2.')
s['notes']=['Start column 0; 32 iterations columns 1…32; done 33; WB 34. The // break omits clocks, not work.',
 'DIVU/REMU have same handshake without signed correction. MUL high/low variants use funct3 without divider stall.']

# C: continuous collision trace. Inputs are testbench/precondition stimulus, not 28 clocks of game travel.
n=28
s=sheet('03_collisions','C. Collision engine and software response — 28 continuous clocks',range(n),
        'Preloaded bullets and maze; arbitrary test position updates. Wall scan, inactive suppression, normal/special tank hit, bullet pair, sticky clear priority.')
scan=[i%8 for i in range(n)]
act0=[1]*n
act3=[1]*11+[0]*17
act4=[1]*24+[0]*4
row(s,'scan_q [2:0]',scan,'Free-running selected bullet slot 0–7. Fig 6b.')
row(s,'scan_d [2:0]', ['—','—']+[i%8 for i in range(n-2)],'Slot identity delayed two clocks to match address register plus maze BRAM. Fig 6b.')
# Test bullet0 remains in wall until software position write at 13; inactive bullet7 also has wall tile.
tile=['—','—']+[('1' if ((i-2)%8==0 and i-2<14) or (i-2)%8==7 else '0') for i in range(2,n)]
act_sample=[int((i%8==0) or (i%8==1 and i<19) or (i%8==2 and i<20) or (i%8==3 and i<11) or (i%8==4 and i<24)) for i in range(n)]
act_d=[0,0]+act_sample[:-2]
wallset=[1 if i in [2,10] else 0 for i in range(n)]
row(s,'tile (wall port)',tile,'Two-clock centre-tile result; 0=floor, 1=wall. Slot7 is in a wall but inactive. Fig 6b/7.')
row(s,'act_d',act_d,'Sampled activity delayed two clocks. Inactive wall slot7 cannot set a hit. Fig 6b.')
row(s,'wall_set [7:0]',[f'{v:02X}' for v in wallset],'One-hot mask when delayed slot is active and tile nonzero. Slots0 set at 2 and 10. Fig 6b.')
row(s,'b0_act',act0,'Bullet0 remains alive through reflection; hardware does not remove it on wall hit. Fig 5.')
row(s,'b3_act',act3,'Normal bullet3 removed by a software register write at 10, effective 11. Fig 5.')
row(s,'b4_act',act4,'Special bullet4 removed by write at 23, effective 24. Fig 5.')
btk=[8 if 6<=i<=10 else 16 if 21<=i<=23 else 0 for i in range(n)]
tank=[2 if 6<=i<=10 else 1 if 21<=i<=23 else 0 for i in range(n)]
bb=[6 if 15<=i<=18 else 0 for i in range(n)]
row(s,'btk_hit [7:0]',[f'{v:02X}' for v in btk],'Live AABB hits: bullet3→P2, later bullet4→P1. Normal=6×6; special=12×12. Figs 6a/6c.')
row(s,'tank_set [1:0]',[f'{v:X}' for v in tank],'P1 bit0/P2 bit1. Both tanks always collision-active; no ownership filter. Fig 6c.')
row(s,'bb_hit [7:0]',[f'{v:02X}' for v in bb],'Overlap of active bullets1/2 sets BOTH bits (0x06). Deactivating either stops the live overlap. Fig 6c.')
clears={5:('0x24',1),8:('0x2C',0x208),12:('0x2C',0x208),14:('0x24',1),16:('0x28',6),20:('0x28',6),26:('0x2C',0x110)}
qwall=qbb=qhit=0; walls=[]; bbs=[]; hits=[]; flags=[]
for i in range(n):
    walls.append(f'{qwall:02X}'); bbs.append(f'{qbb:02X}'); hits.append(f'{qhit:03X}')
    flags.append(f'{int(bool(qwall)) | int(bool(qbb))*2 | int(bool(qhit&255))*4:X}')
    addr,mask=clears.get(i,('',0))
    qwall=(qwall|wallset[i]) & ~(mask if addr=='0x24' else 0)
    qbb=(qbb|bb[i]) & ~(mask if addr=='0x28' else 0)
    qhit=(qhit|btk[i]|(tank[i]<<8)) & ~(mask if addr=='0x2C' else 0)
row(s,'WALL_MASK',walls,'Sticky per-bullet wall mask; persists after detection. Cleared at 5 and 14. Fig 6d.')
row(s,'BB_MASK',bbs,'Sticky bullet-pair mask. Simultaneous clear/set at 16 clears; persistent overlap sets again at 18. Fig 6d.')
row(s,'HIT_MASK',hits,'Sticky {tank[1:0],bullet[7:0]}. Clear at 8 wins; still-live hit re-sets at 10. Later 0x110 identifies special bullet4/P1. Fig 6d.')
row(s,'COLLISION_FLAG [2:0]',flags,'bit0 any wall; bit1 any BB; bit2 any bullet-tank. ORs of sticky masks, NOT single-clock hit pulses. Fig 6d.')
row(s,'wr_en_col',bits(n,clears),'Selected collision W1C MMIO write. Clear priority shown at 8 and 16. Fig 6d.')
row(s,'clear address (offset)',bus(n,{i:v[0] for i,v in clears.items()}),'MMIO low offset; full base is 0x80000000. Fig 2a/6d.')
row(s,'clear d_wdata',bus(n,{i:f'{v[1]:03X}' for i,v in clears.items()}),'Written one bits clear corresponding sticky bits; zeros do nothing. Fig 6d.')
row(s,'sw.sprite write',bus(n,{10:'b3 act=0',13:'b0 outside wall',18:'b1 act=0',19:'b2 act=0',23:'b4 act=0'}),'Illustrative software commits, not collision outputs. Precomputed CPU actions; actual C latency unspecified. Fig 1/5.')
row(s,'sw.velocity b0', ['+vx']*14+['-vx']*14,'SOFTWARE STATE, not a drawn FPGA port. Example vertical-wall reflection flips vx at the position-update edge.')
row(s,'sw.health write',bus(n,{11:'P2=19',24:'P1=15'}),'Illustrative CPU HEALTH_BAR_REG writes: normal damage 1, special damage 5. Hardware only stores the requested word. Fig 1/5.')
row(s,'hp1 / hp2', ['20 / 20']*12+['20 / 19']*13+['15 / 19']*3,'Registered health values after CPU writes; no hardware health decrement occurs. Fig 5/12.')
s['notes']=['All masks initially zero; maze and bullets already initialized. No reset is asserted in this independent continuous window.',
 'Scan slot0 at 0 → wall_set at 2 → sticky mask at 3. After position write at 13, slot0 scan16 returns floor18.',
 'At 8/16 clear wins over a still-live hit; deactivation or separation must precede the final acknowledgement to avoid re-latching.',
 'Travel/reflection inputs are test stimulus. No claim that a bullet traverses a maze, or software performs all these calculations, in 28 clocks.']

# D: input debounce endpoints + timer endpoints, with honest gaps.
labels=list(range(8))+['D−2','D−1','D','D+1','D+2']+['R−2','R−1','R','R+1','R+2']+['T0','T1','T2','T3','T4','T5']+['E0','E1','E2','E3']
n=len(labels)
s=sheet('04_input_timers','D. Button conditioning, cooldown trigger and expiry — 28 visible columns',labels,
        'Independent windows separated by //: debounce terminal D; release terminal R; timer trigger T; long cooldown expiry E. 50 MHz assumption.',[8,13,18,24])
raw=[0,1,0,1,1,1,1,1]+[1]*5+[0]*5+[0]*10
sy1=[0,0,1,0,1,1,1,1]+[1]*5+[0]*5+[0]*10
sy2=[0,0,0,1,0,1,1,1]+[1]*5+[0]*5+[0]*10
stable=[0]*11+[1]*5+[0]*12
cnt=['0','0','0','0','1','0','1','2']+['M−2','M−1','M','M+1','0']*2+['0']*10
row(s,'btn_i (SHOOT)',raw,'Async physical button. Initial bounce is rejected. Button sampled between edges; no metastability simulated. Fig 3.')
row(s,'sync1_q',sy1,'First synchronizer flip-flop, one edge after sampled raw input. Fig 3.')
row(s,'sync2_q',sy2,'Second synchronizer flip-flop, one further edge later. Fig 3.')
row(s,'diff', [int(a!=b) for a,b in zip(sy2,stable)],'sync2_q XOR stable_q; counter resets whenever input returns to accepted level. Fig 3.')
row(s,'debounce cnt_q',cnt,'M=DEBOUNCE_MAX=500000 at 50 MHz. Terminal comparator reads current count; stable changes on following edge. Fig 3.')
row(s,'debounce done',bits(n,[10,15]),'Current count equals M. One pulse at press/release endpoint; not a shoot-command pulse. Fig 3.')
row(s,'stable_q',stable,'Accepted level, not edge event. Press accepted D+1; release R+1. Software detects an edge by comparing polls. Fig 3.')
row(s,'P1_INPUT [5:0]', ['10' if v else '00' for v in stable],'SHOOT is packed bit4; all other stimulus buttons zero. P2 input held zero. Fig 3.')
row(s,'cs_in',bits(n,[11,12]),'Read selection held across response while polling the accepted press. Fig 2a.')
row(s,'cs_in_q',bits(n,[12]),'One-clock registered read select in the shown input window; last held select continues into omitted time. Fig 2b.')
row(s,'d_rdata (consumed)',bus(n,{12:'0x00000010'}),'Input load response consumed at D+2; low word address held through read. Figs 2b/3.')
shoot=[0]*18+[0,500,500,500,500,500]+[1,1,0,0]
spec=[0]*18+[0,20000,20000,20000,20000,20000]+[1,1,0,0]
row(s,'tick (1 ms)',bits(n,[18,25]),'Terminal prescaler pulse, real ticks separated by 50000 clocks. T0 exercises simultaneous tick/trigger; E is an independent terminal-counter test. Fig 4.')
row(s,'trig_p1_shoot',bits(n,[18,21]),'T0 triggers shoot and special; T3 deliberately retriggers shoot while not ready. Hardware does not gate trigger by ready. Fig 4.')
row(s,'trig_p1_spec',bits(n,[18]),'T0 starts 20-second special cooldown. Trigger takes priority over tick/decrement. Fig 4.')
row(s,'cd_cnt shoot',shoot,'15-bit channel reload = 500 ms; holds without tick; nonzero counter decrements on tick. Fig 4.')
row(s,'cd_cnt special',spec,'15-bit special channel reload = 20000 ms. E window jumps to final remaining millisecond. Fig 4.')
row(s,'ready_p1_shoot',[int(x==0) for x in shoot],'High exactly when shoot counter zero. Counter does not underflow. Fig 4.')
row(s,'ready_p1_spec',[int(x==0) for x in spec],'High exactly when special counter zero. P2 channels idle/ready throughout. Fig 4.')
row(s,'TIMER_STATUS [3:0]',['F' if a==b==0 else 'C' for a,b in zip(shoot,spec)],'bit0 P1 shoot, bit1 P1 special, bit2 P2 shoot, bit3 P2 special. Fig 4.')
s['notes']=['Debounce gaps hide about 10 ms of sustained mismatch on each transition; M+1 column follows literal current-count comparator timing.',
 'T0 coincides with a real terminal tick: trigger wins over decrement. E is an independent endpoint test with both counters initially 1; not a simultaneous expiry claim.',
 'Normal software must check ready before shooting; hardware reloads even a busy channel if software writes a trigger. No FPGA fire-request pulse is drawn.']

# E: aligned source inputs; not full-frame travel.
n=28
s=sheet('05_pixel_mixer','E. Display pixel priority and blanking — 28 continuous clocks',range(n),
        'Aligned Fig 10 input test: HUD > big bullet > normal bullet > tank > wall > background. Final RGB registered once.')
active=[1]*24+[0]*4
wall=bits(n,range(2,n)); tank=bits(n,range(4,n)); small=bits(n,range(6,n)); big=bits(n,range(8,n)); hud=bits(n,range(10,14))
row(s,'active_d',active,'Delayed active qualifier at mixer input. Low blanks RGB regardless of layer valids. Fig 10.')
row(s,'maze_wall',wall,'Aligned wall valid. Floor RGB computed by Fig 11 does not override BG in the pictured mixer. Figs 10/11.')
row(s,'tank_valid',tank,'Combined tank valid after sprite ROM/combining register. Fig 9; input alignment assumed.')
row(s,'tank_valid_P2',bits(n,range(5,24)),'Both tanks hit the test pixel: P2 wins colour selection. Supplied as aligned test stimulus. Fig 9.')
row(s,'bullet_valid',small,'Normal bullet pixel valid overrides tank/wall. Figs 9/10.')
row(s,'big_valid',big,'Special bullet pixel valid overrides normal bullet. Figs 9/10.')
row(s,'hud_valid',hud,'Heart shape pixel has highest priority. Full and empty hearts both valid; health changes colour only. Figs 10/12.')
row(s,'hud_rgb',bus(n,{10:'F00',11:'F00',12:'444',13:'444'}),'Full red then empty grey heart test pixels; prealigned colour. Fig 12.')
row(s,'tank_rgb',['0F0']*5+['00F']*23,'P1 green then P2 blue on overlapping masks. Fig 9.')
colors=[]; layers=[]
for i in range(n):
    layer,color=('BLANK','000') if not active[i] else ('HUD','F00' if i<12 else '444') if hud[i] else ('BIG','F00') if big[i] else ('BULLET','FF0') if small[i] else ('TANK','0F0' if i<5 else '00F') if tank[i] else ('WALL','888') if wall[i] else ('BG','000')
    layers.append(layer); colors.append(color)
row(s,'selected layer',layers,'Diagnostic annotation for combinational priority; not an extra hardware bus. Fig 10.')
row(s,'pixel RGB (pre-FF)',colors,'12-bit value after blank mux, hex RGB444. Fig 10.')
row(s,'vga_rgb_q',['000']+colors[:-1],'One-clock registered output. active_d low at 24 → RGB black at 25. Fig 10.')
s['notes']=['Overlapping valid streams prove priority without claiming a fast full-screen scan. This is a mixer-input test.',
 'Transparent ROM pixels have valid=0 and reveal lower layers. Actual shape ROM bits are not specified in the block diagrams.']

# F/G: counter-driven independent boundary windows; include enough clocks for connector sync edges.
def boundary_sheet(name,title,starts,vertical=False):
    n=28
    s=sheet(name,title,range(n),'Four independent seven-clock windows; // separates preconditioned boundary tests. 50 MHz clk_sys, alternating 25 MHz pix_ce.',[7,14,21])
    accum={k:[] for k in ['ce','h','v','he','ve','lt','aq','hw','vw','ad','hs','vs','rgb']}
    for hx,vy in starts:
        # Enable 1,0,1,0...: initial counter is at its last interval before the boundary edge.
        h=hx; v=vy
        pa=int(h<640 and v<480); ph=int(656<=h<752); pv=int(490<=v<492)
        aq=pa; hw=ph; vw=pv; ac=[pa]*3; hc=[ph]*3; vc=[pv]*3; rgb='888' if pa else '000'
        for i in range(7):
            ce=1-i%2; he=int(h==799); ve=int(v==524); lt=ce*he
            vals=[ce,h,v,he,ve,lt,aq,hw,vw,ac[-1],1-hc[-1],1-vc[-1],rgb]
            for k,z in zip(accum,vals): accum[k].append(z)
            rgb='888' if ac[-1] else '000'
            ac=[aq]+ac[:-1]; hc=[hw]+hc[:-1]; vc=[vw]+vc[:-1]
            aq=int(h<640 and v<480); hw=int(656<=h<752); vw=int(490<=v<492)
            if ce:
                if he: h=0; v=0 if ve else v+1
                else: h+=1
    defs=[('pix_ce','ce','Counter enable, not a clock. Only enabled edges advance counters. Fig 8.'),
      ('hcnt_q / x','h','Horizontal counter 0–799; held on disabled pixel clocks. Fig 8.'),
      ('vcnt_q / y','v','Vertical counter advances on line_tick only; 524→0 at frame wrap. Fig 8.'),
      ('h_end','he','Current horizontal count equals 799; may span two clocks. Fig 8.'),
      ('v_end','ve','Current vertical count equals 524; requires line_tick for frame wrap. Fig 8.'),
      ('line_tick','lt','pix_ce AND h_end; advances vertical counter once per line. Fig 8.'),
      ('active_q','aq','Registered visible test h<640 AND v<480. Fig 8.'),
      ('hs_win_q','hw','Positive registered 656<=h<752 window; one chosen consistent polarity. Figs 8/10.'),
      ('vs_win_q','vw','Positive registered 490<=v<492 window. Figs 8/10.'),
      ('active_d','ad','Literal three-FF delay of active_q before blank mux. Fig 10.'),
      ('hsync_n','hs','NOT hs_win_q delayed three clocks, exactly one inversion. Fig 10.'),
      ('vsync_n','vs','NOT vs_win_q delayed three clocks, exactly one inversion. Fig 10.'),
      ('vga_rgb_q','rgb','RGB register consumes active_d one further clock later; steady nonblank test colour 888. Fig 10.')]
    for label,key,desc in defs: row(s,label,accum[key],desc)
    s['notes']=['Sync pin changes five displayed clocks after window start; RGB blank change follows one clock later under literal Fig 10.',
       'Each window has steady prehistory. // does not skip required counter values within a single continuous trace.',
       'Exact coordinate-to-output alignment is NOT established by these conflicting drawings; verify/reset RTL before relying on pin timing.']
    return s
s=boundary_sheet('06_vga_horizontal','F. VGA horizontal boundaries — visible blank, HS low, HS high, line wrap',[(639,100),(655,100),(751,100),(799,100)])
s=boundary_sheet('07_vga_vertical','G. VGA vertical boundaries — vertical blank, VS low, VS high, frame wrap',[(799,479),(799,489),(799,491),(799,524)],True)

# H: memory/register transactions and ROM pipeline tests, independent 7-clock windows.
n=28
s=sheet('08_memory_render','H. Maze coherence, tile boundary, sprite ROM and health HUD — 28 visible columns',range(n),
        'Independent windows: mirrored maze write/read | 24-pixel tile crossing | bullet visibility | HUD heart valid/colour. No same-address read/write collision tested.',[7,14,21])
row(s,'wr_en_maze',bits(n,[0]),'CPU maze write decode. Chosen tile5 address is in range. Fig 2a/7.')
row(s,'we_cpu (V and C)',bits(n,[0]),'Single range-qualified pulse drives BOTH maze copies. CPU is not stalled by independent read ports. Fig 7.')
row(s,'CPU maze address',bus(n,{0:'0x80000114',2:'0x80000114',3:'0x80000114'}),'Tile5 address = 0x80000100+4×5. Held for read at 2/3. Fig 7.')
row(s,'CPU maze wdata',bus(n,{0:'2'}),'Low two bits written: 2=breakable wall. Both copies update at right edge of column0. Fig 7.')
row(s,'RAM V[5] / C[5]', ['0 / 0']+['2 / 2']*6+['—']*21,'Mirrored stored tile contents; initialized floor then coherent update to breakable. Diagnostic memory-state annotation. Fig 7.')
row(s,'cs_maze',bits(n,[2,3]),'CPU read selects maze; only write pulse at0 alters copies. Fig 2a.')
row(s,'cs_maze_q',bits(n,[3,4]),'One-clock registered select; response consumed at3. Fig 2b.')
row(s,'CPU d_rdata',bus(n,{3:'0x00000002'}),'One-clock CPU BRAM read, zero-extended tile. Low address held through response. Fig 7/2b.')
row(s,'VGA / collision addr',bus(n,{2:'5 / 5',3:'5 / 5'}),'Independent read ports both request tile5 after write completed; no arbitration. Fig 7.')
row(s,'VGA / collision data',bus(n,{3:'2 / 2',4:'2 / 2'}),'Synchronous read data one clock after port addresses. Concurrent same-address write/read behaviour is NOT specified. Fig 7.')
row(s,'pix_ce',bits(n,[7,9,11,13]),'Tile test uses alternating enabled pixel edges at 50 MHz. Fig 8/11.')
row(s,'pixel x',bus(n,{7:'23',8:'24',9:'24',10:'25',11:'25',12:'26',13:'26'}),'Coordinate crosses 24-pixel tile boundary, y fixed0; disabled clocks hold. Fig 11.')
row(s,'sub_x / tile_col',bus(n,{7:'23 / 0',8:'0 / 1',9:'0 / 1',10:'1 / 1',11:'1 / 1',12:'2 / 1',13:'2 / 1'}),'Tile subcounter wraps23→0 and column advances at the same edge as x. Fig 11.')
row(s,'vga_tile_addr',bus(n,{7:'0',8:'1',9:'1',10:'1',11:'1',12:'1',13:'1'}),'row×20+col. Boundary test tile0=floor, tile1=wall; no division hardware. Fig 11.')
row(s,'vga_tile_data',bus(n,{7:'0',8:'0',9:'1',10:'1',11:'1',12:'1',13:'1'}),'Tile RAM returns preceding column address. Independent window has floor prehistory. Fig 7.')
row(s,'maze_wall_q',bits(n,range(10,14)),'Registered nonzero tile AND in_field_d. RAM then output FF gives two-clock coordinate-to-wall delay. Fig 11.')
row(s,'maze_rgb_q',bus(n,{7:'222',8:'222',9:'222',10:'888',11:'888',12:'888',13:'888'}),'Floor/wall stream colours. Floor222 is NOT selected as BG by literal Fig10. Fig 11.')
row(s,'bullet in_box',bits(n,[14,15,16,17]),'Bullet pixel bounding-box hit before FF; illustrative ROM shape=1 at these addresses. Fig 9.')
row(s,'bullet act',bits(n,[14,15]),'Source register alive until software clear effective at16. Delayed act must suppress ROM output. Fig 9.')
row(s,'in_box_d / shape',bus(n,{14:'0 / 0',15:'1 / 1',16:'1 / 1',17:'1 / 1',18:'1 / 1',19:'0 / 0',20:'0 / 0'}),'Bounding-box FF and synchronous shape ROM both delayed one clock. Shape stimulus chosen, not derived from absent ROM contents. Fig 9.')
row(s,'sprite act_d',bits(n,[15,16]),'Alive FF delayed one clock. act source cleared16 → act_d low17. Fig 9.')
row(s,'bN_small_hit',bits(n,[15,16]),'ROM shape AND delayed box AND delayed activity, normal bullet mode. Fig 9.')
row(s,'bullet_valid (combined)',bits(n,[16,17]),'Additional combined output FF mentioned in Fig9 PartC; one clock after small_hit. Alignment with other sources is assumed.')
row(s,'HUD slot / hp',bus(n,{21:'18 / 19',22:'19 / 19',23:'19 / 19',24:'19 / 19',25:'19 / 19',26:'19 / 19',27:'19 / 19'}),'slot<hp gives full heart. Slot19 empty when hp19; geometry within HUD strip. Fig 12.')
row(s,'HUD in_hud',bits(n,[21,22,23,24]),'Inside HUD row and strip. Independent illustrative pixel inputs; not a consecutive raster coordinate sweep. Fig 12.')
row(s,'HUD lit_d',bits(n,[21,22]),'One-clock registered slot<hp. Initial full prehistory, then empty slot accepted23. Fig 12.')
row(s,'HUD shape (ROM)',bits(n,[21,22,23,24,25]),'Chosen synchronous heart ROM bit=1; last shape output remains for one clock after leaving region. Fig 12.')
row(s,'hud_valid_q',bits(n,[21,22,23,24,25,26]),'Registered in_hud_d AND shape, two clocks after geometry. Empty hearts remain valid. Fig 12.')
row(s,'hud_rgb_q',bus(n,{21:'F00',22:'F00',23:'F00',24:'444',25:'444',26:'444',27:'444'}),'Final HUD colour FF consumes lit_d; independent of shape validity. Fig 12.')
s['notes']=['ROM outputs use illustrative shape bits since block diagrams contain no ROM image data. Streams are independent diagnostic tests.',
 'RAM same-address cross-port write/read mode and RAM reset contents are unspecified; this test avoids that collision and assumes preloaded tiles.',
 'Unqualified X tile restart at h_end in Fig11 must be checked when pix_ce=0; boundary tests use a qualified restart convention.']

# I: compact directed corner-case tests; separated transactions, not unspecified exception recovery.
n=28
s=sheet('09_cpu_corner_cases','I. CPU corner cases — loads, halfword lanes, x0, jump and exception detect',range(n),
        'Seven independent four-clock tests; // separates transactions. Valid inputs established before window. Trap/recovery not specified by diagrams.',[4,8,12,16,20,24])
row(s,'WB transaction', ['LB @0x101']*4+['LBU @0x101']*4+['LH @0x102']*4+['LHU @0x102']*4+['SH @0x102']*4+['write x0']*4+['JALR / detect']*4,'Independent transactions through load/store/control blocks. P2/P5/P6.')
row(s,'stall_read_i',bits(n,[0,4,8,12]),'Chosen initial read wait only for load tests. Return qualified once next clock. P6 assumption.')
row(s,'wb_read_data',bus(n,{0:'0x80008000',1:'0x80008000',4:'0x80008000',5:'0x80008000',8:'0x80008000',9:'0x80008000',12:'0x80008000',13:'0x80008000'}),'Test BRAM word; byte1=0x80, halfword1=0x8000. P6.')
row(s,'wb_write_en',bits(n,[1,5,9,13,20]),'Qualified writes; write x0 request may assert, but reads remain forced zero. Architectural x0 protection needs implementation check. P4.')
row(s,'wb_result',bus(n,{1:'0xFFFFFF80',5:'0x00000080',9:'0xFFFF8000',13:'0x00008000',20:'99'}),'LB/LH sign extension versus LBU/LHU zero extension. x0 attempted data99 does not change x0 read result. P6/P4.')
row(s,'d_we / store_en',bits(n,[16]),'SH transaction pulse; no load peripheral write. P6.')
row(s,'d_addr',bus(n,{16:'0x00000102'}),'Aligned halfword at upper pair of word0x100. Misaligned access/trap behaviour unspecified. P6.')
row(s,'d_wdata',bus(n,{16:'0xABCDABCD'}),'Halfword0xABCD replicated twice by store-data mux. P6.')
row(s,'d_wstrb',bus(n,{16:'1100'},'0000'),'SH upper pair at addr[1]=1. Lower SH uses0011; SB uses0001/0010/0100/1000; SW1111. P6.')
row(s,'zero1 / zero2',bus(n,{20:'1 / 1',21:'1 / 1',22:'1 / 1',23:'1 / 1'}),'Both source addresses0 force both read operands0, overriding even matching WB forwarding. P4.')
row(s,'reg_rdata1 / 2',bus(n,{20:'0 / 0',21:'0 / 0',22:'0 / 0',23:'0 / 0'}),'Consumed x0 read-port values; x0 is architecturally zero. P4.')
row(s,'branch_taken',bits(n,[24]),'JALR redirect unconditional. No target instruction retirement shown in this isolated comparator test. P5.')
row(s,'fetch_pc_o (JALR)',bus(n,{24:'0x000000C8'}),'rs1=201, immediate0 → target (201+0)&~1=200. JALR clears low bit. P5.')
row(s,'reset_n', [1]*26+[0,1],'Exception test reset qualifier. CPU reset/hold/squash priority not determined by this isolated equation test. P2.')
row(s,'illegal_inst',bits(n,[25,26]),'Explicit decoder illegal input stimulus; suppressed by reset_n=0 at26. P2.')
row(s,'instruction_i == 0',bits(n,[27]),'All-zero instruction also contributes to exception detect. A legal NOP0x13 does NOT. P2.')
row(s,'exception',bits(n,[25,27]),'(illegal_inst OR instruction_i==0) AND reset_n as drawn. Trap PC/cause/recovery outputs absent; no invented trap sequence. P2.')
s['notes']=['Aligned data-memory tests only. MMIO is word-only; SB/SH MMIO behaviour should not be inferred from data-memory lane tests.',
 'Normal ALU add/shift/logic/compare are selected combinationally; numeric examples in sheet A cover ADD, MUL, SLT, OR, LUI, SRAI and XOR.']

# Emit diagrams, machine-readable values and a signal dictionary for every plotted row.
for s in SHEETS:
    render(s)
(OUT/'timing_values.json').write_text(json.dumps(SHEETS,indent=2,ensure_ascii=False)+'\n')
defs=['# Timing-sheet signal dictionary','',
      'Every sheet shares `clk_sys`: the FPGA system clock. High/low square wave; left edge of each column is rising. All timing labels are illustrative, not RTL simulation.','']
for s in SHEETS:
    defs += ['## '+s['title'],'',s['subtitle'],'','| Signal | Meaning / source |','|---|---|']
    for r in s['rows']:
        defs += ['| `'+r['name']+'` | '+r['explanation'].replace('|','/').replace('\n',' ')+' |']
    defs += ['',*['- '+z for z in s['notes']],'']
(ROOT/'SIGNALS.md').write_text('\n'.join(defs)+'\n')
links=['<!doctype html><html><head><meta charset="utf-8"><title>Battle Tanks timing diagrams</title>',
       '<style>body{font:16px sans-serif;margin:24px;color:#182638}img{width:100%;min-width:1600px}section{overflow:auto;border:1px solid #ccd5df;margin:24px 0}a{color:#006e99}</style></head><body>',
       '<h1>Battle Tanks — diagram-derived timing examples</h1><p>Read <a href="README.md">scope and assumptions</a> and <a href="SIGNALS.md">every signal definition</a>. These are not simulation traces.</p>']
for s in SHEETS:
    links += ['<h2>'+html.escape(s['title'])+'</h2><p><a href="out/'+s['name']+'.svg">Open scalable SVG</a></p><section><img src="out/'+s['name']+'.svg"></section>']
(ROOT/'index.html').write_text('\n'.join(links)+'</body></html>\n')
print(f'Generated {len(SHEETS)} SVG sheets, values JSON, signal dictionary and HTML viewer.')

