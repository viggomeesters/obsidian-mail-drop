import {describe,expect,it} from "vitest";
import {linkedExtensions,wantsPlainLink,droppedFileLink} from "../src/drop-links";
describe("instelbare links bij droppen",()=>{
 it("normaliseert komma's, hoofdletters, puntprefixen en dubbelen",()=>{
  expect([...linkedExtensions(".PDF, png; PDF\njpg")]).toEqual(["pdf","png","jpg"]);
 });
 it("voegt een PDF als wikilink zonder embed in",()=>{
  expect(wantsPlainLink("Rapport.PDF",linkedExtensions("pdf"))).toBe(true);
  expect(droppedFileLink("Rapport.pdf","Rapport.pdf",linkedExtensions("pdf"))).toBe("[[Rapport.pdf]]");
 });
 it("behoudt afbeeldingen/audio standaard en ondersteunt een gekozen ander type",()=>{
  expect(droppedFileLink("foto.png","foto.png",linkedExtensions("pdf"))).toBe("![[foto.png]]");
  expect(droppedFileLink("geluid.mp3","geluid.mp3",linkedExtensions("pdf"))).toBe("![[geluid.mp3]]");
  expect(droppedFileLink("foto.png","foto.png",linkedExtensions("pdf,png"))).toBe("[[foto.png]]");
 });
 it("laat een lege extensielijst het normale PDF-embedgedrag kiezen",()=>{
  expect(wantsPlainLink("rapport.pdf",linkedExtensions(""))).toBe(false);
  expect(droppedFileLink("rapport.pdf","rapport.pdf",linkedExtensions(""))).toBe("![[rapport.pdf]]");
 });
 it("behoudt exacte padkeuze en laat gewone documenten links",()=>{
  expect(droppedFileLink("rapport.pdf","project/rapport.pdf",linkedExtensions("pdf"))).toBe("[[project/rapport.pdf]]");
  expect(droppedFileLink("brief.docx","brief.docx",linkedExtensions("pdf"))).toBe("[[brief.docx]]");
 });
});

describe("alleen afbeeldingen insluiten",()=>{
 it("geeft alle niet-afbeeldingen gewone links zonder extensielijst",()=>{
  for(const name of ["rapport.pdf","begroting.xlsx","brief.docx","presentatie.pptx","geluid.mp3","film.mp4","archief.zip","onbekend.xyz","note.md"]){
   expect(wantsPlainLink(name,new Set(),"images-only")).toBe(true);
   expect(droppedFileLink(name,name,new Set(),"images-only")).toBe(`[[${name}]]`);
  }
 });
 it("houdt alle ondersteunde afbeeldingsformaten als embed, ook bij hoofdletters",()=>{
  for(const name of ["foto.PNG","foto.jpg","foto.jpeg","animatie.gif","tekening.svg","foto.webp","foto.avif","foto.bmp"]){
   expect(wantsPlainLink(name,new Set(["png"]),"images-only")).toBe(false);
   expect(droppedFileLink(name,name,new Set(["png"]),"images-only")).toBe(`![[${name}]]`);
  }
 });
 it("kan geheel terug naar Obsidian zonder extensielijst te verwijderen",()=>{
  expect(wantsPlainLink("rapport.pdf",new Set(["pdf"]),"obsidian")).toBe(false);
 });
});
