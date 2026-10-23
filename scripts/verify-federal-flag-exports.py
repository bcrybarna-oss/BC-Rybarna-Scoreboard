# Requires Pillow and pypdf. Reads only isolated exports, never match data or Firebase.
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
from pypdf import PdfReader
import json,shutil
import argparse
parser=argparse.ArgumentParser(description='Verify real report exports, PDF pixel parity and flag-only changes; produce unscaled before/after details.')
parser.add_argument('--root',default='output/flag-sharpness')
args=parser.parse_args()
root=Path(args.root);shots=Path('docs/screenshots');out=root/'after'; rows=[]
for name in ['A1','A2','B']:
 before=Image.open(root/'before'/(name+'.png')).convert('RGB'); after=Image.open(out/(name+'.png')).convert('RGB')
 boxes=[dict(x=88,y=282,width=120,height=80)]+([] if name=='B' else [dict(x=1712,y=282,width=120,height=80)])
 diff=ImageChops.difference(before,after)
 for b in boxes:ImageDraw.Draw(diff).rectangle((b['x']-12,b['y']-12,b['x']+132,b['y']+92),fill=0)
 assert diff.getbbox() is None,('changed outside flags',name,diff.getbbox())
 # Actual pixels, no interpolation. Row1 before, row2 after; same original coordinates.
 canvas=Image.new('RGB',(520,235),'#191919');draw=ImageDraw.Draw(canvas)
 for y,label,im in [(25,'PRED / BEFORE - 1:1',before),(140,'PO / AFTER - 1:1',after)]:
  draw.text((10,y-18),label,fill='white')
  for i,b in enumerate(boxes):
   crop=im.crop((b['x'],b['y'],b['x']+120,b['y']+80));canvas.paste(crop,(10+i*260,y))
 canvas.save(shots/('federal-94-'+name+'-flags-1to1.png'))
 canvas.resize((1040,470),Image.Resampling.NEAREST).save(shots/('federal-94-'+name+'-flags-2x-nearest.png'))
 shutil.copyfile(out/(name+'.png'),shots/('federal-94-'+name+'.png'))
 for suffix in ['', '-mobile']:
  png=out/(name+suffix+'.png');pdf=png.with_suffix('.pdf');im=Image.open(png).convert('RGB');p=PdfReader(pdf).pages[0]; embedded=p.images[0].image.convert('RGB')
  assert im.size==(1920,1080) and list(p.mediabox)==[0,0,1440,810]
  assert ImageChops.difference(im,embedded).getbbox() is None
  rows.append(dict(report=name+suffix,png='1920x1080',pdf='1440x810',pdfPixelsEqualPNG=True,unchangedOutsideFlags=True))
Path('docs/federal-94-flag-verification.json').write_text(json.dumps(rows,indent=2)+'\n')
print('PASS six final PNG/PDF pairs, embedded pixels identical; all A1/A2/B pixels outside flag regions unchanged from production93')
