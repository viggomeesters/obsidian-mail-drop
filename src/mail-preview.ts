import PostalMime from "postal-mime";
import {convert} from "html-to-text";
import {randomUUID} from "node:crypto";

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
export function renderMailPreview(mail:Email,inlineCids?:Set<string>,embeds?:ReadonlyMap<string,string>,placeholders?:Map<string,string>):string {
 const fields=[
  ["From",mail.from?address(mail.from):""],
  ["To",(mail.to??[]).map(address).join(", ")],
  ["Cc",(mail.cc??[]).map(address).join(", ")],
  ["Subject",mail.subject?.trim()||"No subject"],
  ["Date",mail.date?localDate(mail.date):""]
 ].filter(([,value])=>value);
 const header=fields.map(([label,value])=>`> **${label}:** ${literal(value.replace(/[\r\n]+/g," "))}  `).join("\n");
 const prefix=embeds?.size?randomUUID():"";
 const tokens=new Map<string,string>();
 const placed=new Set<string>();
 function imageReference(rawId:string,unresolved=""):string {
  let id:string;
  try{id=decodeURIComponent(rawId);}catch{return unresolved;}
  inlineCids?.add(id);
  const embed=embeds?.get(id);
  if(!embed)return unresolved;
  if(placed.has(embed))return "";
  const token=prefix+tokens.size+prefix;
  tokens.set(token,embed);
  placed.add(embed);
  return token;
 }
 const plain=mail.text?.trim().replace(/\[cid:([^\]\s]+)\]/gi,(whole,id:string)=>{
  const token=imageReference(id,whole);
  const embed=tokens.get(token);
  if(embed)placeholders?.set(literal(whole),embed);
  return token;
 });
 // Parse HTML as data. References can only resolve to a local embed supplied by the importer.
 const htmlText=()=>convert(mail.html??"",{wordwrap:false,limits:{maxInputLength:Infinity,maxChildNodes:Infinity,maxDepth:Infinity},selectors:[
  {selector:"img",format:"inlineCid"},{selector:"script",format:"skip"},{selector:"style",format:"skip"},
  {selector:"iframe",format:"skip"},{selector:"object",format:"skip"},{selector:"head",format:"skip"},
  {selector:"template",format:"skip"},{selector:"noscript",format:"skip"},
  {selector:"a",options:{linkBrackets:false}},{selector:"h1",options:{uppercase:false}},
  {selector:"h2",options:{uppercase:false}},{selector:"h3",options:{uppercase:false}}
 ],formatters:{inlineCid(element:{attribs?:{src?:unknown}},_walk,builder:{addInline(value:string,options:{noWordTransform:boolean}):void}){
  const value=element.attribs?.src;
  const src=typeof value==="string"?value.trim():"";
  if(/^cid:.+/i.test(src)) {
   const token=imageReference(src.slice(4));
   if(token)builder.addInline(token,{noWordTransform:true});
  }
 }}}).trim();
 let html="";
 if(mail.html&&(inlineCids||!plain)) {
  try{html=htmlText();}catch(error){if(!plain)throw error;}
 }
 const text=plain||html||"This email has no readable text. Open the original file for its full contents.";
 const tokenPattern=tokens.size?new RegExp("(" + prefix + "\\d+" + prefix + ")"):undefined;
 const quote=text.replace(/\r\n?/g,"\n").split("\n").flatMap(line=>{
  const parts=tokenPattern&&line?line.split(tokenPattern).filter(Boolean):[line];
  return parts.flatMap(part=>{
   const embed=tokens.get(part);
   return embed?[">",`> ${embed}`,">"]:[part?`> ${literal(part)}  `:">"];
  });
 });
 const remaining=embeds?[...new Set(embeds.values())].filter(embed=>!placed.has(embed)):[];
 if(remaining.length)quote.push(">",...remaining.map(image=>`> ${image}`));
 return `> [!quote|outlook-mail]- ${mailTitle(mail.subject)}\n${header}\n>\n`+quote.join("\n")+"\n";
}
export const failedPreview="> [!quote]- Email content\n> Email text could not be read. Open the original file.\n";

/** Recognize the original Dutch failure block on retry without rewriting human content. */
export const legacyFailedPreview="> [!quote]- Mailinhoud\n> Mailtekst kon niet worden gelezen. Open het originele bestand.\n";
