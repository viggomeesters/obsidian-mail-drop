import PostalMime from "postal-mime";
import {convert} from "html-to-text";

import {localDate,mailLiteral as literal,mailTitle} from "./mail-format";
import type {Email} from "postal-mime";

function address(value:{name?:string;address?:string}):string {
 return value.name?`${value.name} <${value.address??""}>`:value.address??"";
}
export async function mailPreview(bytes:ArrayBuffer):Promise<string> {
 return renderMailPreview(await parseMail(bytes));
}
export async function parseMail(bytes:ArrayBuffer):Promise<Email> {
 return PostalMime.parse(bytes,{rfc822Attachments:true});
}
export function renderMailPreview(mail:Email):string {
 const fields=[
  ["From",mail.from?address(mail.from):""],
  ["To",(mail.to??[]).map(address).join(", ")],
  ["Cc",(mail.cc??[]).map(address).join(", ")],
  ["Subject",mail.subject?.trim()||"No subject"],
  ["Date",mail.date?localDate(mail.date):""]
 ].filter(([,value])=>value);
 const header=fields.map(([label,value])=>`> **${label}:** ${literal(value.replace(/[\r\n]+/g," "))}  `).join("\n");
 // HTML is parsed as data, never loaded into a browser. No images or remote requests.
 const htmlText=()=>convert(mail.html??"",{wordwrap:false,limits:{maxInputLength:Infinity,maxChildNodes:Infinity,maxDepth:Infinity},selectors:[
  {selector:"img",format:"skip"},{selector:"script",format:"skip"},{selector:"style",format:"skip"},
  {selector:"iframe",format:"skip"},{selector:"object",format:"skip"},
  {selector:"a",options:{linkBrackets:false}},{selector:"h1",options:{uppercase:false}},
  {selector:"h2",options:{uppercase:false}},{selector:"h3",options:{uppercase:false}}
 ]}).trim();
 const text=mail.text?.trim()||(mail.html?htmlText():"")||"This email has no readable text. Open the original file for its full contents.";
 return `> [!quote|outlook-mail]- ${mailTitle(mail.subject)}\n${header}\n>\n`+text.replace(/\r\n?/g,"\n").split("\n").map(line=>line?`> ${literal(line)}  `:">").join("\n")+"\n";
}
export const failedPreview="> [!quote]- Email content\n> Email text could not be read. Open the original file.\n";

/** Recognize the original Dutch failure block on retry without rewriting human content. */
export const legacyFailedPreview="> [!quote]- Mailinhoud\n> Mailtekst kon niet worden gelezen. Open het originele bestand.\n";
