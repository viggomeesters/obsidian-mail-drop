import {attachmentFilename, NameMode, numberedFilename} from "./naming";
import {failedPreview, legacyFailedPreview, parseMail, renderMailPreview} from "./mail-preview";
import {mailFiles} from "./mail-files";
import {localDate,mailTitle,mailLiteral} from "./mail-format";
import {createHash} from "node:crypto";
/** Keep original bytes unchanged; previews and extracted files are separate derivatives. */
export interface MailFile {name:string;arrayBuffer():Promise<ArrayBuffer>;}
export interface AttachmentStore {
 findSame?(original:string,bytes:ArrayBuffer):Promise<string|undefined>;
 exists(path:string):boolean;
 read(path:string):Promise<ArrayBuffer>;
 create(path:string,bytes:ArrayBuffer):Promise<void>;
 append(update:(current:string)=>string):Promise<void>;
 link(path:string):string;
}
export function safeEmlName(name:string):string {
 let stem=name.replace(/\.eml$/i,"").replace(/[\\/:*?"<>|#^\u005B\u005D\p{Cc}]/gu,"-").replace(/^\.+/,"").trim();
 while(new TextEncoder().encode(stem).length>200)stem=Array.from(stem).slice(0,-1).join("");
 return `${stem||"Outlook-mail"}.eml`;
}
export function attachmentBlock(link:string,when:Date,subject?:string,author=""):string {
 const name=mailLiteral(author.replace(/[\p{Cc}]+/gu," ").trim());
 return `# 📎 ${mailTitle(subject).slice("Mail · ".length)}\n\nAdded on ${localDate(when)}${name?` · ${name}`:""}\n\n${link}\n`;
}
export function sameBytes(a:ArrayBuffer,b:ArrayBuffer):boolean {
 const left=new Uint8Array(a),right=new Uint8Array(b);
 return left.length===right.length&&left.every((value,index)=>value===right[index]);
}
async function saveFile(original:string,bytes:ArrayBuffer,folder:string,store:AttachmentStore,when:Date,mode:NameMode|undefined,mail=false):Promise<string> {
 const reused=await store.findSame?.(original,bytes);
 if(reused)return reused;
 const base=mode&&mode!=="original"?attachmentFilename(original,mode,when):mail?safeEmlName(original):original;
 for(let n=1;n<=10000;n++) {
  const name=n===1?base:mail&&(!mode||mode==="original")?`${base.slice(0,-4)} (${n}).eml`:numberedFilename(base,n);
  const path=folder?`${folder}/${name}`:name;
  if(store.exists(path)) {
   try{if(sameBytes(await store.read(path),bytes))return path;}catch{/* Folders/unreadable files are collisions. */}
   continue;
  }
  try{await store.create(path,bytes);return path;}catch(error){if(store.exists(path)){n--;continue;}throw error;}
 }
 throw Error("No available filename found.");
}
interface Record {subject?:string;link:string;preview?:string;extras:string[];id:string;}
const previewStart=/^\s*> \[!quote(?:\|outlook-mail)?\]- (?:Mailinhoud|Email content|Mail ·)/;
function extrasBlock(record:Record):string {
 return `\n\n<!-- outlook-drop-attachments:${record.id} -->\nAttachments: ${record.extras.join(" · ")}\n<!-- /outlook-drop-attachments -->\n`;
}
export async function importAttachments(files:MailFile[],folder:string,store:AttachmentStore,when=new Date(),options:{nameMode?:NameMode;preview?:boolean;extract?:boolean;author?:string}={}) {
 const records:Record[]=[],failures:{name:string;error:unknown}[]=[],previewFailures:string[]=[],extractionFailures:{name:string;error:unknown}[]=[];
 for(const file of files) {
  try {
   const bytes=await file.arrayBuffer();
   if(!bytes.byteLength)throw Error("The file is empty. Try dragging the email again.");
   const path=await saveFile(file.name,bytes,folder,store,when,options.nameMode,true),link=store.link(path);
   if(records.some(r=>r.link===link))continue;
   const record:Record={subject:file.name.replace(/\.eml$/i,""),link,extras:[],id:createHash("sha256").update(new Uint8Array(bytes)).digest("hex")};
   records.push(record);
   {
    try {
     const mail=await parseMail(bytes);
     record.subject=mail.subject?.trim()||"No subject";
     if(options.preview)record.preview=renderMailPreview(mail);
     if(options.extract)for(const part of mailFiles(mail)) {
      try {
       const saved=await saveFile(part.name,part.bytes,folder,store,when,options.nameMode);
       const extra=store.link(saved);if(!record.extras.includes(extra))record.extras.push(extra);
      }catch(error){extractionFailures.push({name:part.name,error});}
     }
    }catch(error) {
     console.error("Mail content:",error);
     if(options.preview){previewFailures.push(file.name);record.preview=failedPreview;}
     if(options.extract)extractionFailures.push({name:file.name,error});
    }
   }
  }catch(error){failures.push({name:file.name,error});}
 }
 let added=0,enriched=0;
 if(records.length)try {
  await store.append(current=>{
   added=0;enriched=0;
   for(const record of records) {
    const {link,preview}=record;
    if(!current.includes(link)) {
     const separator=current.endsWith("\n\n")?"":current.endsWith("\n")?"\n":current?"\n\n":"";
     current+=separator+attachmentBlock(link,when,record.subject,options.author)+(record.extras.length?extrasBlock(record):"")+(preview?"\n"+preview:"");added++;continue;
    }
    const linkAt=current.indexOf(link);
    const before=current.slice(0,linkAt);
    const registration=before.match(/(?:^|\n)(📎 (?:Toegevoegd op|Added on) [^\n]+\n\n)$/);
    if(registration) {
     const position=before.length-registration[1].length;
     current=current.slice(0,position)+`# 📎 ${mailTitle(record.subject).slice("Mail · ".length)}\n\n`+current.slice(position).replace(/^📎 /,"");enriched++;
    }
    let start=current.indexOf(link)+link.length;
    // A source-bound generated line lets later opt-in/retry add links without touching mail text.
    const marker=`<!-- outlook-drop-attachments:${record.id} -->`;
    let after=current.slice(start),end=0;
    const markerOffset=after.indexOf(marker);
    if(markerOffset>=0&&/^\s*$/.test(after.slice(0,markerOffset))) {
     const close=after.indexOf("<!-- /outlook-drop-attachments -->",markerOffset);
     if(close>=0) {
      end=close+"<!-- /outlook-drop-attachments -->".length;
      const missing=record.extras.filter(extra=>!after.slice(markerOffset,end).includes(extra));
      if(missing.length) {
       const insert=start+close;
       current=current.slice(0,insert)+"Attachments: "+missing.join(" · ")+"\n"+current.slice(insert);
       end+=`Attachments: ${missing.join(" · ")}\n`.length;enriched++;
      }
      start+=end;after=current.slice(start);
     }
    }else if(record.extras.length) {
     const block=extrasBlock(record);current=current.slice(0,start)+block+after;start+=block.length;after=current.slice(start);enriched++;
    }
    if(!preview)continue;
    const whitespace=after.match(/^\s*/)?.[0]??"";
    const failed=[failedPreview,legacyFailedPreview].find(block=>after.slice(whitespace.length).startsWith(block));
    if(failed&&preview!==failedPreview) {
     current=current.slice(0,start)+whitespace+preview+after.slice(whitespace.length+failed.length);enriched++;continue;
    }
    if(previewStart.test(after))continue;
    current=current.slice(0,start)+"\n\n"+preview+after;enriched++;
   }
   return current;
  });
 }catch(error){throw Error(`Email saved (${records.map(r=>r.link).join(", ")}), but its note link could not be added. Drag the email again to retry. ${String(error)}`);}
 return {added,enriched,reused:records.length-added,failures,previewFailures,extractionFailures};
}
