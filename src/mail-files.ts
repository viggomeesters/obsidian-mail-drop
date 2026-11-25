import type {Email} from "postal-mime";
import {createHash} from "node:crypto";
import {safeAttachmentName} from "./naming";
export interface ExtractedMailFile {name:string;bytes:ArrayBuffer;}
function attachmentBytes(part:Email["attachments"][number]):ArrayBuffer {
 if(part.content instanceof ArrayBuffer)return part.content;
 if(part.content instanceof Uint8Array)return Uint8Array.from(part.content).buffer;
 if(part.encoding==="base64")return Uint8Array.from(Buffer.from(part.content,"base64")).buffer;
 return new TextEncoder().encode(part.content).buffer;
}
/** The optional attachment list excludes MIME parts used only in the preview. */
export function mailFiles(mail:Email):ExtractedMailFile[] {
 return mail.attachments.filter(part=>part.disposition==="attachment"||(!part.related&&part.disposition!=="inline"&&!part.contentId))
  .map((part,index)=>({name:safeAttachmentName(part.filename||`attachment-${index+1}`),bytes:attachmentBytes(part)}));
}

function rasterExtension(mimeType:string,bytes:Buffer):string|undefined {
 switch(mimeType.toLowerCase()) {
  case "image/png": if(bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))return "png";break;
  case "image/jpeg": if(bytes.subarray(0,3).equals(Buffer.from("ffd8ff","hex")))return "jpg";break;
  case "image/gif": if(["GIF87a","GIF89a"].includes(bytes.toString("ascii",0,6)))return "gif";break;
  case "image/webp": if(bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "webp";break;
 }
 return undefined;
}

export function inlineImageFiles(mail:Email,referenced:Set<string>):Array<ExtractedMailFile&{contentId:string}> {
 const parts=new Map<string,Email["attachments"][number]|null>();
 for(const part of mail.attachments) {
  const id=part.contentId?.trim().replace(/^<(.+)>$/,"$1");
  if(id&&referenced.has(id))parts.set(id,parts.has(id)?null:part);
 }
 const images:Array<ExtractedMailFile&{contentId:string}>=[];
 for(const id of referenced) {
  const part=parts.get(id);
  if(!part)continue;
  const bytes=attachmentBytes(part);
  const content=Buffer.from(bytes);
  const extension=rasterExtension(part.mimeType,content);
  if(!extension)continue;
  const digest=createHash("sha256").update(content).digest("hex").slice(0,24);
  const name=`inline-${digest}.${extension}`;
  images.push({name,bytes,contentId:id});
 }
 return images;
}
