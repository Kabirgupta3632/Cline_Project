#!/usr/bin/env python3
"""Bundle pre-rendered waveforms and all explanations into one zoomable PDF."""
from pathlib import Path
import re, html, json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
import reportlab
ROOT=Path(__file__).resolve().parent
font=Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont('Vera',str(font/'Vera.ttf')))
pdfmetrics.registerFont(TTFont('VeraBold',str(font/'VeraBd.ttf')))
pdfmetrics.registerFontFamily('Vera',normal='Vera',bold='VeraBold',italic='Vera',boldItalic='VeraBold')
OUT=ROOT/'out/battle_tanks_timing.pdf'
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('Battle Tanks — diagram-derived timing sheets and signal explanations')
c.setAuthor('Diagram-only analysis')
W,H=A4
styles={
 'body':ParagraphStyle('body',fontName='Vera',fontSize=8.5,leading=12,spaceAfter=5),
 'h1':ParagraphStyle('h1',fontName='VeraBold',fontSize=17,leading=22,spaceAfter=12),
 'h2':ParagraphStyle('h2',fontName='VeraBold',fontSize=12,leading=17,spaceAfter=9),
 'table':ParagraphStyle('table',fontName='Vera',fontSize=8,leading=11,spaceAfter=5)}
y=H-48
page=1

def footer():
    c.setFont('Vera',7); c.setFillColorRGB(.3,.35,.4)
    c.drawString(48,24,'Diagram-derived examples; not RTL simulation. // denotes time gaps or independent tests.')
    c.drawRightString(W-48,24,str(page)); c.setFillColorRGB(0,0,0)

def paragraph(text,style='body'):
    global y,page
    p=Paragraph(text,styles[style]); _,height=p.wrap(W-96,H-96)
    if y-height<45:
        footer(); c.showPage(); page+=1; c.setPageSize(A4); y=H-48
    p.drawOn(c,48,y-height); y-=height+styles[style].spaceAfter

paragraph('Battle Tanks<br/>Timing diagrams', 'h1')
paragraph('Analysis of rendered block diagrams only. Waveforms use the supplied clock/grid/bus/high-low style.')
paragraph('<b>Read this before using the diagrams</b>', 'h2')
paragraph('Nine independent sheets cover CPU, collision/game response, input conditioning, cooldown, maze/register paths and VGA. Most sheets use 28 visible clock columns. They do not represent one complete game iteration in 28 clocks.')
paragraph('Normal DIV needs 32 iterations. Debounce and cooldown need many more clocks. Long operations and widely separated VGA boundaries use clearly marked // time breaks or independent preconditioned tests. No circuit is sped up.')
paragraph('Some CPU and sync controls conflict across the source diagrams. Explicit timing conventions and limitations are included after the waveform pages. Every signal has a definition. Software-only state is labelled sw.*.')
paragraph('Waveform pages are intentionally wide: zoom for reading; use fit-to-page or poster/tile printing. The PNG and scalable SVG originals are also supplied.')
for s in json.loads((ROOT/'out/timing_values.json').read_text()):
    paragraph(html.escape(s['title'])+' — '+str(len(s['labels']))+' visible columns')
footer(); c.showPage(); page+=1
for p in sorted((ROOT/'out').glob('*.png')):
    with Image.open(p) as im: iw,ih=im.size
    c.setPageSize((iw*.5,ih*.5))
    c.drawImage(str(p),0,0,width=iw*.5,height=ih*.5)
    c.showPage(); page+=1
c.setPageSize(A4); y=H-48
for file in ('README.md','SIGNALS.md'):
    if file=='SIGNALS.md':
        footer(); c.showPage(); page+=1; c.setPageSize(A4); y=H-48
    for line in (ROOT/file).read_text().splitlines():
        if not line.strip(): y-=5; continue
        if line.startswith('|---'): continue
        style='h1' if line.startswith('# ') else 'h2' if line.startswith('## ') else 'body'
        line=re.sub(r'^#{1,3} ','',line)
        if line.startswith('|'):
            cols=[x.strip() for x in line.strip('|').split('|')]
            line=' · '.join(cols); style='table'
        line=html.escape(line)
        line=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',line)
        line=re.sub(r'`(.*?)`',r'<b>\1</b>',line)
        paragraph(line,style)
footer(); c.save()
print(f'Created {OUT.name}: {page} pages including 9 waveform pages and complete explanations.')
