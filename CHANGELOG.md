# Changelog

## 0.9.1 candidate

- Require Obsidian 1.5.7 for the attachment-path API.
- Make native dragging an explicit option with a separately installed receiver; standard file imports start without it.
- Add strict official lint, typed settings migration, safer binary copying and delayed layout initialization.
- Add security/contribution/install/review documentation and separate standard/receiver packages.
- Keep Community preview pending until an authenticated server scan is recorded.

## 0.9.0

- Rename the display name to Mail Drop; retain the existing plugin ID for upgrades.
- Use English settings, notifications, errors, metadata labels, and new email entries.
- Add an optional “Added by” name instead of a fixed author.
- Preserve existing Dutch entries and recognize their generated fallback blocks on retry.
- Include a universal macOS receiver, manual installation ZIP, and SHA-256 checksums.
- Publish source and licensing information without private notes or runtime settings.

## 0.8.2

- Complete Apple Mail drops even when its legacy file-promise callback does not arrive.
- Accept only the expected number of stable, closed, complete EML files within the receiver's temporary folder.
- Close receiving notifications when a drop completes.

## Earlier development

Original EML preservation, collapsed previews, paperclip headings, attachment extraction, duplicate protection, and configurable links and filenames.
