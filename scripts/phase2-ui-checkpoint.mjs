import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Apply the shared, CSS-only itinerary refinement to each frozen week separately.
// This preserves both original checkpoints and does not create commits or refs.
const root = resolve(import.meta.dirname, '..');
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
const store = resolve(root, git(['rev-parse', '--git-dir']), 'spotlog-phase2');
const cssPath = 'web/src/personal-trip-refinement.css';
const componentPath = 'web/src/PersonalTrip.tsx';
const css = readFileSync(join(root, cssPath), 'utf8');

for (const week of ['week1', 'week2']) {
  const original = JSON.parse(readFileSync(join(store, week, 'manifest.json'), 'utf8'));
  const stage = `${week}-ui1`;
  const output = join(store, stage);
  if (existsSync(join(output, 'manifest.json'))) throw new Error(`Preserve existing ${stage}`);
  mkdirSync(output, { recursive: true });
  const index = join(output, 'snapshot.index');
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const originalComponent = git(['show', `${original.tree}:${componentPath}`]);
  const anchor = "import './trip-plan.css';";
  if (!originalComponent.includes(anchor)) throw new Error('Missing itinerary style import');
  const component = originalComponent.replace(anchor, `${anchor}\nimport './personal-trip-refinement.css';`) + '\n';
  try {
    git(['read-tree', original.tree], { env });
    for (const [path, source] of [[cssPath, css], [componentPath, component]]) {
      const blob = git(['hash-object', '-w', '--stdin'], { input: source });
      git(['update-index', '--add', '--cacheinfo', '100644', blob, path], { env });
    }
    const tree = git(['write-tree'], { env });
    const patch = execFileSync('git', ['diff', '--binary', '--full-index', original.tree, tree], { cwd: root });
    writeFileSync(join(output, 'changes.patch'), patch);
    git(['read-tree', original.tree], { env });
    git(['apply', '--cached', join(output, 'changes.patch')], { env });
    if (git(['write-tree'], { env }) !== tree) throw new Error('UI patch replay failed');
    execFileSync('git', ['archive', '--format=zip', `--output=${join(output, 'source.zip')}`, tree], { cwd: root });
    execFileSync('git', ['archive', '--format=zip', `--output=${join(output, 'build-source.zip')}`, tree, 'web', 'assets', 'shared'], { cwd: root });
    const manifest = { stage, head: original.head, parentTree: original.tree, tree, createdAt: new Date().toISOString(), patch: 'changes.patch', archive: 'source.zip', published: false, files: [cssPath, componentPath] };
    writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ stage, tree, output, patchChecked: true }));
  } finally { if (existsSync(index)) unlinkSync(index); }
}

// A later week2 upgrade must retain the refinement already shown in week1.
const first = JSON.parse(readFileSync(join(store, 'week1-ui1/manifest.json'), 'utf8'));
const second = JSON.parse(readFileSync(join(store, 'week2-ui1/manifest.json'), 'utf8'));
writeFileSync(join(store, 'week2-ui1/from-week1-ui1.patch'), execFileSync('git', ['diff', '--binary', '--full-index', first.tree, second.tree], { cwd: root }));
