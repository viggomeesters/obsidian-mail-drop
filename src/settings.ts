import type {DropMode} from './drop-links';
import type {NameMode} from './naming';
export interface MailDropSettings {
 linkExtensions:string;dropMode:DropMode;nameMode:NameMode;mailPreview:boolean;extractAttachments:boolean;logAuthor:string;
 nativeEnabled:boolean;receiverPath:string;
}
export const defaultSettings:MailDropSettings={linkExtensions:'pdf',dropMode:'images-only',nameMode:'date-kebab',mailPreview:true,extractAttachments:false,logAuthor:'',nativeEnabled:false,receiverPath:''};
/** Accept untrusted saved JSON without losing existing preferences or enabling new installs. */
export function readSettings(input:unknown):MailDropSettings {
 const saved:Record<string,unknown>=input!==null&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const existing=Object.keys(saved).length>0;
 return {
  linkExtensions:typeof saved.linkExtensions==='string'?saved.linkExtensions:'pdf',
  dropMode:saved.dropMode==='images-only'||saved.dropMode==='custom'||saved.dropMode==='obsidian'?saved.dropMode:existing?'custom':'images-only',
  nameMode:saved.nameMode==='date-kebab'||saved.nameMode==='kebab'||saved.nameMode==='original'?saved.nameMode:existing?'original':'date-kebab',
  mailPreview:typeof saved.mailPreview==='boolean'?saved.mailPreview:true,
  extractAttachments:typeof saved.extractAttachments==='boolean'?saved.extractAttachments:false,
  logAuthor:typeof saved.logAuthor==='string'?saved.logAuthor:'',
  nativeEnabled:typeof saved.nativeEnabled==='boolean'?saved.nativeEnabled:existing,
  receiverPath:typeof saved.receiverPath==='string'?saved.receiverPath:'',
 };
}
