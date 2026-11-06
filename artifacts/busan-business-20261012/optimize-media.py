from pathlib import Path
import json
import hashlib
from PIL import Image, ImageOps

root = Path('C:/Users/Giry/Documents/Spotlog')
assets = (root / 'assets/spotlog/busan-business').resolve()
manifest_path = assets / 'ATTRIBUTION.json'
entries = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
entries = [entry for entry in entries if entry['placeId'] != 'catalog-busan-namaste' and entry['id'] != 'busan-business-metadata002340']
sizes = []
for entry in entries:
    original = (assets / entry['asset']).resolve()
    assert original.parent == assets
    image = ImageOps.exif_transpose(Image.open(original)).convert('RGB')
    image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    output = original.with_suffix('.webp')
    image.save(output, 'WEBP', quality=84, method=6)
    sizes.append({'asset': output.name, 'originalBytes': original.stat().st_size,
                  'bytes': output.stat().st_size, 'width': image.width, 'height': image.height})
    entry['asset'] = output.name
    entry['sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
    entry['changes'] = '화면용으로 비율을 유지해 최대 1200px로 축소하고 WebP로 변환. 화면 비율에 따라 일부가 잘려 보일 수 있음.'
manifest_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf-8')
(root / 'artifacts/busan-business-20261012/media-optimization.json').write_text(json.dumps({
    'images': len(sizes), 'originalBytes': sum(row['originalBytes'] for row in sizes),
    'bytes': sum(row['bytes'] for row in sizes), 'files': sizes,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'images': len(sizes), 'bytes': sum(row['bytes'] for row in sizes)}))
