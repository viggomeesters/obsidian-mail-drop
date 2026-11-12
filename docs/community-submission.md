# Community submission status and release gate

The public 0.9.0 prerelease was not Community-ready. The 0.9.1 changes repair the known minimum-version, installation, lint and documentation gaps. It is not approved or listed merely because local verification passes.

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

## Recorded preview and remaining publication checks

The authenticated official preview of source commit `63bb386650c04d588edd8172487643034763dd40` completed on 25 October 2026, with no displayed errors or warnings and a passing dependency check. Earlier lockfile installation failures were repaired, and explicit library/type configuration resolved the subsequent source warnings. See `validation-0.9.1.md`.

The public Community listing is https://community.obsidian.md/plugins/outlook-drop-importer. Stable release 0.9.2 completed the full release review with a passing byte-for-byte build reproduction and dependency check. Two declared behavior warnings (filesystem access and the native child process) and two recommendations (attestations and extra manual download assets) remain. They are not errors. GitHub Actions remains disabled; no attestation workflow was added. Automated review completion does not constitute a human endorsement of the native dependency model.

## Clean server build follow-up

The complete 0.9.1 release review finished without errors but reported a build-verification warning because Python was unavailable. Version 0.9.2 generates the same license notices with Node.js. Its standard build was verified with a restricted PATH containing only Node and the platform shell, with no Python. Runtime bundle bytes are unchanged. See `validation-0.9.2.md`.

## App catalog acceptance

The initial 0.9.2 catalog-propagation wait was superseded by a successful fresh Community installation of 0.10.0 on 25 October 2026. On 11 November 2026, 0.10.1 was also freshly installed through the actual Obsidian Community CLI in the isolated test vault. The installed payload matched the published bundle, apart from Obsidian's exact appended `\n/* nosourcemap */` suffix. Existing settings were restored, the receiver reconnected and the test note/EML remained unchanged.

The official source preview and full 0.10.1 release review completed with Dependencies and byte-for-byte Build verification passing. Its ten assets were anonymously downloaded and hash-checked, and the public listing showed 0.10.1. These are recorded acceptance results, not a claim that a new installation or provider drag was repeated during the review reconciliation on 12 November. See [review reconciliation](review-reconciliation-2026-11-12.md) and [the released Outlook validation](validation-outlook-legacy.md).
