# Mail Drop

Drag emails from Apple Mail or Microsoft Outlook into an Obsidian note. Keep the original `.eml` beside the note, with a paperclip heading, a link, and a collapsed preview.

Mail Drop also controls attachment links: embed images and link PDFs, spreadsheets, and other documents. Optional date prefixes and kebab-case names keep new files consistent.

## Compatibility

- Obsidian desktop 1.5.0 or later.
- Native email dragging requires macOS 13 or later and the included receiver.
- Apple Silicon has been tested with real Apple Mail and Outlook drops. The universal receiver also builds for Intel; real Intel execution has not yet been tested.
- Mobile is unsupported. Other desktop platforms have not been validated for a public release.
- This is an early release. Email apps may expose different drag formats across versions. Drag the message from the message list onto the text of an open Markdown note.

## Install on macOS

1. Download `mail-drop-0.9.0-macos.zip` from [Releases](https://github.com/viggomeesters/obsidian-mail-drop/releases).
2. Quit Obsidian or disable an existing installation of the plugin.
3. Extract the `outlook-drop-importer` folder into `<your-vault>/.obsidian/plugins/`.
4. Enable **Mail Drop** in **Settings → Community plugins**. Obsidian may first ask you to enable community plugins.

The folder must contain `main.js`, `manifest.json`, `styles.css`, and the executable `outlook-file-promises`. The old folder and plugin ID are retained so existing settings continue to work. When upgrading, keep your existing `data.json`; release packages never include personal settings.

The native receiver is ad-hoc signed, not Apple notarized. If macOS blocks it, check the source and follow your normal macOS security review before allowing it. If the file lost its executable permission during copying, restore it with `chmod +x <your-vault>/.obsidian/plugins/outlook-drop-importer/outlook-file-promises`.

**Community directory:** not submitted. The standard installer fetches only `main.js`, `manifest.json`, and optionally `styles.css`; it does not install this extra native executable. Use the complete ZIP. Mail Drop does not download or install its own dependencies.

## What a drop creates

```markdown
# 📎 Project update

Added on 25 Oct 2026 at 10:00

[[20261025-project-update.eml]]

> [!quote|outlook-mail]- Mail · Project update
> **From:** Alex <alex@example.invalid>
> **Subject:** Project update
>
> The original email text appears here.
```

Set **Added by** to include your name after the timestamp. The preview is collapsed by default. Original bytes, including attachments, remain in the EML. Dates use the computer's local timezone; the optional filename prefix uses the date of import.

Dropping the same email again reuses matching files and links. Different content receives a filename suffix. Existing note text and previews are preserved. If importing fails, received originals remain in the private temporary folder so they can be recovered; do not delete these folders until you have recovered the message.

## Settings

| Setting | Effect |
| --- | --- |
| Attachment drops | Embed images only, choose types to link, or use Obsidian's default. |
| File names | Date + kebab-case, kebab-case only, or original name. Existing full dates are retained. |
| Email preview | Add readable email text in a collapsed callout. |
| Extract email attachments | Save explicit attachments beside the EML and add plain links. Inline images stay in the email. Off by default. |
| Added by | Optional name in new email entries. Blank by default. |
| File types to link | Comma-separated extensions; shown in “Choose by file type” mode. |

Naming rules apply to external files. Internal vault drags create links without copying or renaming files. Document drops follow Obsidian's attachment-folder preference; email files are saved beside their target note.

## Privacy and file access

All parsing and previews run locally. There are no network requests, accounts, telemetry, remote images, or cloud parsing. Email HTML is converted to text, not executed or rendered as active HTML.

On macOS, the plugin runs one bundled AppKit receiver while enabled. It inspects drag-pasteboard types to recognize email drags and temporarily shows a non-activating drop target over visible Markdown panes. It does not query the mailbox database, export selected mail through AppleScript, or send mail.

The receiver writes outside the vault only to its own private `obsidian-outlook-*` directories under the system temporary directory. The plugin reads received EML files from those directories and removes each directory only after successful import. Native file-drop handling necessarily reads files you drag from outside the vault. No background scan of your files or mailboxes is performed. Diagnostic events include filenames and target-note paths, but not email bodies; remove personal information before reporting an issue.

## Build and verify

Requires Node.js 22.12+, Python 3, macOS, and Xcode Command Line Tools.

```sh
npm ci
npm test
npm run build
outputs/obsidian-outlook-drop/outlook-file-promises --self-test
outputs/obsidian-outlook-drop/outlook-file-promises --pasteboard-self-test
outputs/obsidian-outlook-drop/outlook-file-promises --materialization-self-test
outputs/obsidian-outlook-drop/outlook-file-promises --materialization-flow-self-test
npm run package
```

The build compiles an ad-hoc-signed universal arm64/x86_64 receiver. Release files and SHA-256 checksums are written to `outputs/release/<version>/`. Builds and releases run locally; no GitHub Actions workflow is used.

Synthetic tests cover MIME parsing, attachment extraction, naming, byte preservation, deduplication, path validation, process lifecycle, and Apple Mail completion without its legacy callback. They do not replace testing real drags on each mail app and architecture.

## Support and contributing

Report reproducible issues through [GitHub Issues](https://github.com/viggomeesters/obsidian-mail-drop/issues). Include Obsidian/macOS versions, email app, plugin version, and what happened. Use a synthetic message and remove addresses, bodies, and private paths. Please do not upload private emails.

For changes, run the verification commands above and describe any real mail-app tests separately. Preserve original EML bytes and do not add network access, mailbox access, or self-installing dependencies.

## License

[MIT](LICENSE), copyright 2026 Viggo Meesters. Bundled dependency licenses are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
