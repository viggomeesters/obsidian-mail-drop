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
- Same-agent code review checks protocol exclusivity, synchronous session lifetime, no reading outside the receive folder, partial-file readiness, retry cleanup and retained modern behavior. This is not an independent review.

## Acceptance boundary

Synthetic provider tests cannot establish that Outlook honors the legacy request for the reported message. A new real Outlook drag using the locally installed candidate is required. Keep Issue #1 and the implementation task open until that readback; do not label this candidate a verified production fix or publish a stable release on synthetic evidence alone.

Only the receiver needs replacement. Plugin settings, user notes and the standard JavaScript bundle remain unchanged. Error copy identifies the failed transfer and the saved-EML action. It flows through the existing Notice presenter; no new layout or UI surface is introduced.
