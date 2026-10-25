# Mail Drop

Import examples and candidate test evidence: [validation](docs/validation-0.10.0.md).

Drag emails from Apple Mail or Microsoft Outlook into an Obsidian note. Keep the original `.eml` beside the note, with a paperclip heading, a link, and a collapsed preview.

Mail Drop also controls attachment links: embed images and link PDFs, spreadsheets, and other documents. Optional date prefixes and kebab-case names keep new files consistent.

## Compatibility

- Obsidian desktop 1.5.7 or later.
- Native email dragging requires macOS 13 or later and a separately installed receiver.
- Apple Silicon has been tested with real Apple Mail and Outlook drops. The universal receiver also builds for Intel; real Intel execution has not yet been tested.
- Mobile is unsupported. Other desktop platforms have not been validated for a public release.
- This is an early release. Email apps may expose different drag formats across versions. Drag the message from the message list onto the text of an open Markdown note.

## Install

Install **Mail Drop** from Obsidian’s Community plugins browser or open the [Community listing](https://community.obsidian.md/plugins/outlook-drop-importer). A newly published listing can take up to 24 hours to appear in the app.

The Community-style installation consists of `main.js`, `manifest.json` and `styles.css`. Copy those assets into `<your-vault>/.obsidian/plugins/outlook-drop-importer/` and enable **Mail Drop**. A complete ZIP is also available from [Releases](https://github.com/viggomeesters/obsidian-mail-drop/releases). Keep your existing `data.json` when upgrading.

Existing installations retain their settings; the plugin ID remains `outlook-drop-importer`.

**Direct dragging from Apple Mail or Outlook requires a separate macOS receiver.** New installations keep native dragging off. Ordinary EML file imports and document/image drops work without it. Follow the [receiver installation guide](docs/native-receiver.md) to install the executable yourself, enable **Native email dragging**, and connect its path. Mail Drop does not download or install dependencies. The receiver is ad-hoc signed, not Apple notarized.

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
| Attachment drops | Embed images only, choose types to link, use Obsidian's default, or delegate to Attachment Link Rules. |
| File names | Date + kebab-case, kebab-case only, or original name. Existing full dates are retained. |
| Email preview | Add readable email text in a collapsed callout. |
| Extract email attachments | Save explicit attachments beside the EML and add plain links. Inline images stay in the email. Off by default. |
| Added by | Optional name in new email entries. Blank by default. |
| Native email dragging | Optional macOS reception with a separately installed executable. Off on new installations. |
| Receiver path | Absolute path to the existing receiver; select Connect after editing. |
| File types to link | Comma-separated extensions; shown in “Choose by file type” mode. |

Naming rules apply to external files. Internal vault drags create links without copying or renaming files. Document drops follow Obsidian's attachment-folder preference; email files are saved beside their target note.

## Privacy and file access

All parsing and previews run locally. There are no background network requests, accounts, telemetry, remote images, or cloud parsing. The installation-guide button opens GitHub in your browser; it sends no email content. Email HTML is converted to text, not executed or rendered as active HTML.

On macOS, explicit native opt-in runs one separately installed AppKit receiver. It inspects drag-pasteboard types to recognize email drags and temporarily shows a non-activating drop target over visible Markdown panes. It does not query the mailbox database, export selected mail through AppleScript, or send mail.

The receiver writes outside the vault only to its own private `obsidian-outlook-*` directories under the system temporary directory. The plugin reads received EML files from those directories and removes each directory only after successful import. Native file-drop handling necessarily reads files you drag from outside the vault. No background scan of your files or mailboxes is performed. Diagnostic events include filenames and target-note paths, but not email bodies; remove personal information before reporting an issue.

## Build and verify

The plugin build requires only Node.js 22.12+. Building the optional receiver also requires macOS and Xcode Command Line Tools; packaging the manual download archives uses Python 3.

```sh
npm ci
npm run lint
npm test
npm run build
npm run build:native
outputs/obsidian-outlook-drop/outlook-file-promises --self-test
outputs/obsidian-outlook-drop/outlook-file-promises --pasteboard-self-test
outputs/obsidian-outlook-drop/outlook-file-promises --materialization-self-test
outputs/obsidian-outlook-drop/outlook-file-promises --materialization-flow-self-test
npm run package
```

`npm run build` produces the standard `main.js` without compiling a receiver. `npm run build:native` compiles the ad-hoc-signed universal arm64/x86_64 receiver. Release files and SHA-256 checksums are written to `outputs/release/<version>/`. Builds and releases run locally; no GitHub Actions workflow is used.

Synthetic tests cover MIME parsing, attachment extraction, naming, byte preservation, deduplication, path validation, process lifecycle, and Apple Mail completion without its legacy callback. They do not replace testing real drags on each mail app and architecture.

## Support and contributing

Report reproducible issues through [GitHub Issues](https://github.com/viggomeesters/obsidian-mail-drop/issues). Include Obsidian/macOS versions, email app, plugin version, and what happened. Use a synthetic message and remove addresses, bodies, and private paths. Please do not upload private emails.

For changes, run the verification commands above and describe any real mail-app tests separately. Preserve original EML bytes and do not add network access, mailbox access, or self-installing dependencies.

## License

[MIT](LICENSE), copyright 2026 Viggo Meesters. Bundled dependency licenses are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Attachment Link Rules cooperation (0.10.0)

Choose **Use attachment rules** under **Attachment drops** with the Attachment Link Rules 0.2.0 or later enabled. Mail Drop keeps email import, original bytes, duplicate handling and **File names** (including date + kebab-case). The rules plugin alone decides document link/embed syntax, using the Wiki or Markdown link generated by Obsidian. Internal vault drags remain native and are not renamed. Mail Drop's email entries remain plain email links with their own collapsed preview.

In Attachment Link Rules, put only images in **Embed extensions** and select **Use links** for **Unlisted extensions** to keep PDF, office, audio, video and unknown files as normal links. Existing independent Mail Drop modes and saved preferences are retained. If the formatter is unavailable, the import is preserved with native link syntax and a notice explains how to restore the chosen policy. Changing or disabling plugins does not rewrite existing notes or attachments.

The integration uses documented synchronous DOM events on the target document, not private plugin registries. A managed-drop event prevents a second observer pass, and a format request asks only for the final link syntax after storage. Slow imports therefore do not depend on retry timing. Both load orders, slow I/O, native link preferences and missing-provider behavior are checked by `scripts/cooperation-smoke.mjs` against an explicitly marked, already open isolated test vault. This test uses synthetic DOM drops; it is not a new Apple Mail/Outlook provider-drag or Community-installer claim.

Earlier releases remain available for rollback. The optional rules integration requires Attachment Link Rules 0.2.0 or later.
