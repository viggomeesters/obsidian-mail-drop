# Contributing

Keep changes focused on local, explicit imports. Preserve original file bytes, human note content and duplicate protection. Do not add automatic receiver installation, telemetry, mailbox access or email sending.

## Verify

Use Node.js 22.12+, Python 3, macOS and Xcode Command Line Tools.

```sh
npm ci --legacy-peer-deps
npm run verify
npm audit
npm run package
```

The legacy peer-resolution option is required because the official Obsidian ESLint package declares an older exact Obsidian peer version. The plugin uses current typings; the explicit Moment override keeps the checker's transitive dependency patched. It does not change the runtime Obsidian API.

Use a dedicated test vault with synthetic messages. Never develop or generate fixtures in your personal vault. Run standard three-file installation checks without a receiver, and opt-in reception checks with a separately installed executable. Distinguish automated host/fixture tests from real drags, and built architectures from tested hardware. See `docs/community-submission.md` for the release gate.

The official recommended Obsidian lint rules run with zero warnings. Do not globally suppress rules or remove tests to pass. Explain narrowly necessary compatibility choices; legacy settings rendering is retained for Obsidian 1.5.7 while search metadata is supplied for newer versions.

Repository work uses the pinned `.go/` workflow and `AGENTS.md`. Keep task scope and evidence local to the repository. Do not commit private paths, mail, cookies, settings or local proof containing personal data. No GitHub Actions workflow is used.
