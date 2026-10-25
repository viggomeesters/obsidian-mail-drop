/** Actual Obsidian synthetic-DOM acceptance. Requires the isolated test vault already open.
 * Does not simulate a real Mail/Outlook drag or prove Community installation.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const [vaultRoot,reportFile]=process.argv.slice(2);
if(!vaultRoot||!reportFile||!fs.existsSync(path.join(vaultRoot,'.mail-drop-test-vault')))throw Error('An explicitly marked test vault and report path are required.');
async function verify(config){
 const fs=require('node:fs');
 const report={realObsidian:true,realProviderDrag:false,communityInstall:false,vault:app.vault.getName(),checks:{}};
 const check=(name,value)=>{report.checks[name]=!!value;if(!value)throw Error(name);};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const leaf=app.workspace.activeLeaf;const state=leaf.getViewState();const markdown=app.vault.getConfig('useMarkdownLinks');
 const ids=['attachment-link-rules','outlook-drop-importer'];
 try{
  check('isolated-vault',app.vault.adapter.getBasePath()===config.vaultRoot);
  for(const reverse of [false,true]){
   for(const id of ids)await app.plugins.disablePlugin(id);
   for(const id of reverse?[...ids].reverse():ids)await app.plugins.enablePlugin(id);
   const p=app.plugins.plugins['outlook-drop-importer'];
   check('cooperation-mode-'+reverse,p.settings.dropMode==='link-rules'&&!p.native);
   const folder='fixtures/mail-drop/cooperation-'+Date.now();await app.vault.createFolder(folder);
   const note=await app.vault.create(folder+'/target.md','# Integration\n\nHuman text stays.\n\n![[keep.pdf]]\n\n');
   await leaf.openFile(note,{active:false});await leaf.setViewState({type:'markdown',state:{file:note.path,mode:'source'}});
   const view=leaf.view;
   const drop=async(name,bytes,slow=false,editDuring=false)=>{
    view.editor.setCursor(view.editor.lastLine(),view.editor.getLine(view.editor.lastLine()).length);
    const dt=new DataTransfer();const file=new File([bytes],name);
    if(slow)Object.defineProperty(file,'arrayBuffer',{value:async()=>{await delay(1200);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}});
    dt.items.add(file);const event=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt});
    view.contentEl.dispatchEvent(event);
    if(editDuring)view.editor.replaceRange("\nTyped during import.\n",{line:view.editor.lastLine(),ch:view.editor.getLine(view.editor.lastLine()).length});
    await p.pending;await delay(50);await view.save();
    check('intercept-'+reverse+'-'+name,event.defaultPrevented);
    return await app.vault.read(note);
   };
   app.vault.setConfig('useMarkdownLinks',false);
   for(const name of ['Test Report.pdf','Data Sheet.xlsx','Recording.mp3','Clip.mp4','Photo.PNG','Unknown.zzz']){
    const bytes=Buffer.from('Synthetic original bytes for '+name);const text=await drop(name,bytes,name.endsWith('.pdf'));
    const files=note.parent.children.filter(f=>f.path!==note.path&&f.name.toLowerCase().endsWith(name.slice(name.lastIndexOf('.')).toLowerCase()));
    check('one-file-'+reverse+'-'+name,files.length===1);const saved=files[0];
    check('name-'+reverse+'-'+name,/^\d{8}-[a-z0-9-]+\.[a-z0-9]+$/i.test(saved.name));
    check('bytes-'+reverse+'-'+name,Buffer.from(await app.vault.readBinary(saved)).equals(bytes));
    const target=app.metadataCache.fileToLinktext(saved,note.path,true);
    check('syntax-'+reverse+'-'+name,text.includes((name==='Photo.PNG'?'!':'')+'[['+target+']]')&&(name==='Photo.PNG'||!text.includes('![['+target+']]')));
    check('one-link-'+reverse+'-'+name,text.split(saved.name).length===2);
    check('preserved-'+reverse+'-'+name,text.includes('Human text stays.')&&text.includes('![[keep.pdf]]'));
   }
   let typed=await drop('Typing Report.pdf',Buffer.from('typing preservation'),true,true);
   check('edit-during-slow-import-'+reverse,typed.includes('Typed during import.')&&typed.includes('typing-report.pdf'));
   const old=note.parent.children.length;await drop('Test Report.pdf',Buffer.from('Synthetic original bytes for Test Report.pdf'));
   check('repeat-no-file-copy-'+reverse,note.parent.children.length===old);
   app.vault.setConfig('useMarkdownLinks',true);
   let text=await drop('Markdown Report.pdf',Buffer.from('markdown pdf'));
   check('native-markdown-style-'+reverse,/\[[^\]]*\]\([^\n]+markdown-report\.pdf\)/.test(text)&&!text.includes('![Markdown'));
   text=await drop('Markdown Photo.PNG',Buffer.from('markdown image'));
   check('native-markdown-image-'+reverse,/!\[[^\]]*\]\([^\n]+markdown-photo\.png\)/.test(text));
   const eml=Buffer.from('From: Example <sender@example.test>\r\nTo: Reader <reader@example.test>\r\nSubject: Integration Mail\r\nDate: Sun, 25 Oct 2026 10:00:00 +0100\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSynthetic email body.\r\n');
   text=await drop('Integration Mail.eml',eml);
   check('mail-h1-and-collapsed-'+reverse,text.includes('# 📎 Integration Mail')&&text.includes('> [!quote|outlook-mail]-'));
   check('mail-original-bytes-'+reverse,Buffer.from(await app.vault.readBinary(note.parent.children.find(f=>f.extension==='eml'))).equals(eml));
   await app.plugins.disablePlugin('attachment-link-rules');
   const detail={version:1,fileName:'x.pdf',link:'![[x.pdf]]',handled:false};document.dispatchEvent(new CustomEvent('attachment-link-rules:format-v1',{detail}));
   check('formatter-unloaded-'+reverse,!detail.handled&&detail.link==='![[x.pdf]]');
   await drop('Fallback.pdf',Buffer.from('fallback'));check('missing-formatter-import-retained-'+reverse,note.parent.children.some(f=>f.name.endsWith('fallback.pdf')));
   await app.plugins.enablePlugin('attachment-link-rules');
   await app.plugins.disablePlugin('outlook-drop-importer');
   const before=view.editor.getValue();
   const nativeDrop=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()});
   view.contentEl.dispatchEvent(nativeDrop);
   view.editor.replaceRange('\n![[Standalone.pdf]] [[Standalone.png]] ![[Standalone.xyz]]\n',{line:view.editor.lastLine(),ch:view.editor.getLine(view.editor.lastLine()).length});
   await delay(150);
   const standalone=view.editor.getValue();
   check('standalone-observer-'+reverse,standalone.startsWith(before)&&standalone.includes('[[Standalone.pdf]] ![[Standalone.png]] [[Standalone.xyz]]')&&!standalone.includes('![[Standalone.pdf]]'));
   await app.plugins.enablePlugin('outlook-drop-importer');
  }
  report.passed=true;
 }catch(e){report.passed=false;report.error=String(e);}
 finally{app.vault.setConfig('useMarkdownLinks',markdown);await leaf.setViewState(state);fs.writeFileSync(config.reportFile,JSON.stringify(report,null,2));}
 return report;
}
fs.mkdirSync(path.dirname(path.resolve(reportFile)),{recursive:true});
if(fs.existsSync(reportFile))fs.unlinkSync(reportFile);
console.log(execFileSync('obsidian',[`vault=${path.basename(path.resolve(vaultRoot))}`,'eval',`code=(${verify.toString()})(${JSON.stringify({vaultRoot:path.resolve(vaultRoot),reportFile:path.resolve(reportFile)})})`],{encoding:'utf8',timeout:60000}));
for(let attempt=0;attempt<180&&!fs.existsSync(reportFile);attempt++)await delay(250);
const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));if(!report.passed)process.exit(1);
