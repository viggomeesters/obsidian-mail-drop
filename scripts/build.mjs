import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const out = 'outputs/obsidian-outlook-drop';
execFileSync('node_modules/.bin/tsc', ['--noEmit'], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });
const result = await build({ metafile: true, minify: true, entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'], format: 'cjs', platform: 'node', target: 'es2020', outfile: `${out}/main.js` });
writeFileSync(`${out}/bundle-meta.json`, JSON.stringify(result.metafile));
execFileSync('python3', ['scripts/third-party-notices.py'], { stdio: 'inherit' });
if (process.platform !== 'darwin') {
  throw new Error('A full release requires macOS and Xcode Command Line Tools to build the native receiver.');
}
for (const arch of ['arm64', 'x86_64']) {
  execFileSync('swiftc', ['-O', '-target', `${arch}-apple-macosx13.0`, 'native/outlook-file-promises.swift', '-o', `${out}/receiver-${arch}`], { stdio: 'inherit' });
}
execFileSync('lipo', ['-create', `${out}/receiver-arm64`, `${out}/receiver-x86_64`, '-output', `${out}/outlook-file-promises`], { stdio: 'inherit' });
execFileSync('codesign', ['--force', '--sign', '-', `${out}/outlook-file-promises`], { stdio: 'inherit' });
for (const arch of ['arm64', 'x86_64']) rmSync(`${out}/receiver-${arch}`);
