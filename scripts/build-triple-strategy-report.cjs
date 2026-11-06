/* Build the portable HTML mechanically from the maintained report sources. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'web/public');
const destination = path.join(root, 'deliverables/spotlog-triple-strategy-20261028.html');
let html = fs.readFileSync(path.join(source, 'spotlog-triple-strategy.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="\.\/(reports\/[^\"]+)">/g,
  (_, file) => `<style>\n${fs.readFileSync(path.join(source, file), 'utf8')}\n</style>`);
const scripts = [];
html = html.replace(/<script defer src="\.\/(reports\/[^\"]+)"><\/script>/g, (_, file) => {
  scripts.push(fs.readFileSync(path.join(source, file), 'utf8'));
  return '';
});
html = html.replace('</body>', scripts.map(code => `<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n') + '\n</body>');
fs.mkdirSync(path.dirname(destination), {recursive:true});
fs.writeFileSync(destination, html, 'utf8');
console.log(JSON.stringify({output:destination,bytes:fs.statSync(destination).size}));
