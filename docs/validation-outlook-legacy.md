# Outlook legacy promise compatibility

The observed failure advertised both modern file-promise metadata and Outlook's legacy marker, then supplied neither a file nor a completion callback through the modern receiver. The exported EML itself imports correctly. That establishes the failed transport, not a content parsing failure.

## Change

For Outlook drags with both `WMOutlookInternalFilePromisePboardType` and `Apple files promise pasteboard type`, request the destination synchronously using `NSDraggingInfo.namesOfPromisedFilesDropped(atDestination:)` inside the active drop. Use a single protocol per drop. Apple Mail and modern-only Outlook promises retain `NSFilePromiseReceiver`. Materialized-file validation now also covers modern Outlook deliveries without callbacks.

Apple documents the legacy method at https://developer.apple.com/documentation/appkit/nsdragginginfo/namesofpromisedfilesdropped(atdestination:). The macOS SDK still declares it; its deprecation warning is intentional for this bounded provider compatibility path. No private AppKit or Outlook API is used, and no mailbox is queried.

## Verification

- The regression for the observed mixed-protocol declaration failed before the implementation and passes afterwards.
- `npm run verify`: 58 TypeScript tests, lint/typecheck, standard bundle, universal receiver build, source/manifest checks, 28 source-selection/name checks, three pasteboard cases, ten complete-file checks and the existing materialization flow pass.
- `outlook-file-promises --legacy-promise-self-test`: actual coordinator path requests synchronously, bypasses modern promise objects, rejects nil/empty/traversing/non-EML/duplicate names, waits for a partial open file to finish, receives exact bytes once and removes pending timers/state.
- The same legacy test passes with the privately supplied original EML. Private input and outputs remain outside the public repository.
- Universal executable contains arm64 and x86_64 slices; ad-hoc signature passes strict verification. Intel runtime is not tested.
- Independent source review on 11 November 2026 approved the merged fix at `4dec8ad`. It checked protocol exclusivity, synchronous session lifetime, no reading outside the receive folder, partial-file readiness, retry cleanup and retained modern behavior. No blocker was found.

## Acceptance boundary

On 11 November 2026, Viggo dragged a real Outlook message into an open Markdown note in Obsidian 1.15.0 on Apple Silicon using the installed candidate. The note received the mail heading, EML link and collapsed preview. The stored EML was 7,406 bytes, recognized as RFC 822 mail and contained a closing MIME boundary. The installed standard bundle matched the tested bundle; the active receiver matched the previously tested universal binary (SHA-256 `5a36c64960ec916a97ccf7b4bbbd80262bb39b8b4b931a2b4634afe84431ef44`). Private message contents and screenshots remain outside this public repository.

This is real-provider acceptance for that message, alongside synthetic coverage of the legacy handshake. It does not establish that the original reported message, every Outlook variant or Intel runtime has been retested. No independent byte comparison against an export of the new message was performed. Intel is compile-only coverage.

Release 0.10.1 packages this fix. Users of native dragging must replace the separate receiver and reconnect or reload it; the standard plugin update does not update that executable. Ordinary file imports need only the standard plugin assets. Retain the saved-EML fallback for a provider that still fails to deliver files.

Only the receiver needs replacement. Plugin settings, user notes and the standard JavaScript bundle remain unchanged. Error copy identifies the failed transfer and the saved-EML action. It flows through the existing Notice presenter; no new layout or UI surface is introduced.
