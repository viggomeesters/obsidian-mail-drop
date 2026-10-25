import PostalMime from "postal-mime";

export interface ImportedEmail {
	from: string;
	to: string;
	subject: string;
	date: string;
	text: string;
	attachments: Array<{ filename: string; mimeType: string; content: ArrayBuffer }>;
}

export async function parseEml(data: ArrayBuffer): Promise<ImportedEmail> {
	const mail = await PostalMime.parse(data);
	return {
		from: formatAddress(mail.from),
		to: (mail.to ?? []).map(formatAddress).join(", "),
		subject: mail.subject?.trim() || "No subject",
		date: mail.date ?? "",
		text: mail.text?.trim() || htmlToText(mail.html ?? ""),
		attachments: (mail.attachments ?? []).map((attachment) => ({
			filename: attachment.filename || "attachment",
			mimeType: attachment.mimeType || "application/octet-stream",
		content: toArrayBuffer(attachment.content),
		}))
	};
}

function toArrayBuffer(value: string | ArrayBuffer | Uint8Array): ArrayBuffer {
	if (value instanceof ArrayBuffer) return value;
	if (typeof value === "string") return new TextEncoder().encode(value).buffer;
	return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function formatAddress(address: { name?: string; address?: string } | undefined): string {
	if (!address) return "";
	return address.name ? `${address.name} <${address.address ?? ""}>` : (address.address ?? "");
}

function htmlToText(html: string): string {
	return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function emailToMarkdown(email: ImportedEmail, attachmentLinks: string[] = []): string {
	const date = email.date ? new Date(email.date).toISOString().slice(0, 10) : "";
	const attachments = attachmentLinks.length ? `\n\n## Attachments\n\n${attachmentLinks.map((x) => `- ${x}`).join("\n")}` : "";
	return `---\ntype: email\nfrom: "${yaml(email.from)}"\nto: "${yaml(email.to)}"\nsubject: "${yaml(email.subject)}"\ndate: ${date}\n---\n\n# ${email.subject}\n\n${email.text}${attachments}\n`;
}

function yaml(value: string): string { return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " "); }
