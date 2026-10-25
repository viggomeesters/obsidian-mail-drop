import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {importAttachments} from "../src/attachments";
import {parseMail} from "../src/mail-preview";
import {mailFiles} from "../src/mail-files";
const raw=readFileSync("tests/fixtures/mail-met-bijlagen.eml");
const bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength) as ArrayBuffer;
const input={name:"Mailverbetering.eml",arrayBuffer:async()=>bytes};
const when=new Date(2026,9,23,12,2);
function fixture(){
 const files=new Map<string,ArrayBuffer>();let note="# Menselijke note\n\nBlijft behouden.\n";
 const store={exists:(p:string)=>files.has(p),read:async(p:string)=>files.get(p)!,create:async(p:string,b:ArrayBuffer)=>{if(files.has(p))throw Error("Bestaat");files.set(p,b);},link:(p:string)=>`[[${p}]]`,append:async(fn:(s:string)=>string)=>{note=fn(note);}};
 return {files,store,note:()=>note,set:(s:string)=>{note=s;}};
}
const options={nameMode:"date-kebab" as const,preview:true,extract:true};
describe("losse mailbijlagen",()=>{
 it("exporteert PDF, XLSX en lege bijlage bytegelijk; inline logo blijft uitsluitend in EML",async()=>{
  const f=fixture();const result=await importAttachments([input],"map",f.store,when,options);
  expect(result.failures).toEqual([]);expect(result.extractionFailures).toEqual([]);expect(f.files.size).toBe(4);
  expect(new Uint8Array(f.files.get("map/20261023-mailverbetering.eml")!)).toEqual(new Uint8Array(bytes));
  expect(Buffer.from(f.files.get("map/20261023-offerte-mailverbetering.pdf")!).toString()).toBe("%PDF-1.4\n% exact test\n%%EOF\n");
  expect([...new Uint8Array(f.files.get("map/20261023-budget-mailverbetering.xlsx")!)]).toEqual([80,75,3,4,0,200,255]);
  expect(f.files.get("map/20261023-leeg-mailverbetering.txt")!.byteLength).toBe(0);
  expect([...f.files.keys()].some(p=>p.includes("logo"))).toBe(false);expect(f.note()).not.toContain("![[");
  const first=f.note();await importAttachments([input],"map",f.store,when,options);expect(f.note()).toBe(first);expect(f.files.size).toBe(4);
 });
 it("kan na een eerdere uitgeschakelde export aanvullen zonder preview of menselijke tekst te herschrijven",async()=>{
  const f=fixture();await importAttachments([input],"map",f.store,when,{...options,extract:false});expect(f.files.size).toBe(1);
  f.set(f.note().replace("Hoi team,","Menselijk gewijzigde mailtekst,")+"\nEigen slottekst.\n");
  await importAttachments([input],"map",f.store,when,options);expect(f.files.size).toBe(4);expect(f.note()).toContain("Menselijk gewijzigde mailtekst,");expect(f.note()).toContain("Eigen slottekst.");expect(f.note().match(/> \[!quote(?:\|outlook-mail)?\]- Mail ·/g)).toHaveLength(1);
 });
 it("bewaart verschillende bestaande bytes en hergebruikt bijlageconflicten op retry",async()=>{
  const f=fixture();f.files.set("map/20261023-offerte-mailverbetering.pdf",new Uint8Array([9]).buffer);
  await importAttachments([input],"map",f.store,when,options);expect(f.files.has("map/20261023-offerte-mailverbetering-2.pdf")).toBe(true);expect([...new Uint8Array(f.files.get("map/20261023-offerte-mailverbetering.pdf")!)]).toEqual([9]);
  const first=f.note();await importAttachments([input],"map",f.store,when,options);expect(f.note()).toBe(first);expect(f.files.size).toBe(5);
 });
 it("houdt EML en geslaagde uitvoer bij gedeeltelijke schrijffout en herstelt ontbrekende link bij retry",async()=>{
  const f=fixture(),create=f.store.create;f.store.create=async(p,b)=>{if(p.endsWith(".xlsx"))throw Error("tijdelijk niet schrijfbaar");await create(p,b);};
  const first=await importAttachments([input],"map",f.store,when,options);expect(first.extractionFailures).toHaveLength(1);expect(f.files.size).toBe(3);expect(f.note()).toContain("offerte-mailverbetering.pdf");expect(f.note()).not.toContain("budget-mailverbetering.xlsx");
  f.store.create=create;await importAttachments([input],"map",f.store,when,options);expect(f.files.size).toBe(4);expect(f.note()).toContain("budget-mailverbetering.xlsx");expect(f.note().match(/> \[!quote(?:\|outlook-mail)?\]- Mail ·/g)).toHaveLength(1);
  const after=f.note();await importAttachments([input],"map",f.store,when,options);expect(f.note()).toBe(after);
 });
 it("werkt ook zonder mailpreview en behoudt expliciete afbeeldingsbijlagen",async()=>{
  const mail=await parseMail(bytes);mail.attachments.push({filename:"Foto.jpg",mimeType:"image/jpeg",disposition:"attachment",contentId:"explicit",content:new Uint8Array([1,2]).buffer});
  expect(mailFiles(mail).some(f=>f.name==="Foto.jpg")).toBe(true);
  const f=fixture();await importAttachments([input],"",f.store,when,{...options,preview:false});expect(f.files.size).toBe(4);expect(f.note()).toContain("Attachments:");expect(f.note()).not.toContain("[!quote]");
 });
 it("behoudt bestaande legacy-preview bij opnieuw slepen",async()=>{
  const f=fixture();await importAttachments([input],"map",f.store,when,{preview:true});
  f.set(f.note().replace("> [!quote|outlook-mail]- Mail · Example Project - Team Event","> [!quote]- Mailinhoud"));
  const before=f.note();await importAttachments([input],"map",f.store,when,{preview:true});expect(f.note()).toBe(before);
 });
});
