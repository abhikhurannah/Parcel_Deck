import { readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync, strToU8, unzipSync } from 'fflate';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folders = new Set([
  'client',
  'server',
  'shared',
  'tests',
  'docs',
  'examples',
  'scripts',
  'deploy',
  '.github',
]);
const files = new Set([
  'README.md',
  'eslint.config.mjs',
  '.prettierrc.json',
  '.prettierignore',
  'vitest.config.ts',
  'playwright.config.ts',
  'compose.demo.yaml',
  '.nvmrc',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.server.json',
  'vite.config.ts',
  'Dockerfile',
  'compose.yaml',
  '.gitignore',
  '.dockerignore',
  '.env.example',
]);
const entries = {},
  manifest = {};
async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name),
      stat = await lstat(path),
      rel = relative(root, path).split('\\').join('/');
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (directory === root && !folders.has(name)) continue;
      if (['node_modules', '__pycache__', '.pytest_cache'].includes(name)) continue;
      await walk(path);
    } else if (
      (folders.has(rel.split('/')[0]) || files.has(rel)) &&
      !/\.(py|pyc|sqlite3)$/.test(name) &&
      name !== '.DS_Store'
    ) {
      const data = await readFile(path);
      entries['parcel-routing/' + rel] = data;
      manifest[rel] = createHash('sha256').update(data).digest('hex');
    }
  }
}
await walk(root);
entries['parcel-routing/MANIFEST.sha256.json'] = strToU8(JSON.stringify(manifest, null, 2) + '\n');
const archive = zipSync(entries, { level: 6 });
const decoded = unzipSync(archive);
for (const [name, digest] of Object.entries(manifest))
  if (
    createHash('sha256')
      .update(decoded['parcel-routing/' + name])
      .digest('hex') !== digest
  )
    throw new Error('Archive verification failed: ' + name);
const output = join(dirname(root), 'ParcelDesk-React-TypeScript-Submission.zip');
await writeFile(output, archive);
await writeFile(join(dirname(root), 'ParcelDesk-Improved-Final.zip'), archive);
await writeFile(join(dirname(root), 'ParcelDesk-Submission.zip'), archive);
console.log(
  JSON.stringify(
    {
      output,
      files: Object.keys(entries).length,
      bytes: archive.length,
      sha256: createHash('sha256').update(archive).digest('hex'),
    },
    null,
    2,
  ),
);
