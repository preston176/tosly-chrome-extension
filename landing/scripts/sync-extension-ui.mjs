/*
  Copies the extension's real UI source into landing/src/vendor/tosly-ui so the
  live demo renders the actual product interface rather than a screenshot or a
  reimplementation.

  Why copy instead of importing across packages: extension/tsconfig.json extends
  "plasmo/templates/tsconfig.base", and Vite's esbuild walks up to find that
  tsconfig when transforming a file in that directory. Resolving it would require
  the extension's node_modules to be installed just to build the website. Copying
  keeps the extension as the single source of truth while letting this site build
  on its own.

  The vendored output is committed so builds are reproducible and so UI changes
  show up in review diffs. Run `bun run sync-ui` (or any build) to refresh it.
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const extension = path.join(root, '..', 'extension');
const outDir = path.join(root, 'src', 'vendor', 'tosly-ui');

const HEADER = (from) =>
  `/* GENERATED FILE, DO NOT EDIT.\n` +
  ` * Copied from extension/${from} by landing/scripts/sync-extension-ui.mjs\n` +
  ` * Edit the extension source, then run: bun run sync-ui\n */\n`;

const FILES = [
  { from: 'types.ts', to: 'types.ts' },
  { from: 'components/result-panel.tsx', to: 'result-panel.tsx' },
];

await mkdir(outDir, { recursive: true });

for (const f of FILES) {
  const src = path.join(extension, f.from);
  let code;
  try {
    code = await readFile(src, 'utf8');
  } catch {
    console.error(`sync-extension-ui: missing ${path.relative(root, src)}`);
    process.exit(1);
  }
  // Plasmo's `~` alias has no meaning here; point it at the sibling copy.
  code = code.replace(/from ["']~types["']/g, `from "./types"`);
  await writeFile(path.join(outDir, f.to), HEADER(f.from) + code);
  console.log(`sync-extension-ui: ${f.from} -> src/vendor/tosly-ui/${f.to}`);
}
