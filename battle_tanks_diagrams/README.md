# Battle Tanks - block diagram

- `out/fig1_top_level.png` / `.svg` : top-level system block diagram (CPU, MMIO interconnect, input controller,
  cooldown timers, sprite/HUD registers, collision engine, maze RAM, VGA engine, mixer, connector).
- `src/` : Python generator (`python3 -c "import fig1_top; fig1_top.build().save('x.svg')"`, then `node render.mjs x.svg`).
  Edit pin names / labels in `src/fig1_top.py` and regenerate.

Items that are *design choices of this diagram*, not given in the project spec (change to match your RTL):
Tile size 24 px (20x20 -> 480x480), 2-bit tile code, 16 tank angles, 8 bullet slots, 12-bit RGB, 1 ms timer prescaler,
data memory at 0x0000_0000, addr[31] selecting the MMIO window, single bus-wide cs decode.
