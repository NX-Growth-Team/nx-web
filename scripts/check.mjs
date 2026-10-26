import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
const files = await walk(root);
const errors = [];
for (const file of files) {
  if (!(await stat(file)).size) errors.push(`Empty asset: ${file}`);
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file]);
  if (!/\.(html|css|js)$/.test(file)) continue;
  const source = await readFile(file, 'utf8');
  if (/figma\.com\/api\/mcp\/asset|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(source)) errors.push(`Temporary or external asset reference: ${file}`);
  const references = file.endsWith('.html')
    ? Array.from(source.matchAll(/(?:src|href)="([^"]+)"/g), match => match[1])
    : file.endsWith('.css') ? Array.from(source.matchAll(/url\("?([^"\)]+)"?\)/g), match => match[1])
    : Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g), match => match[1]);
  for (const reference of references) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(reference)) continue;
    const target = path.resolve(path.dirname(file), reference.split('#')[0]);
    try {
      const info = await stat(target);
      if (info.isDirectory()) await stat(path.join(target, 'index.html'));
    } catch { errors.push(`Missing reference in ${path.relative(root,file)}: ${reference}`); }
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${files.length} files: routes, local assets, and JavaScript syntax pass.`);
