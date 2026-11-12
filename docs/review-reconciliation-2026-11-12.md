# Release review reconciliation — 12 November 2026

Issue [#4](https://github.com/viggomeesters/obsidian-mail-drop/issues/4) preserved three completed items with stale review flags during retirement of the old workflow. It did not identify a new implementation defect. The product implementation and public release remain unchanged.

| Historical item | Shipped outcome and reviewed evidence |
| --- | --- |
| `attachment-rule-cooperation` | `src/main.ts` delegates link formatting after storage, suppresses duplicate observers through the managed-drop protocol and retains the native fallback. `tests/link-rules.test.ts` covers the protocol; [0.10.0 validation](validation-0.10.0.md) records 115 actual-host synthetic checks with Attachment Link Rules. |
| `community-readiness` | The declared minimum is 1.5.7, standard imports need only three plugin assets and native dragging is explicit opt-in with a separate receiver. The earlier catalog wait is superseded by the recorded actual Community installations and official reproducible-build reviews. |
| `publish-cooperation` | Public release [0.10.0](https://github.com/viggomeesters/obsidian-mail-drop/releases/tag/0.10.0) delivered the cooperation code. [0.10.1](https://github.com/viggomeesters/obsidian-mail-drop/releases/tag/0.10.1) retains that JavaScript payload and adds the independently reviewed native Outlook fix from [PR #2](https://github.com/viggomeesters/obsidian-mail-drop/pull/2), released through [PR #3](https://github.com/viggomeesters/obsidian-mail-drop/pull/3). |

Independent source/history review approved reconciliation of all three items. Their unresolved review flags were obsolete metadata. The historical release readback is preserved in the [0.10.1 acceptance record at its original commit](https://github.com/viggomeesters/obsidian-mail-drop/blob/c769be2ed1e0b18556e3b3148e90d0f726a46ed0/.go/evidence/release-0.10.1.json); this is read-only historical evidence, not an active workflow or an instruction to recreate it.

Current checks: clean `npm ci`, 58 tests in 12 files and the standard production build pass. The rebuilt JavaScript and current manifest/styles match the public 0.10.1 assets byte-for-byte. No runtime code, dependencies, API minimum, support claims or release assets change in this reconciliation, so it requires no new release.

The actual 0.10.1 installation and real Outlook drag remain evidence from 11 November, not newly repeated tests. Minimum-version and Intel runtime coverage are not inferred from the current macOS host; the [Outlook acceptance boundary](validation-outlook-legacy.md#acceptance-boundary) remains explicit. Do not publish private email content or test-vault settings.
