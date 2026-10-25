import {describe,expect,it} from "vitest";
import {attachmentFilename,hasFilenameDate,numberedFilename,sameImportName} from "../src/naming";
const when=new Date(2026,9,23,10,0);
describe("behoudende bijlagenamen",()=>{
 it("behoudt woorden en extensie en voegt lokale toevoegdatum toe",()=>{
  expect(attachmentFilename("Offerte Keuken Janssen.PDF","date-kebab",when)).toBe("20261023-offerte-keuken-janssen.pdf");
  expect(attachmentFilename("Budget2026Final.XLSX","date-kebab",when)).toBe("20261023-budget2026-final.xlsx");
 });
 it("behoudt bestaande geldige datums zonder een tweede prefix",()=>{
  for(const name of ["20261020 Offerte.pdf","2026-10-20 Offerte.pdf","Offerte 20-10-2026.pdf","IMG_20241020.jpg"]){
   expect(hasFilenameDate(name)).toBe(true);expect(attachmentFilename(name,"date-kebab",when)).not.toMatch(/^20261023-/);
  }
  expect(attachmentFilename("20261020-offerte.pdf","date-kebab",when)).toBe("20261020-offerte.pdf");
 });
 it("verwisselt versies en ongeldige datums niet met een volledige datum",()=>{
  expect(hasFilenameDate("versie2026.pdf")).toBe(false);expect(hasFilenameDate("2026-02-30.pdf")).toBe(false);expect(hasFilenameDate("12320261020123.pdf")).toBe(false);
 });
 it("behoudt Unicode, versienummers, macro-extensies en samengestelde extensies",()=>{
  expect(attachmentFilename("Résumé Élodie v2.XLSM","kebab",when)).toBe("résumé-élodie-v2.xlsm");
  expect(attachmentFilename("Project Backup.TAR.GZ","date-kebab",when)).toBe("20261023-project-backup.tar.gz");
 });
 it("kan alleen kebab of de oorspronkelijke naam kiezen",()=>{
  expect(attachmentFilename("Mijn Document.PDF","kebab",when)).toBe("mijn-document.pdf");expect(attachmentFilename("Mijn Document.PDF","original",when)).toBe("Mijn Document.PDF");
 });
 it("maakt veilige niet-lege namen en begrenst UTF-8 zonder gedeelde lange namen te verwarren",()=>{
  expect(attachmentFilename("../ #[].pdf","date-kebab",when)).toBe("20261023-attachment.pdf");
  const a=attachmentFilename("é".repeat(200)+"A.pdf","date-kebab",when),b=attachmentFilename("é".repeat(200)+"B.pdf","date-kebab",when);
  expect(new TextEncoder().encode(a).length).toBeLessThanOrEqual(230);expect(a).not.toBe(b);expect(a).toMatch(/\.pdf$/);
 });
 it("gebruikt een kebab-suffix zonder de extensie te veranderen",()=>{
  expect(numberedFilename("20261023-offerte.pdf",2)).toBe("20261023-offerte-2.pdf");expect(numberedFilename("backup.tar.gz",3)).toBe("backup-3.tar.gz");
 });
 it("vindt kandidaten uit oude naamgeving, een andere dag en numerieke conflicten",()=>{
  for(const existing of ["Wiki met skills.eml","20261020-wiki-met-skills.eml","20261020-wiki-met-skills-2.eml","Wiki met skills (2).eml"])expect(sameImportName("Wiki met skills.eml",existing)).toBe(true);
  expect(sameImportName("Wiki met skills.eml","ander.eml")).toBe(false);expect(sameImportName("Wiki met skills.eml","wiki-met-skills.pdf")).toBe(false);
 });
});
