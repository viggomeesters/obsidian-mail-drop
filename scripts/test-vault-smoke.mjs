/** Exercise the actual release bundle against an isolated filesystem vault and a minimal Obsidian host.
 * This is headless integration evidence, not a claim that a real Obsidian window/provider was tested.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
const root=path.resolve(process.argv[2]||'outputs/test-vault');
if(!await fs.stat(path.join(root,'.mail-drop-test-vault')).then(s=>s.isFile(),()=>false))throw Error('Refusing to modify a vault without the .mail-drop-test-vault marker.');
const pluginDir=path.join(root,'.obsidian/plugins/outlook-drop-importer');
await fs.mkdir(pluginDir,{recursive:true});
for(const name of ['main.js','manifest.json','styles.css'])await fs.copyFile(name==='main.js'?'outputs/obsidian-outlook-drop/main.js':name,path.join(pluginDir,name));
const exists=async p=>!!await fs.stat(p).catch(()=>null);
if(await exists(path.join(pluginDir,'outlook-file-promises')))throw Error('Standard-install fixture must not contain a receiver.');
const target=`fixtures/mail-drop/automated-${process.pid}-${Date.now()}/target.md`;
await fs.mkdir(path.dirname(path.join(root,target)),{recursive:true});
await fs.writeFile(path.join(root,target),'# Synthetic target\n\nHuman text stays.\n');
const entries=new Map();const notices=[];const callbacks=[];const intervals=[];
class TFolder{constructor(p){this.path=p;this.children=[];}}
class TFile{constructor(p,size){this.path=p;this.name=path.basename(p);this.extension=path.extname(p).slice(1);this.stat={size};this.parent=folder(path.dirname(p));}}
function folder(p){if(!entries.has(p))entries.set(p,new TFolder(p));return entries.get(p);}
const note=new TFile(target,(await fs.stat(path.join(root,target))).size);entries.set(target,note);note.parent.children.push(note);
class FileSystemAdapter{getBasePath(){return root;}}
const adapter=new FileSystemAdapter();
const vault={adapter,configDir:'.obsidian',getRoot:()=>folder('.'),getAbstractFileByPath:p=>entries.get(p),read:async f=>fs.readFile(path.join(root,f.path),'utf8'),readBinary:async f=>Uint8Array.from(await fs.readFile(path.join(root,f.path))).buffer,
 createBinary:async(p,bytes)=>{await fs.writeFile(path.join(root,p),new Uint8Array(bytes),{flag:'wx'});const f=new TFile(p,bytes.byteLength);entries.set(p,f);f.parent.children.push(f);return f;},
 process:async(f,update)=>{const p=path.join(root,f.path);await fs.writeFile(p,update(await fs.readFile(p,'utf8')));},};
const app={vault,workspace:{onLayoutReady:cb=>cb(),iterateAllLeaves:()=>{},on:()=>({}),offref:()=>{}},metadataCache:{fileToLinktext:f=>f.name}};
class Plugin{constructor(app,manifest){this.app=app;this.manifest=manifest;}loadData(){return undefined;}async saveData(data){await fs.writeFile(path.join(pluginDir,'data.json'),JSON.stringify(data));}addSettingTab(){}register(fn){callbacks.push(fn);}registerDomEvent(){}registerEvent(){}registerInterval(id){intervals.push(id);}}
class PluginSettingTab{constructor(app,plugin){this.app=app;this.plugin=plugin;}}
class Notice{constructor(message){notices.push(message);}hide(){}}
const obsidian={Plugin,PluginSettingTab,Notice,FileSystemAdapter,TFile,TFolder,MarkdownView:class{},Setting:class{},Platform:{isMacOS:process.platform==='darwin'}};
const require=createRequire(path.resolve('outputs/obsidian-outlook-drop/main.js'));const module={exports:{}};
vm.runInNewContext(await fs.readFile(path.join(pluginDir,'main.js'),'utf8'),{require:name=>name==='obsidian'?obsidian:require(name),module,exports:module.exports,console,process,Buffer,Blob,TextEncoder,TextDecoder,Date,Uint8Array,ArrayBuffer,window:{setInterval},document:{},setTimeout,clearTimeout},{filename:'mail-drop-release.js',displayErrors:false});
const p=new module.exports.default(app,JSON.parse(await fs.readFile('manifest.json','utf8')));
const checks={};const check=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name);};
try{
 await p.onload();await delay(30);
 check('three-file install has no native child',!p.native&&!p.settings.nativeEnabled);
 check('no missing-receiver startup notice',notices.length===0);
 const raw=await fs.readFile(path.join(root,'fixtures/mail-drop/plain.eml'));
 const file={name:'Plain Test.eml',arrayBuffer:async()=>Uint8Array.from(raw).buffer};
 await p.importFiles([file],note,undefined,new Date('2026-10-25T08:00:00Z'));
 let text=await vault.read(note);
 check('H1 and collapsed preview',text.includes('# 📎 Isolated installation test')&&text.includes('> [!quote|outlook-mail]-'));
 check('human text retained',text.includes('Human text stays.'));
 const saved=note.parent.children.filter(f=>f.extension==='eml');check('exact original bytes',saved.length===1&&Buffer.from(await vault.readBinary(saved[0])).equals(raw));
 await p.importFiles([file],note,undefined,new Date('2026-10-25T08:00:00Z'));check('repeat deduplicates',await vault.read(note)===text);
 await p.importFiles([{name:'empty.eml',arrayBuffer:async()=>new ArrayBuffer(0)}],note,undefined,new Date());check('empty source preserves note',await vault.read(note)===text);
 p.settings.nativeEnabled=true;p.settings.receiverPath=path.join(root,'not-installed');await p.configureReceiver();check('missing optional receiver does not break plugin',!p.native&&p.receiverStatus.includes('not found'));
 if(process.argv[3]){
  p.settings.receiverPath=path.resolve(process.argv[3]);await p.configureReceiver();
  for(let i=0;i<30&&!p.nativeEvents.some(e=>e.event==='ready');i++)await delay(100);
  check('explicit installed receiver starts',p.nativeEvents.some(e=>e.event==='ready'));
  const child=p.native.child;p.settings.nativeEnabled=false;await p.configureReceiver();await delay(300);check('opt-out stops child',!p.native&&child.exitCode!==null);
 }
 check('settings retained',p.settings.dropMode==='images-only'&&p.settings.nameMode==='date-kebab'&&p.settings.logAuthor==='');
 const report={kind:'headless release-bundle integration with minimal Obsidian host',root,checks,realObsidianWindow:false};
 await fs.writeFile(path.join(root,'smoke-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{for(const fn of callbacks.reverse())fn();for(const id of intervals)clearInterval(id);}
