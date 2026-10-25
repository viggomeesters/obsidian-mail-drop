/** Dates use the machine's local timezone; tests can pin an IANA timezone. */
export function localDate(value:Date|string,timeZone?:string):string {
 const date=typeof value==="string"?new Date(value):value;
 if(!Number.isFinite(date.getTime()))return typeof value==="string"?value:"";
 const parts=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone}).formatToParts(date);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";
 return `${part("day")} ${part("month").replace(/\.$/,"")} ${part("year")} at ${part("hour")}:${part("minute")}`;
}
export function mailLiteral(value:string):string {
 return value.replace(/[&<>\\`*_{}\[\]!#|~]/g,char=>`&#${char.charCodeAt(0)};`);
}
export function mailTitle(subject?:string):string {
 const text=(subject??"").replace(/[\x00-\x1f\x7f]+/g," ").replace(/\s+/g," ").trim()||"No subject";
 const chars=Array.from(text);
 return "Mail · "+mailLiteral(chars.length>160?chars.slice(0,159).join("")+"…":text);
}
