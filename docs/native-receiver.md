# Direct dragging from mail apps on macOS

Mail Drop's normal file drops work with the standard `main.js`, `manifest.json` and `styles.css` installation. Drag an existing `.eml` file onto an open Markdown note to import it. Native app dragging is optional and off on new installations.

Apple Mail and Outlook may expose a message as an AppKit file promise rather than a browser file. Receiving that promise requires the separate macOS executable. It is not installed by the Community installer, and Mail Drop never installs or updates it for you.

## Install the receiver yourself

1. Download the receiver archive from this repository's GitHub release. Verify its checksum against `SHA256SUMS.txt`.
2. Extract the receiver folder to a permanent location you control, for example an application-tools folder in your home directory. Keep the executable outside the vault if you want it independent of plugin updates.
3. Review the source and macOS security status before allowing the executable. It is ad-hoc signed, not Apple notarized. If copying lost executable permission, restore it manually with `chmod +x /absolute/path/to/outlook-file-promises`.
4. In **Mail Drop**, enable **Native email dragging**, enter the absolute **Receiver path**, and select **Connect**.
5. Drag a message from the message list in Apple Mail or Outlook onto the text of an open note.

Requires macOS 13+. Apple Silicon has real provider tests; Intel has only been compiled. If your mail app supplies only a `message:` link, save/export an EML first and drop that file instead.

## Existing installations

Existing saved preferences preserve native reception. An empty receiver path reuses an already present `outlook-file-promises` in the plugin folder for compatibility. A missing receiver does not prevent file imports or install anything; settings explain how to connect one. Keep your existing `data.json` when updating.

Disabling the native toggle stops the receiver. Unloading the plugin also stops it and closes progress notices. Receiver restarts replace the previous child rather than installing a system service.

## Outlook legacy promises

Some Outlook drags expose modern promise metadata together with the legacy `WMOutlookInternalFilePromisePboardType`. The receiver requests those files through `NSDraggingInfo.namesOfPromisedFilesDropped(atDestination:)` synchronously during the drop. This compatibility call is intentionally deprecated by Apple; modern Outlook-only and Apple Mail promises continue to use `NSFilePromiseReceiver`. A drop uses one transport, never both.

Legacy files are imported only after all expected EML files exist, their file identity/size/modification time have stabilized, their handles are closed and their MIME envelopes are complete. Failed transfers keep their temporary files for recovery and explain how to use a saved EML. Replacing the receiver executable requires reconnecting it or reloading Mail Drop.

Synthetic verification: `outlook-file-promises --legacy-promise-self-test`. An optional second argument supplies a local EML fixture; it is read only and never queries a mailbox. This test uses a simulated provider and does not establish real Outlook acceptance.
