import type {Email} from "postal-mime";
import {safeAttachmentName} from "./naming";
export interface ExtractedMailFile {name:string;bytes:ArrayBuffer;}
/** Explicit attachments, including images, are files. Inline logos/CID parts stay in the EML. */
export function mailFiles(mail:Email):ExtractedMailFile[] {
 return mail.attachments.filter(part=>part.disposition==="attachment"||(!part.related&&part.disposition!=="inline"&&!part.contentId))
  .map((part,index)=>{
   let bytes:ArrayBuffer;
   if(part.content instanceof ArrayBuffer)bytes=part.content;
   else if(part.content instanceof Uint8Array)bytes=part.content.buffer.slice(part.content.byteOffset,part.content.byteOffset+part.content.byteLength) as ArrayBuffer;
   else if(part.encoding==="base64") {const b=Buffer.from(part.content,"base64");bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
   else bytes=new TextEncoder().encode(part.content).buffer;
   return {name:safeAttachmentName(part.filename||`attachment-${index+1}`),bytes};
  });
}
