# Changelog

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
