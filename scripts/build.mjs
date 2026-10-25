import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
const out = 'outputs/obsidian-outlook-drop';
execFileSync('node_modules/.bin/tsc', ['--noEmit'], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });
const result = await build({ metafile: true, minify: true, entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'], format: 'cjs', platform: 'node', target: 'es2020', outfile: `${out}/main.js` });
writeFileSync(`${out}/bundle-meta.json`, JSON.stringify(result.metafile));
execFileSync('python3', ['scripts/third-party-notices.py'], { stdio: 'inherit' });
// Conventional build artifact used by the Community release verifier.
copyFileSync(`${out}/main.js`, 'main.js');
