import {describe,it,expect} from "vitest";
import {localDate,mailTitle} from "../src/mail-format";
import {renderMailPreview} from "../src/mail-preview";
import {safeAttachmentName} from "../src/naming";
describe("leesbare mailregistratie",()=>{
 it("rekent een bron-UTC-tijd om naar Amsterdamse zomer- en wintertijd",()=>{
  expect(localDate("2026-10-23T09:28:46.000Z","Europe/Amsterdam")).toBe("23 Oct 2026 at 11:28");
  expect(localDate("2026-12-01T09:28:46.000Z","Europe/Amsterdam")).toBe("1 Dec 2026 at 10:28");
 });
 it("behoudt ongeldige datumtekst en verzint geen ontbrekende datum",()=>{
  expect(localDate("onbekend")).toBe("onbekend");
  expect(renderMailPreview({headers:[],headerLines:[],attachments:[],text:"Body"})).not.toContain("**Date:**");
 });
 it("gebruikt een veilige compacte onderwerptitel met volledige bron in het blok",()=>{
  expect(mailTitle("Hallo\r\n![[test]] <script>")).toBe("Mail · Hallo &#33;&#91;&#91;test&#93;&#93; &#60;script&#62;");
  expect(mailTitle()).toBe("Mail · No subject");
  const subject="Onderwerp "+"lang ".repeat(100);
  expect(mailTitle(subject).length).toBeLessThan(180);
  expect(renderMailPreview({headers:[],headerLines:[],attachments:[],subject,text:"Body"})).toContain("**Subject:** "+subject.trim());
 });
 it("maakt MIME-bestandsnamen pad- en wikilinkveilig zonder extensieverlies",()=>{
  expect(safeAttachmentName("../../Bijlage[[x]]#^|.PDF")).not.toMatch(/[\\/\[\]#^|]/);
  expect(safeAttachmentName("../../Bijlage[[x]]#^|.PDF")).toMatch(/Bijlage.*\.PDF$/);
  const long=safeAttachmentName("é".repeat(300)+".xlsx");expect(Buffer.byteLength(long)).toBeLessThanOrEqual(230);expect(long).toMatch(/\.xlsx$/);
 });
});
