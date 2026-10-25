# Validation — 0.10.0

Mail Drop 0.10.0 adds optional cooperation with Attachment Link Rules 0.2.0. Email source handling and the native receiver are unchanged.

- Plain `npm ci`, strict official lint, 58 tests, TypeScript/production build and universal macOS receiver checks pass. Dependency audit reports no known vulnerabilities.
- An isolated actual Obsidian 1.13.7 vault on macOS arm64 passes 115 synthetic DOM integration checks with both plugins: both load orders, slow I/O, concurrent edits, original bytes, one stored file/link per new drop, repeat deduplication, Wiki/Markdown syntax, email H1/collapsed body, standalone rules, unload and missing-provider fallback.
- The generic `scripts/cooperation-smoke.mjs` runner requires an explicitly marked, already open isolated test vault. It restores the previous note and link preference. Main-vault bundles were hash-matched to the tested candidates; the existing separately installed receiver connected after reload.
- Previous real Apple Mail/Outlook acceptance remains historical evidence. This release does not claim a new real provider drag, a runtime test on Obsidian 1.5.7, mobile support or an Intel runtime test. macOS receiver binaries are ad-hoc signed, not Apple-notarized.

Release evidence separately records exact source commit, downloaded asset hashes and the actual official Community source/release review. Local lint and this document alone do not prove a Community installation.
