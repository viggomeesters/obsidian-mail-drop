import { describe, expect, it } from "vitest";
import { emailToMarkdown } from "../src/eml";

describe("emailToMarkdown", () => {
	it("creates readable Obsidian frontmatter and body", () => {
		const result = emailToMarkdown({ from: "Ada <ada@example.com>", to: "Me <me@example.com>", subject: "Hello", date: "2026-09-22T10:00:00Z", text: "Mailtekst", attachments: [] });
		expect(result).toContain("type: email");
		expect(result).toContain('subject: "Hello"');
		expect(result).toContain("# Hello");
		expect(result).toContain("Mailtekst");
	});
});
