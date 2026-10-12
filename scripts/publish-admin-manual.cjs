const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const source = path.join(project, 'docs/manual/admin-20261012');
const destination = path.join(project, 'web/dist/manual/admin');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manual-data.json'), 'utf8'));
if (!fs.existsSync(path.join(project, 'web/dist/index.html'))) throw new Error('Build the web application before publishing the manual.');
fs.mkdirSync(destination, { recursive: true });
for (const file of ['index.html', 'manual.css', 'manual.js', 'spotlog-admin-manual.html']) fs.copyFileSync(path.join(source, file), path.join(destination, file));
const images = new Set(manifest.pages.map(page => page.image));
for (const image of images) {
  if (!/^assets\/[a-z0-9-]+\.png$/.test(image)) throw new Error(`Invalid manual asset: ${image}`);
  fs.mkdirSync(path.dirname(path.join(destination, image)), { recursive: true });
  fs.copyFileSync(path.join(source, image), path.join(destination, image));
}
console.log(`Published administrator manual: ${manifest.pages.length} screens, ${images.size} images.`);
