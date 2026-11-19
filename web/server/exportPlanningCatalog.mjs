import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { projectPublicPlanningCatalog } from './publicPlanningCatalog.mjs';

const entryId = 'spotlog:planning-catalog';
const assetStub = '\0spotlog:planning-asset';
const source = relative => fileURLToPath(new URL(relative, import.meta.url));

async function readSeedCatalog() {
  const bundle = await build({
    root: source('../'),
    configFile: false,
    envDir: false,
    publicDir: false,
    logLevel: 'warn',
    plugins: [{
      name: 'spotlog-public-planning-seed',
      enforce: 'pre',
      resolveId(id) {
        if (id === entryId) return '\0' + id;
        if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(id)) return assetStub;
      },
      load(id) {
        if (id === assetStub) return "export default '';";
        if (id === '\0' + entryId) return [
          `export { placeCatalog } from ${JSON.stringify(source('../src/data.ts'))};`,
          `export { interestPlaceRegion } from ${JSON.stringify(source('../src/interestCollectionStore.ts'))};`,
        ].join('\n');
      },
    }],
    build: { ssr: true, write: false, target: 'node22', minify: false, rolldownOptions: { input: entryId } },
  });
  const outputs = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(item => item.output || []);
  const [entry] = outputs;
  if (outputs.length !== 1 || entry?.type !== 'chunk' || entry.imports.length || entry.dynamicImports.length) {
    throw new Error('공개 장소 데이터만 포함하는 번들을 만들지 못했어요.');
  }
  return import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`);
}

if (process.argv.length !== 3 || !process.argv[2]?.trim()) {
  console.error('Usage: node web/server/exportPlanningCatalog.mjs <output.json>');
  process.exitCode = 1;
} else {
  const output = resolve(process.argv[2]);
  const { placeCatalog, interestPlaceRegion } = await readSeedCatalog();
  const rows = projectPublicPlanningCatalog(placeCatalog, interestPlaceRegion);
  await mkdir(dirname(output), { recursive: true });
  const staging = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(staging, JSON.stringify(rows) + '\n', { encoding: 'utf8', flag: 'wx' });
    await rename(staging, output);
  } finally {
    await rm(staging, { force: true });
  }
  console.log(`Wrote ${rows.length} public places to ${output}`);
}
