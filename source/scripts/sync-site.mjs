// Copies the production build into the repository root, which GitHub Pages
// serves as-is ("Deploy from a branch", no GitHub Actions).
//
// Only the files this script published last time (listed in /.site-files) are
// removed before copying — nothing else in the root is ever touched.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(sourceDir, '..');
const dist = join(sourceDir, 'dist', 'lol-photobooth', 'browser');
const manifest = join(repoRoot, '.site-files');
const PROTECTED = new Set(['.git', '.gitignore', '.nojekyll', '.site-files', 'README.md', 'source', 'retro']);

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build found in ${dist} — run "ng build" first.`);
  process.exit(1);
}

const built = readdirSync(dist).sort();
const clash = built.find((name) => PROTECTED.has(name));
if (clash) {
  console.error(`The build contains "${clash}", which would overwrite a protected file in the repo root.`);
  process.exit(1);
}

// 1. Remove what the previous publish put in the root.
const previous = existsSync(manifest) ? readFileSync(manifest, 'utf8').split(/\r?\n/).filter(Boolean) : [];
for (const entry of previous) {
  const target = resolve(repoRoot, entry);
  const insideRoot = target.startsWith(repoRoot + sep);
  if (!insideRoot || target === sourceDir || target.startsWith(sourceDir + sep) || PROTECTED.has(entry)) continue;
  rmSync(target, { recursive: true, force: true });
}

// 2. Copy the fresh build in.
for (const name of built) {
  cpSync(join(dist, name), join(repoRoot, name), { recursive: true });
}

// 3. Serve the files exactly as built (no Jekyll) and remember what was published.
writeFileSync(join(repoRoot, '.nojekyll'), '');
writeFileSync(manifest, `${built.join('\n')}\n`);
console.log(`Site published to the repo root: ${built.join(', ')}`);
