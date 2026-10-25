import {describe,it,expect,vi} from "vitest";
import PostalMime from "postal-mime";
import {mailPreview,failedPreview,legacyFailedPreview} from "../src/mail-preview";
import {importAttachments} from "../src/attachments";
const bytes=(text:string)=>new TextEncoder().encode(text).buffer;
const raw="From: Viggo <viggo@example.invalid>\r\nTo: Test <test@example.invalid>\r\nSubject: =?UTF-8?B?Q2Fmw6k=?=\r\nDate: Fri, 23 Oct 2026 10:00:00 +0200\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHoi!\r\n\r\n![[geheim]] <img src=\"https://example.invalid/track\">\r\n> [!quote]- injectie\r\n```\r\nDag.";
describe("dichtgeklapte mailinhoud",()=>{
 it("decodeert onderwerp/metadata, behoudt tekst en neutraliseert embeds, HTML en callouts",async()=>{
  const text=await mailPreview(bytes(raw));
  expect(text).toContain("> [!quote|outlook-mail]- Mail · Café\n");expect(text).toContain("Café");expect(text).toContain("viggo@example.invalid");
  expect(text).toContain("> Hoi&#33;");expect(text).not.toContain("![[geheim]]");expect(text).not.toContain("<img");expect(text).not.toContain("\n> [!quote]- injectie");expect(text).not.toContain("```");expect(text).toContain("Dag.");
 });
 it("maakt HTML-only mail leesbaar met entiteiten en alinea’s zonder remote afbeeldingen",async()=>{
  const text=await mailPreview(bytes("Subject: HTML\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><head><title>x</title></head><body><p>Hoi &eacute;én &amp; twee</p><p>Volgende<br>regel</p><img src=\"https://example.invalid/track\"><script>alert(1)</script></body></html>"));
  expect(text).toContain("Hoi één &#38; twee");expect(text).toContain("Volgende");expect(text).toContain("regel");expect(text).not.toContain("track");expect(text).not.toContain("alert(1)");
 });
 it("decodeert base64 MIME tekst en laat geen onleesbare codering zien",async()=>{
  const text=await mailPreview(bytes("Subject: MIME\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"+Buffer.from("Hallo café").toString("base64")));
  expect(text).toContain("Hallo café");
 });
 it("meldt ontbrekende leesbare tekst eerlijk",async()=>{expect(await mailPreview(bytes("Subject: leeg\r\n\r\n"))).toContain("no readable text");});
 it("verrijkt alleen de opnieuw gesleepte bestaande mail en herhaalt geen blok of preview",async()=>{
  const saved=bytes(raw);let note="Menselijke tekst\n\n[[Oude Mail.eml]]\n\nBlijft behouden.\n";
  const store={exists:()=>true,read:async()=>saved,create:async()=>{throw Error("niet nodig");},findSame:async()=>"map/Oude Mail.eml",link:()=>"[[Oude Mail.eml]]",append:async(fn:(s:string)=>string)=>{note=fn(note);}};
  const file={name:"Oude Mail.eml",arrayBuffer:async()=>saved};
  await importAttachments([file],"map",store,new Date(),{preview:true,nameMode:"date-kebab"});
  const first=note;await importAttachments([file],"map",store,new Date(),{preview:true});
  expect(note).toBe(first);expect(note.match(/> \[!quote(?:\|outlook-mail)?\]- Mail ·/g)).toHaveLength(1);expect(note).toContain("Blijft behouden.");expect(note).not.toContain("# Attachment");expect(new Uint8Array(await store.read())).toEqual(new Uint8Array(saved));
 });
 it("bewaart bron bij parserfout en herstelt uitsluitend de eigen fallback bij opnieuw slepen",async()=>{
  const binaries=new Map<string,ArrayBuffer>();let note="# Menselijke tekst\n";
  const store={exists:(p:string)=>binaries.has(p),read:async(p:string)=>binaries.get(p)!,create:async(p:string,b:ArrayBuffer)=>{binaries.set(p,b);},link:(p:string)=>`[[${p}]]`,append:async(fn:(s:string)=>string)=>{note=fn(note);}};
  const file={name:"Parsefout.eml",arrayBuffer:async()=>bytes(raw)};
  const spy=vi.spyOn(PostalMime,"parse").mockRejectedValueOnce(Error("parserfout"));
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try{
   const first=await importAttachments([file],"map",store,new Date(2026,9,23),{preview:true,nameMode:"date-kebab"});
   expect(first.failures).toHaveLength(0);expect(first.previewFailures).toEqual([file.name]);expect(note).toContain("Email text could not be read");expect(binaries.size).toBe(1);
   note=note.replace(failedPreview,legacyFailedPreview);
   await importAttachments([file],"map",store,new Date(2026,9,23),{preview:true,nameMode:"date-kebab"});
   expect(note).not.toContain("Mailtekst kon niet worden gelezen");
   expect(note).not.toContain("Email text could not be read");expect(note).toContain("Café");expect(note.match(/> \[!quote(?:\|outlook-mail)?\]- Mail ·/g)).toHaveLength(1);expect(note.match(/# 📎 /g)).toHaveLength(1);
  }finally{spy.mockRestore();log.mockRestore();}
 });

});
