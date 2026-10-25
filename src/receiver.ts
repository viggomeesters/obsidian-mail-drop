import {access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
/** Only locate an explicitly installed executable. Never download, extract, chmod or install it. */
export async function installedReceiver(configured:string,legacyPath:string):Promise<string|null> {
 const path=configured.trim()||legacyPath;
 if(!isAbsolute(path))return null;
 try {if(!(await stat(path)).isFile())return null;await access(path,constants.X_OK);return path;}catch{return null;}
}
