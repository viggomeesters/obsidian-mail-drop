import { describe, expect, it } from "vitest";
import { attachmentBlock, importAttachments, safeEmlName } from "../src/attachments";

const file = (name: string, content = "From: test@example.com\r\nSubject: Test\r\n\r\nOrigineel café\r\n") => ({name, arrayBuffer: async () => new TextEncoder().encode(content).buffer});
function fixture() {
 const binaries = new Map<string, ArrayBuffer>();
 let text = "# Mijn note\n\nBestaande tekst en selectie.\n";
 const store = {
  exists: (path: string) => binaries.has(path),
  read: async (path: string) => binaries.get(path)!,
  create: async (path: string, bytes: ArrayBuffer) => {if(binaries.has(path)) throw Error("Bestaat al"); binaries.set(path, bytes);},
  append: async (fn: (current: string) => string) => {text = fn(text);},
  link: (path: string) => `[[${path.split("/").pop()}]]`
 };
 return {binaries,store,text:()=>text};
}
const when = new Date(2026,9,23,10,0);
describe("originele mail als attachment",()=>{
 it("bewaart originele bytes naast de note en voegt het exacte voorbeeldblok toe",async()=>{
  const f=fixture(), input=file("Accepted Project Planning.eml");
  const result=await importAttachments([input],"00-inbox/voorbeeld",f.store,when);
  expect(result.added).toBe(1);
  expect(new Uint8Array(f.binaries.get("00-inbox/voorbeeld/"+input.name)!)).toEqual(new Uint8Array(await input.arrayBuffer()));
  expect(f.text()).toBe("# Mijn note\n\nBestaande tekst en selectie.\n\n# 📎 Test\n\nAdded on 23 Oct 2026 at 10:00\n\n[["+input.name+"]]\n");
 });
 it("ondersteunt meerdere mails en herhaalde drops zonder dubbele blokken",async()=>{
  const f=fixture(); const inputs=[file("een.eml"),file("twee.EML")];
  await importAttachments(inputs,"map",f.store,when);
  const before=f.text(); await importAttachments(inputs,"map",f.store,when);
  expect(f.binaries.size).toBe(2); expect(f.text()).toBe(before);
 });
 it("overschrijft gelijknamige verschillende mails nooit en hergebruikt de suffix bij herhalen",async()=>{
  const f=fixture(); await importAttachments([file("zelfde.eml","eerste")],"map",f.store,when);
  await importAttachments([file("zelfde.eml","tweede")],"map",f.store,when);
  expect(new TextDecoder().decode(f.binaries.get("map/zelfde.eml"))).toBe("eerste");
  expect(new TextDecoder().decode(f.binaries.get("map/zelfde (2).eml"))).toBe("tweede");
  const before=f.text(); await importAttachments([file("zelfde.eml","tweede")],"map",f.store,when);
  expect(f.text()).toBe(before); expect(f.binaries.size).toBe(2);
 });
 it("werkt in de vaultroot, zonder nieuwe Emails-map of mailconversie",async()=>{
  const f=fixture();await importAttachments([file("mail.eml")],"",f.store,when);
  expect([...f.binaries.keys()]).toEqual(["mail.eml"]);
 });
 it("registreert succesvolle mails ook als een andere mail onleesbaar is",async()=>{
  const f=fixture();const bad={name:"kapot.eml",arrayBuffer:async()=>{throw Error("niet leesbaar");}};
  const result=await importAttachments([file("goed.eml"),bad],"map",f.store,when);
  expect(result.added).toBe(1);expect(result.failures).toHaveLength(1);expect(f.text()).toContain("[[goed.eml]]");expect(f.text()).not.toContain("[[kapot.eml]]");
 });
 it("behoudt opgeslagen bron bij mislukte notewrite; opnieuw proberen herstelt zonder duplicaat",async()=>{
  const f=fixture();const append=f.store.append; f.store.append=async()=>{throw Error("note read-only");};
  await expect(importAttachments([file("mail.eml")],"map",f.store,when)).rejects.toThrow("mail.eml");
  expect(f.binaries.size).toBe(1);expect(f.text()).not.toContain("Attachment");
  f.store.append=append; await importAttachments([file("mail.eml")],"map",f.store,when);
  expect(f.binaries.size).toBe(1);expect(f.text()).toContain("[[mail.eml]]");
 });
 it("behoudt gelijktijdig toegevoegde menselijke tekst tijdens de atomische notewrite",async()=>{
  const f=fixture(); const append=f.store.append;
  f.store.append=async fn=>{await append(s=>s+"\nNet getypt.");await append(fn);};
  await importAttachments([file("mail.eml")],"map",f.store,when);
  expect(f.text()).toContain("Net getypt.");
 });
 it("maakt links veilig en formatteert datum/tijd zoals het voorbeeld",()=>{
  expect(safeEmlName("../x[[#|^\n.eml")).not.toMatch(/[\/\[\]#|^\n]/);
  expect(attachmentBlock("[[mail.eml]]",when)).toBe("# 📎 No subject\n\nAdded on 23 Oct 2026 at 10:00\n\n[[mail.eml]]\n");
 });
 it("past naamregel toe, bewaart ongelijke mailbytes en hergebruikt een eerder geïmporteerde naam",async()=>{
  const f=fixture();const options={nameMode:"date-kebab" as const,preview:true};
  const input=file("Nieuwe Mail.eml");await importAttachments([input],"map",f.store,when,options);
  expect(f.binaries.has("map/20261023-nieuwe-mail.eml")).toBe(true);
  await importAttachments([file("Nieuwe Mail.eml","Andere inhoud")],"map",f.store,when,options);
  expect(f.binaries.has("map/20261023-nieuwe-mail-2.eml")).toBe(true);
  const store={...f.store,findSame:async()=>"map/20261023-nieuwe-mail.eml"};
  const before=f.text();await importAttachments([input],"map",store,new Date(2026,9,24),options);
  expect(f.binaries.size).toBe(2);expect(f.text()).toBe(before);
 });

 it("herstelt H1 met paperclip bij koploze compactregistratie zonder preview of bytes te wijzigen",async()=>{
  const f=fixture(),input=file("kopproef.eml");
  const store={...f.store,append:async(fn:(s:string)=>string)=>{await f.store.append(fn);}};
  await importAttachments([input],"map",store,when,{preview:true});
  await f.store.append(s=>s.replace("# 📎 Test\n\nAdded on 23 Oct 2026 at 10:00", "📎 Toegevoegd op 23 okt 2026 om 10:00 · Legacy User")+"\nEigen slottekst.\n");
  await importAttachments([input],"map",store,when,{preview:true});
  expect(f.text()).toContain("# 📎 Test\n\nToegevoegd op");expect(f.text().match(/# 📎 Test/g)).toHaveLength(1);expect(f.text()).toContain("Eigen slottekst.");
  const before=f.text();await importAttachments([input],"map",store,when,{preview:true});expect(f.text()).toBe(before);expect(f.binaries.size).toBe(1);
 });

 it("adds an optional author without allowing Markdown injection",()=>{
  expect(attachmentBlock("[[mail.eml]]",when,"Subject","Alex\n![[image]]")).toContain("Added on 23 Oct 2026 at 10:00 · Alex &#33;&#91;&#91;image&#93;&#93;");
  expect(attachmentBlock("[[mail.eml]]",when,"Subject")).not.toContain("Viggo");
 });

});
