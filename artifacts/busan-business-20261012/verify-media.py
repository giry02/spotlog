from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont, ImageOps

root = Path('C:/Users/Giry/Documents/Spotlog')
assets = root / 'assets/spotlog/busan-business'
entries = json.loads((assets / 'ATTRIBUTION.json').read_text(encoding='utf-8'))
output = Image.new('RGB', (1200, math.ceil(len(entries) / 5) * 220), 'white')
draw = ImageDraw.Draw(output)
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 13)
small_font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 10)
errors = []
rows = []
for index, source in enumerate(entries):
    filename = assets / source['asset']
    try:
        image = Image.open(filename).convert('RGB')
        x, y = (index % 5) * 240, (index // 5) * 220
        output.paste(ImageOps.fit(image, (230, 170)), (x, y))
        draw.text((x + 4, y + 175), source['title'], fill='black', font=font)
        draw.text((x + 4, y + 194), source['id'].replace('busan-business-', ''), fill='#666666', font=small_font)
        rows.append({'asset': filename.name, 'width': image.width, 'height': image.height,
                     'bytes': filename.stat().st_size, 'sourceId': source['id'], 'placeId': source['placeId']})
    except Exception as error:
        errors.append({'asset': filename.name, 'error': str(error)})
output.save(root / 'artifacts/busan-business-20261012/media-contact-sheet.png')
(root / 'artifacts/busan-business-20261012/media-integrity.json').write_text(json.dumps({
    'images': len(rows), 'bytes': sum(row['bytes'] for row in rows), 'sizes': rows, 'errors': errors,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'images': len(rows), 'errors': errors}))
