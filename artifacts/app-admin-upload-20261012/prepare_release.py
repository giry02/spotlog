from pathlib import Path
import hashlib
import json
import shutil
import subprocess

source = Path('C:/Users/Giry/Documents/Spotlog').resolve()
destination = Path('C:/Users/Giry/.codex/worktrees/app-admin-release-20261012/Spotlog').resolve()
assert source.is_dir() and destination.is_dir() and source != destination
assert destination.parent.name == 'app-admin-release-20261012'
entries = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z', '--untracked-files=all'], cwd=source).decode('utf-8').split('\0')
copied = []
excluded = []
for entry in entries:
    if not entry:
        continue
    status, name = entry[:2], entry[3:]
    if 'R' in status or 'C' in status:
        raise RuntimeError('Review rename separately before preparing release')
    path = Path(name)
    if name.startswith('artifacts/') or (name.startswith('docs/execution/admin-') and path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.log', '.txt'}):
        excluded.append(name)
        continue
    if any(part in {'node_modules', 'dist', '.expo', '.git'} for part in path.parts) or (path.name.startswith('.env') and path.name != '.env.example'):
        raise RuntimeError('Unexpected excluded/private candidate: ' + name)
    if status.strip() == 'D':
        raise RuntimeError('Review deletion separately before preparing release: ' + name)
    original = (source / path).resolve()
    target = (destination / path).resolve()
    assert original.is_relative_to(source) and target.is_relative_to(destination)
    if not original.is_file():
        raise RuntimeError('Expected a file: ' + name)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(original, target)
    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    copied.append({'path': name, 'bytes': original.stat().st_size, 'sha256': digest})
out = source / 'artifacts/app-admin-upload-20261012'
out.mkdir(parents=True, exist_ok=True)
(out / 'source-manifest.json').write_text(json.dumps({'source': str(source), 'destination': str(destination), 'files': copied, 'excludedCount': len(excluded)}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'copied': len(copied), 'bytes': sum(row['bytes'] for row in copied), 'excluded': len(excluded)}, ensure_ascii=False))
