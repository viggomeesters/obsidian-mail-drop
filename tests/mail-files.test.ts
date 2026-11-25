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
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==","base64");
const gif=Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64");
function inlinePart(id:string,mime:string,body:Buffer):string[] {
 return ["--related",`Content-Type: ${mime}`,`Content-ID: <${id}>`,"Content-Disposition: inline; filename=unsafe.html","Content-Transfer-Encoding: base64","",body.toString("base64")];
}
const inlineMail=new TextEncoder().encode([
 "Subject: Inline images","MIME-Version: 1.0",'Content-Type: multipart/alternative; boundary="alternative"',"",
 "--alternative","Content-Type: text/plain","", "Plain-text body",
 "--alternative",'Content-Type: multipart/related; boundary="related"',"",
 "--related","Content-Type: text/html","",
 '<p>Alternative body</p><img src="CID:first%40example.invalid"><img src=cid:second>',
 '<img src="cid:second"><img src="cid:missing"><img src="https://example.invalid/track">',
 '<img src="data:image/png;base64,abc"><img src="cid:vector"><img src="cid:fake">',
 '<!-- <img src="cid:unreferenced"> --><template><img src="cid:unreferenced"></template>',
 ...inlinePart("first@example.invalid","image/png",png),
 ...inlinePart("second","image/gif",gif),
 ...inlinePart("unreferenced","image/gif",Buffer.concat([gif,Buffer.from("extra")])),
 ...inlinePart("vector","image/svg+xml",Buffer.from("<svg/>")),
 ...inlinePart("fake","image/png",Buffer.from("<script>alert(1)</script>")),
 "--related--","--alternative--",""
].join("\r\n")).buffer;
const inlineInput={name:"inline.eml",arrayBuffer:async()=>inlineMail};
function mixedInput(bodyType:string,body:string) {
 const content=new TextEncoder().encode([
  "Subject: Inline position","MIME-Version: 1.0",'Content-Type: multipart/mixed; boundary="related"',"",
  "--related",`Content-Type: ${bodyType}; charset=utf-8`,"",body,
  ...inlinePart("position","image/png",png).filter(line=>!line.startsWith("Content-Disposition:")),
  "--related","Content-Type: application/pdf","Content-Disposition: attachment; filename=archive.pdf","",
  "Example printable attachment","--related--",""
 ].join("\r\n")).buffer;
 return {name:"positions.eml",arrayBuffer:async()=>content};
}
describe("inline rasterafbeeldingen",()=>{
 it("bewaart alleen gerefereerde rasterdelen bytegelijk en toont ze in de gewone preview",async()=>{
  const f=fixture();
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.files.size).toBe(3);
  expect(f.files.get("map/inline.eml")).toEqual(inlineMail);
  expect(Buffer.from([...f.files].find(([path])=>path.endsWith(".png"))![1])).toEqual(png);
  expect(Buffer.from([...f.files].find(([path])=>path.endsWith(".gif"))![1])).toEqual(gif);
  expect(f.note()).toContain("Plain-text body");
  expect(f.note().match(/!\[\[/g)).toHaveLength(2);
  expect(f.note()).not.toMatch(/Alternative body|https:|data:image|cid:|unsafe\.html|<script>|Attachments:/);
  const first=f.note();
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.note()).toBe(first);
  expect(f.files.size).toBe(3);
 });
 it("vult een oudere hash-gebonden Event Note aan zonder de bewerkte tekst te vervangen",async()=>{
  const f=fixture();
  await importAttachments([inlineInput],"map",f.store,when,{eventNoteV1:true,preview:true});
  f.set(f.note().split("\n").filter(line=>!line.startsWith("> > ![[")).join("\n").replace("Plain-text body","Eigen mailtekst")+"\nMenselijk slot.\n");
  for(const path of f.files.keys())if(!path.endsWith(".eml"))f.files.delete(path);
  const old=f.note();
  const result=await importAttachments([inlineInput],"map",f.store,when,{eventNoteV1:true,preview:true});
  expect(result.added).toBe(0);
  expect(result.enriched).toBe(1);
  expect(f.note().match(/^> > !\[\[/gm)).toHaveLength(2);
  expect(f.note().replace(/^>\n> > \[!info\]- Meer\n> >\n(?:> > !\[\[[^\n]+\n)+/gm,"")).toBe(old);
  const complete=f.note();
  await importAttachments([inlineInput],"map",f.store,new Date(2026,9,24),{eventNoteV1:true,preview:true});
  expect(f.note()).toBe(complete);
  expect(f.files.size).toBe(3);
 });
 it("herstelt een gedeeltelijk mislukte opslag zonder het bestaande embed te dupliceren",async()=>{
  const f=fixture(),create=f.store.create;
  f.store.create=async(p,b)=>{if(p.endsWith(".gif"))throw Error("tijdelijke schrijffout");await create(p,b);};
  const first=await importAttachments([inlineInput],"map",f.store,when,{preview:true,eventNoteV1:true});
  expect(first.extractionFailures).toHaveLength(1);
  expect(f.note().match(/!\[\[/g)).toHaveLength(1);
  f.store.create=create;
  const retry=await importAttachments([inlineInput],"map",f.store,when,{preview:true,eventNoteV1:true});
  expect(retry.extractionFailures).toHaveLength(0);
  expect(f.note().match(/!\[\[/g)).toHaveLength(2);
  expect(f.files.size).toBe(3);
 });
 it("bewaart geen inline afgeleiden als de preview uitstaat",async()=>{
  const f=fixture();
  await importAttachments([inlineInput],"map",f.store,when,{preview:false,extract:true});
  expect(f.note()).not.toContain("![[");
  expect(f.files.size).toBe(1);
 });
 it.each([
  ["text/html",'<p>Visible before</p><img src="cid:position"><p>Visible after</p>'],
  ["text/html",'<p>Visible before</p><h5><img src="cid:position"></h5><p>Visible after</p>'],
  ["text/plain","Visible before\r\n[cid:position]\r\nVisible after"]
 ])("houdt de positie van een afbeelding in %s met Content-ID zonder disposition",async(type,body)=>{
  const f=fixture();
  await importAttachments([mixedInput(type,body)],"map",f.store,when,{preview:true,eventNoteV1:true});
  expect(f.files.size).toBe(2);
  expect(f.note()).toMatch(/Visible before[\s\S]+!\[\[[^\n]+\.png\]\][\s\S]+Visible after/);
  expect(f.note().match(/!\[\[/g)).toHaveLength(1);
 });
 it("vervangt bij retry alleen een zelfstandige CID-regel in de hash-gebonden eventpreview",async()=>{
  const f=fixture(),create=f.store.create;
  const src=mixedInput("text/plain","Visible before\r\n[cid:position]\r\nVisible after");
  f.store.create=async(p,b)=>{if(p.endsWith(".png"))throw Error("tijdelijke schrijffout");await create(p,b);};
  await importAttachments([src],"map",f.store,when,{preview:true,eventNoteV1:true});
  f.set(f.note().replace("Visible before","Handmatig vóór")+"\nMenselijk slot.\n");
  const old=f.note();
  f.store.create=create;
  await importAttachments([src],"map",f.store,when,{preview:true,eventNoteV1:true});
  expect(f.note()).toMatch(/Handmatig vóór[\s\S]+!\[\[[^\n]+\.png\]\][\s\S]+Visible after/);
  expect(f.note().replace(/^> > !\[\[[^\n]+$/m,"> > &#91;cid:position&#93;  ")).toBe(old);
 });
 it("vult een gewone bestaande preview met CRLF alleen aanvullend en eenmalig aan",async()=>{
  const f=fixture();
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  const old=f.note().split("\n").filter(line=>!line.startsWith("> ![[")).join("\n")
   .replace("Plain-text body","Eigen mailtekst").replace(/\n/g,"\r\n")+"\r\nMenselijk slot.\r\n";
  f.set(old);
  const changed=await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(changed.enriched).toBe(1);
  expect(f.note().replace(/\r\n> \[!quote\]- Inline images\r\n> <!-- outlook-drop-inline:[a-f0-9]+ -->\r\n(?:> !\[\[[^\r]+\r\n){2}/,"")).toBe(old);
  const complete=f.note();
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.note()).toBe(complete);
 });
 it("laat een handmatig geschreven quote achter de EML-link onaangetast",async()=>{
  const f=fixture();
  f.files.set("map/inline.eml",inlineMail);
  const note="[[map/inline.eml]]\n\n> [!quote|outlook-mail]- Mail · Eigen quote\n> Handmatig.\n";
  f.set(note);
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.note()).toBe(note);
 });
 it("bindt een nieuw gemaakte preview aan een bestaande EML-link voor herstel na schrijffout",async()=>{
  const f=fixture(),create=f.store.create;
  f.files.set("map/inline.eml",inlineMail);
  f.set("Eigen begin.\n\n[[map/inline.eml]]\n\nEigen slot.\n");
  f.store.create=async(p,b)=>{if(p.endsWith(".gif"))throw Error("tijdelijke schrijffout");await create(p,b);};
  const first=await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(first.extractionFailures).toHaveLength(1);
  expect(f.note()).toMatch(/outlook-drop-inline:[a-f0-9]+/);
  expect(f.note().match(/!\[\[/g)).toHaveLength(1);
  f.store.create=create;
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  const complete=f.note();
  expect(complete.match(/!\[\[/g)).toHaveLength(2);
  expect(complete).toContain("Eigen begin.");
  expect(complete).toContain("Eigen slot.");
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.note()).toBe(complete);
 });
 it("vult afbeeldingen in dezelfde retry als de migratie van een oude toegevoegdstempel",async()=>{
  const f=fixture();
  f.files.set("map/inline.eml",inlineMail);
  f.set("📎 Toegevoegd op 23 oktober 2026\n\n[[map/inline.eml]]\n\n> [!quote|outlook-mail]- Mail · Inline images\n> Eigen tekst.\n");
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.note()).toContain("# 📎 Inline images");
  expect(f.note()).toContain("> Eigen tekst.");
  expect(f.note().match(/!\[\[/g)).toHaveLength(2);
  const complete=f.note();
  await importAttachments([inlineInput],"map",f.store,when,{preview:true});
  expect(f.note()).toBe(complete);
 });
 it("behoudt platte tekst en losse bijlagen als de HTML-conversie faalt",async()=>{
  const f=fixture();
  const nested="<div>".repeat(6000)+"Nested"+"</div>".repeat(6000);
  const rawText=(await mixedInput("text/html",nested).arrayBuffer());
  const alternative=new TextDecoder().decode(rawText)
   .replace("--related\r\nContent-Type: text/html", [
    "--related",'Content-Type: multipart/alternative; boundary="plain-fallback"',"",
    "--plain-fallback","Content-Type: text/plain","", "Surviving body",
    "--plain-fallback","Content-Type: text/html"
   ].join("\r\n")).replace("</div>\r\n--related","</div>\r\n--plain-fallback--\r\n--related");
  const input={name:"nested.eml",arrayBuffer:async()=>new TextEncoder().encode(alternative).buffer};
  const result=await importAttachments([input],"map",f.store,when,{preview:true,extract:true});
  expect(result.previewFailures).toEqual([]);
  expect(result.extractionFailures).toEqual([]);
  expect(f.note()).toContain("Surviving body");
  expect(f.files.has("map/archive.pdf")).toBe(true);
 });
});
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
