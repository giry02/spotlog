from pathlib import Path
import json
import subprocess
from pypdf import PdfReader
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent
poppler = Path('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
results = []
for name, expected in [('development', 32), ('ai-guide', 34)]:
    pdf = root / (name + '.pdf')
    reader = PdfReader(pdf)
    assert len(reader.pages) == expected, (name, len(reader.pages))
    texts = [page.extract_text() for page in reader.pages]
    for i, text in enumerate(texts):
        assert len(text.strip()) > 100, (name, i + 1, 'empty or incomplete page')
        assert f'{i+1:02} / {expected}' in text, (name, i + 1, 'folio missing')
    subprocess.run([str(poppler), '-r', '72', '-png', str(pdf), str(root / (name + '-print'))], check=True)
    for start in range(1, expected + 1, 6):
        sheet = Image.new('RGB', (1820, 1770), '#e9ebed')
        for j in range(6):
            index = start + j
            if index > expected:
                break
            image = Image.open(root / f'{name}-print-{index:02}.png').convert('RGB')
            assert image.size == (900, 576), image.size
            sheet.paste(image, ((j % 2) * 910, (j // 2) * 590))
        sheet.save(root / f'{name}-print-contact-{start}.png')
    results.append({'name': name, 'pages': len(texts), 'characters': sum(map(len, texts)), 'minimum_page_characters': min(map(len, texts))})
(root / 'pdf-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
