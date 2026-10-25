/** Keep the licenses of every npm package actually bundled in main.js. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'outputs/obsidian-outlook-drop/bundle-meta.json'),'utf8'));
const packages=new Map();
for(const name of Object.keys(meta.inputs)){
 if(!name.includes('node_modules/'))continue;
 let folder=path.dirname(path.join(root,name));
 while(folder!==root){
  const manifest=path.join(folder,'package.json');
  if(fs.existsSync(manifest)){
   const info=JSON.parse(fs.readFileSync(manifest,'utf8'));
   if(info.name){packages.set(info.name,{folder,info});break;}
  }
  const parent=path.dirname(folder);
  if(parent===folder)throw Error(`Package root not found: ${name}`);
  folder=parent;
 }
}
const parts=['# Third-party notices\n\nThese packages are bundled in `main.js`. The plugin uses the external Obsidian API provided by Obsidian.\n'];
for(const name of [...packages.keys()].sort()){
 const {folder,info}=packages.get(name);
 const licenses=fs.readdirSync(folder).filter(file=>fs.statSync(path.join(folder,file)).isFile()&&/^(license|licence|copying)/i.test(file)).sort();
 if(!licenses.length)throw Error(`No license file found for ${name}`);
 parts.push(`\n## ${name} ${info.version}\n\nLicense: ${info.license??'see below'}\n`);
 for(const file of licenses){
  const text=fs.readFileSync(path.join(folder,file),'utf8').replace(/\r\n?/g,'\n').trimEnd();
  parts.push('\n```text\n'+text+'\n```\n');
 }
}
fs.writeFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),parts.join(''));
console.log(`Preserved license files for ${packages.size} bundled packages.`);
