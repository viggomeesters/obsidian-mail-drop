# Security

Mail Drop imports files explicitly dropped onto a note. It preserves the original EML, parses previews locally, and never sends mail or reads a mailbox database. There are no background network requests or telemetry. The guide button opens GitHub in a browser by explicit user action and sends no email content.

## Native receiver

Direct app-to-note dragging on macOS requires a separately installed receiver and an explicit setting. A new standard three-file installation keeps this feature off. The plugin only runs the configured existing executable; it never downloads, extracts, installs, updates, or changes permissions on a receiver. Existing manual installations can reuse their bundled receiver.

The receiver inspects drag-pasteboard types and writes only to its own temporary `obsidian-outlook-*` directory. Received paths are constrained to that folder, symbolic-link escapes are rejected, and source folders are removed only after successful import. Apple Mail's fallback completion requires the expected file count, stable identity/size/mtime, closed handles and a complete mail envelope. Previews neutralize Markdown and convert HTML to text without loading remote resources.

## Reporting a vulnerability

Use GitHub's private reporting form at https://github.com/viggomeesters/obsidian-mail-drop/security/advisories/new if available. If private reporting is unavailable, contact the repository owner through their public GitHub profile to arrange a private channel. Do not open a public issue containing private emails, credentials or an exploit for an unresolved serious vulnerability.

Include the plugin/Obsidian/macOS versions, a synthetic reproducer, impact and suggested mitigation. No guaranteed response or fix timeline is promised. For an issue affecting Obsidian itself, also follow Obsidian's official security reporting instructions.

## Support status

This is an early prerelease. Only the latest published prerelease is actively maintained. Apple Silicon has real mail-drag evidence; Intel is build-tested only. A compiled executable is not proof of notarization or a successful runtime test. Review untrusted files and executables before using them; never include personal mail in public reports.
