import { Resvg } from '/tmp/r/node_modules/@resvg/resvg-js/index.js';
import fs from 'fs';
const d = '/tmp/r/node_modules/dejavu-fonts-ttf/ttf/';
const fonts = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf'].map(f => d + f);
for (const f of process.argv.slice(2)) {
  const r = new Resvg(fs.readFileSync(f), { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' }, fitTo: { mode: 'zoom', value: 1 } });
  fs.writeFileSync(f.replace(/\.svg$/, '.png'), r.render().asPng());
  console.log('ok', f);
}
