# Community submission status and release gate

The public 0.9.0 prerelease was not Community-ready. The 0.9.1 candidate repairs the known minimum-version, installation, lint and documentation gaps. It is not approved or listed merely because local verification passes.

## Installation contract

- Minimum Obsidian: **1.5.7**, required by `FileManager.getAvailablePathForAttachment`.
- Desktop only. Standard installation uses exactly `main.js`, `manifest.json`, and `styles.css`.
- Existing EML files and document/image drops work without any native executable.
- Direct Apple Mail/Outlook dragging requires an explicitly enabled, separately installed macOS receiver. The plugin does not download or install it. See `native-receiver.md`.
- All parsing is local; outside-vault file access and the receiver process are disclosed in README/SECURITY.

## Before a release

1. Run clean installation, `npm run verify`, `npm audit`, and packaging.
2. Test only the three standard assets in a separate vault with no helper or saved settings. Confirm no missing-receiver startup error and exact-byte EML import with a collapsed preview.
3. Test native opt-in with an installed executable; record supported hardware and distinguish fixture tests from actual provider drags.
4. Save screenshots/render evidence, checksums, source commit and compatibility checks. Check no private data enters source or assets.
5. Push a candidate branch/commit for the authenticated Obsidian Community preview. Record the actual result. Local official lint is not the server scan.
6. Fix required findings, then decide on release and submission. Do not replace the existing release's assets silently.

## Current external gate

Official Community preview requires the maintainer's authenticated account with linked GitHub. No passing server result is recorded yet. The native-dependency distribution model must still be assessed by that review. A maintainer must not label this candidate “Community approved” without its actual result.
