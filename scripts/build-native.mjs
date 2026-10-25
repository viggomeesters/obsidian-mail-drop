import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
const out = 'outputs/obsidian-outlook-drop';
mkdirSync(out, { recursive: true });
if (process.platform !== 'darwin') {
  throw new Error('A full release requires macOS and Xcode Command Line Tools to build the native receiver.');
}
for (const arch of ['arm64', 'x86_64']) {
  execFileSync('swiftc', ['-O', '-target', `${arch}-apple-macosx13.0`, 'native/outlook-file-promises.swift', '-o', `${out}/receiver-${arch}`], { stdio: 'inherit' });
}
execFileSync('lipo', ['-create', `${out}/receiver-arm64`, `${out}/receiver-x86_64`, '-output', `${out}/outlook-file-promises`], { stdio: 'inherit' });
execFileSync('codesign', ['--force', '--sign', '-', `${out}/outlook-file-promises`], { stdio: 'inherit' });
for (const arch of ['arm64', 'x86_64']) rmSync(`${out}/receiver-${arch}`);
