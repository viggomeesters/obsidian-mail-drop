import {createHash} from "node:crypto";
export type NameMode="date-kebab"|"kebab"|"original";
const words=new RegExp("[^\\p{L}\\p{N}]+","gu");
function validDate(year:number,month:number,day:number):boolean {
 const date=new Date(Date.UTC(year,month-1,day));
 return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
export function hasFilenameDate(name:string):boolean {
 const patterns=[/(?:^|\D)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)/g,/(?:^|\D)(\d{4})(\d{2})(\d{2})(?!\d)/g];
 for(const pattern of patterns){let match:RegExpExecArray|null;while((match=pattern.exec(name)))if(validDate(+match[1],+match[2],+match[3]))return true;}
 const dayFirst=/(?:^|\D)(\d{2})[-_.](\d{2})[-_.](\d{4})(?!\d)/g;
 let match:RegExpExecArray|null;while((match=dayFirst.exec(name)))if(validDate(+match[3],+match[2],+match[1]))return true;
 return false;
}
export function splitFilename(name:string):{stem:string;extension:string} {
 const compound=name.match(/\.(tar\.(?:gz|bz2|xz|zst))$/i);
 const last=compound??name.match(/\.([a-z0-9]{1,16})$/i);
 return last?{stem:name.slice(0,-last[0].length),extension:last[0].toLowerCase()}:{stem:name,extension:""};
}
export function attachmentFilename(original:string,mode:NameMode,when=new Date()):string {
 if(mode==="original")return original;
 const {stem:raw,extension}=splitFilename(original);
 let stem=raw.normalize("NFC").replace(/([a-z0-9])([A-Z])/g,"$1-$2").replace(/([A-Z])([A-Z][a-z])/g,"$1-$2").toLowerCase().replace(words,"-").replace(/^-+|-+$/g,"")||"attachment";
 if(mode==="date-kebab"&&!hasFilenameDate(raw)){
  const day=`${when.getFullYear()}${String(when.getMonth()+1).padStart(2,"0")}${String(when.getDate()).padStart(2,"0")}`;
  stem=day+"-"+stem;
 }
 if(new TextEncoder().encode(stem+extension).length>230){
  const hash=createHash("sha256").update(original).digest("hex").slice(0,8);
  while(new TextEncoder().encode(stem+"-"+hash+extension).length>230)stem=Array.from(stem).slice(0,-1).join("");
  stem=stem.replace(/-+$/g,"")+"-"+hash;
 }
 return stem+extension;
}
export function numberedFilename(name:string,n:number):string {
 const {stem,extension}=splitFilename(name);return `${stem}-${n}${extension}`;
}
/** A local candidate filter only; actual reuse additionally requires exact byte equality. */
export function sameImportName(original:string,existing:string):boolean {
 const source=splitFilename(attachmentFilename(original,"kebab"));
 const candidate=splitFilename(attachmentFilename(existing,"kebab"));
 if(source.extension!==candidate.extension)return false;
 const hash=createHash("sha256").update(original).digest("hex").slice(0,8);
 if(new TextEncoder().encode(original).length>210&&new RegExp("-"+hash+"(?:-\\d+)?$").test(candidate.stem))return true;
 let stem=candidate.stem;
 if(!hasFilenameDate(original)) {
  const prefix=stem.match(/^(\d{8}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})-/)?.[0];
  if(prefix&&hasFilenameDate(prefix.slice(0,-1)))stem=stem.slice(prefix.length);
 }
 return stem===source.stem||(stem.startsWith(source.stem+"-")&&/^\d+$/.test(stem.slice(source.stem.length+1)));
}

/** Safe single filename even when MIME supplies a path or Obsidian link punctuation. */
export function safeAttachmentName(original:string):string {
 let name=original.normalize("NFC").replace(/[\\/:*?"<>|#^\u005B\u005D\p{Cc}]/gu,"-").replace(/^\.+/,"").trim();
 if(!name||/^\.+$/.test(name))name="attachment";
 if(new TextEncoder().encode(name).length<=230)return name;
 const {stem,extension}=splitFilename(name);let short=stem;
 const hash=createHash("sha256").update(original).digest("hex").slice(0,8);
 while(new TextEncoder().encode(short+"-"+hash+extension).length>230)short=Array.from(short).slice(0,-1).join("");
 return short+"-"+hash+extension;
}
