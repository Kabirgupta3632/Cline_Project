#!/usr/bin/env python3
"""Check illustrative waveform data, not RTL."""
import json
from pathlib import Path
S=json.loads((Path(__file__).parent/'out/timing_values.json').read_text())
def r(k,name):
    return next(z['values'] for z in S[k]['rows'] if z['name']==name)
for s in S:
    assert len(s['labels'])<30
    for z in s['rows']:
        assert len(z['values'])==len(s['labels'])
        assert z['explanation']
        if z['kind']=='bit': assert set(z['values']) <= {0,1}
# Pipeline next-stage advance under selected hold convention.
ex=r(0,'EX instruction'); wb=r(0,'MEM + WB instruction')
for i in range(3,27):
    if i in (6,16): continue
    assert wb[i+1].split('(')[0].replace('×','')==ex[i].split('(')[0].replace('×',''),i
assert r(0,'fetch_pc [31:0]')[6:8]==[20,20]
assert r(0,'fetch_pc [31:0]')[11:13]==[36,64]
for i in (13,14):
    assert r(0,'d_we / store_en')[i]==r(0,'wb_write_en')[i]==0
assert r(0,'fwd_sel1')[20]==1  # P writeback must forward x9=-1 to Q's signed compare.
for port in (1,2):
    source=r(0,f'rs{port}_select'); dest=r(0,'wb_dest_reg_sel'); en=r(0,'wb_write_en')
    for i,reg in enumerate(source):
        if reg=='—': continue
        expected=int(bool(en[i]) and reg==dest[i] and reg!='0')
        assert r(0,f'fwd_sel{port}')[i]==expected,(port,i)
for i in range(1,28):
    assert r(0,'cs_in_q')[i]==r(0,'cs_in')[i-1]
assert r(0,'d_wstrb [3:0]')[19]=='0010'
assert r(0,'wb_result')[7]=='32' and r(0,'ALU operand 1')[7]=='32'
# Normal divisor loop really has 32 clocks, including hidden columns9..28.
labels=S[1]['labels']; busy=r(1,'busy')
assert [int(labels[i]) for i in range(len(labels)) if busy[i]][-1]==32
assert sum(busy)+20==32
assert r(1,'last_cycle')[12]==1 and r(1,'done')[13]==1
assert not r(1,'pipeline_stall')[13]
# Wall tag / activity alignment and clear-dominant sticky equation.
for i in range(2,28):
    assert r(2,'scan_d [2:0]')[i]==(i-2)%8
    tile=r(2,'tile (wall port)')[i]
    expected=(1<<((i-2)%8)) if tile!='0' and r(2,'act_d')[i] else 0
    assert int(r(2,'wall_set [7:0]')[i],16)==expected
for name,setname,addr in [('WALL_MASK','wall_set [7:0]','0x24'),('BB_MASK','bb_hit [7:0]','0x28'),('HIT_MASK','btk_hit [7:0]','0x2C')]:
    q=r(2,name); st=r(2,setname)
    for i in range(27):
        setv=int(st[i],16)
        if name=='HIT_MASK': setv|=int(r(2,'tank_set [1:0]')[i],16)<<8
        cl=int(r(2,'clear d_wdata')[i],16) if r(2,'clear address (offset)')[i]==addr else 0
        assert int(q[i+1],16)==(int(q[i],16)|setv)&~cl,(name,i)
assert r(2,'HIT_MASK')[9]=='000' and r(2,'HIT_MASK')[10]=='208'
assert r(2,'BB_MASK')[17]=='00' and r(2,'BB_MASK')[18]=='06'
# Debouncer literal counter comparator and registered stable output.
for a,b in [(0,8),(8,13),(13,18)]:
    for i in range(a,b-1):
        expected=r(3,'sync2_q')[i] if r(3,'debounce done')[i] else r(3,'stable_q')[i]
        assert r(3,'stable_q')[i+1]==expected
for key,trig,load in [('cd_cnt shoot','trig_p1_shoot',500),('cd_cnt special','trig_p1_spec',20000)]:
    for a,b in [(18,24),(24,28)]:
        for i in range(a,b-1):
            q=r(3,key)[i]
            expected=load if r(3,trig)[i] else q-1 if r(3,'tick (1 ms)')[i] and q else q
            assert r(3,key)[i+1]==expected
# Mixer register and priority under blank override.
assert r(4,'vga_rgb_q')[1:]==r(4,'pixel RGB (pre-FF)')[:-1]
assert r(4,'big_valid')[24] and r(4,'pixel RGB (pre-FF)')[24]=='000'
# VGA counters, register delay/inversion, output blank lag.
for k in (5,6):
    for a in (0,7,14,21):
        for i in range(a,a+6):
            h,v=r(k,'hcnt_q / x')[i],r(k,'vcnt_q / y')[i]
            c=r(k,'pix_ce')[i]
            assert r(k,'hcnt_q / x')[i+1]==((h+1)%800 if c else h)
            assert r(k,'vcnt_q / y')[i+1]==((v+1)%525 if c and h==799 else v)
            assert r(k,'active_q')[i+1]==int(h<640 and v<480)
            assert r(k,'vga_rgb_q')[i+1]==('888' if r(k,'active_d')[i] else '000')
        for i in range(a+3,a+7):
            assert r(k,'active_d')[i]==r(k,'active_q')[i-3]
            assert r(k,'hsync_n')[i]==1-r(k,'hs_win_q')[i-3]
            assert r(k,'vsync_n')[i]==1-r(k,'vs_win_q')[i-3]
assert r(7,'bullet_valid (combined)')[15:20]==[0,1,1,0,0]
assert r(8,'exception')[25:]==[1,0,1]
print('PASS: 9 sheets; cycle bounds, holds, squash, divider, sticky masks, debounce/timers, mixer, VGA and corner cases.')
