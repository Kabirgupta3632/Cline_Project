// Export one sheet at a time to keep memory bounded.
// Usage: node export_png.cjs /absolute/path/to/@resvg/resvg-js /absolute/path/to/font.ttf
const fs = require('fs');
const path = require('path');
const { Resvg } = require(process.argv[2] || '@resvg/resvg-js');
const dir = path.join(__dirname, 'out');
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort()) {
  const image = new Resvg(fs.readFileSync(path.join(dir, file)), {
    font: { loadSystemFonts: false, fontFiles: process.argv[3] ? [process.argv[3]] : [], defaultFontFamily: 'Bitstream Vera Sans' }
  });
  fs.writeFileSync(path.join(dir, file.replace('.svg', '.png')), image.render().asPng());
  console.log(file.replace('.svg', '.png'));
}
