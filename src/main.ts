import { FileSystemAdapter, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, Platform, type SettingDefinitionItem, TFile, TFolder } from "obsidian";
import { importAttachments, MailFile, sameBytes } from "./attachments";
import { NativeBridge, NativeEvent, NativeTarget, helperPath, nativeMailFiles } from "./native";
import { rm } from "node:fs/promises";
import { DropMode, linkedExtensions, wantsPlainLink, droppedFileLink } from "./drop-links";

import {readSettings,defaultSettings,type MailDropSettings} from "./settings";
import {installedReceiver} from "./receiver";

import {attachmentFilename, NameMode, numberedFilename, sameImportName} from "./naming";

export function droppedMails(transfer: DataTransfer | null): File[] {
 const files=Array.from(transfer?.files ?? []);
 if(!files.length) for(const item of Array.from(transfer?.items ?? [])) {
  if(item.kind==="file") {const file=item.getAsFile();if(file) files.push(file);}
 }
 return files.filter(file=>/\.eml$/i.test(file.name));
}

export default class OutlookDropImporter extends Plugin {
 private pending: Promise<void>=Promise.resolve();
 settings:MailDropSettings={...defaultSettings};
 receiverStatus="Native email dragging is off.";
 private unloading=false;
 private receiverGeneration=0;
 private settingsTab?:DropSettingsTab;
 private native?: NativeBridge;
 private nativeViews=new Map<string,MarkdownView>();
 private nativeIds=new WeakMap<MarkdownView,string>();
 private nativeCounter=0;
 private nativeEvents:NativeEvent[]=[];
 private receivingNotices=new Map<string,Notice>();

 async onload(): Promise<void> {
  const saved:unknown=await this.loadData();
  this.settings=readSettings(saved);
  if(!saved)await this.saveData(this.settings);
  this.settingsTab=new DropSettingsTab(this);
  this.addSettingTab(this.settingsTab);
  // Capture before the editor's native attachment handler: one import, one block.
  // Scope listeners to all Obsidian windows, including detached Markdown panes.
  const documents=new WeakSet<Document>();
  const register=(doc:Document)=>{
   if(documents.has(doc)) return;
   documents.add(doc);
   this.registerDomEvent(doc,"dragover",event=>{
    if(Array.from(event.dataTransfer?.types??[]).includes("Files")) event.preventDefault();
   },true);
   this.registerDomEvent(doc,"drop",event=>this.handleDrop(event),true);
  };
  this.register(()=>{this.unloading=true;this.receiverGeneration++;this.native?.stop();for(const notice of this.receivingNotices.values())notice.hide();this.receivingNotices.clear();});
  this.app.workspace.onLayoutReady(()=>{
  if(this.unloading)return;
  register(document);
  this.app.workspace.iterateAllLeaves(leaf=>register(leaf.view.containerEl.ownerDocument));
  this.registerEvent(this.app.workspace.on("window-open",(_workspace,win)=>register(win.document)));
  const refresh=()=>this.refreshNativeTargets();
  this.registerInterval(window.setInterval(refresh,250));
  this.registerEvent(this.app.workspace.on("layout-change",refresh));
  void this.configureReceiver();
  });
 }

 async configureReceiver():Promise<void> {
  const generation=++this.receiverGeneration;
  this.native?.stop();this.native=undefined;
  for(const notice of this.receivingNotices.values())notice.hide();this.receivingNotices.clear();
  if(!this.settings.nativeEnabled||!Platform.isMacOS||!(this.app.vault.adapter instanceof FileSystemAdapter)){
   this.receiverStatus="Native email dragging is off.";return;
  }
  const fallback=helperPath(this.app.vault.adapter.getBasePath(),this.manifest.dir??`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  const executable=await installedReceiver(this.settings.receiverPath,fallback);
  if(this.unloading||generation!==this.receiverGeneration)return;
  if(!executable){this.receiverStatus="Receiver not found. Choose an installed macOS receiver.";return;}
  this.receiverStatus="Starting receiver…";
  this.settingsTab?.updateReceiverStatus();
  let failed=false;
  this.native=new NativeBridge(executable,event=>{
   if(this.unloading||generation!==this.receiverGeneration)return;
   if(event.event==="ready"){this.receiverStatus="Receiver connected.";this.settingsTab?.updateReceiverStatus();}
   this.handleNativeEvent(event);
  },error=>{
   if(this.unloading||generation!==this.receiverGeneration)return;
   this.receiverStatus="Receiver could not start. Check its path and macOS permissions.";
   this.settingsTab?.updateReceiverStatus();
   console.error("Mail Drop receiver:",error);
   if(!failed){failed=true;new Notice(this.receiverStatus,10000);}
  });
  this.refreshNativeTargets();
 }

 private handleDrop(event:DragEvent):void {
  if(event.defaultPrevented) return;
  // Read native file objects synchronously: DataTransfer is protected after drop.
  const files=droppedMails(event.dataTransfer);
  if(!files.length) {this.handleDocumentDrop(event);return;}
  event.preventDefault();
  event.stopImmediatePropagation();
  const element=event.target as Node|null;
  let target:MarkdownView|undefined;
  this.app.workspace.iterateAllLeaves(leaf=>{
   if(leaf.view instanceof MarkdownView && element && leaf.view.containerEl.contains(element)) target=leaf.view;
  });
  if(!target?.file) {new Notice("Drop the email onto an open note.");return;}
  const view=target, note=target.file, when=new Date();
  this.pending=this.pending.then(async()=>{await this.importFiles(files,note,view,when);}).catch(error=>{
   console.error("Outlook Drop Importer:",error);
   new Notice(String(error instanceof Error?error.message:error),10000);
  });
 }

 private handleDocumentDrop(event:DragEvent):void {
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const extensions=linkedExtensions(this.settings.linkExtensions),mode=this.settings.dropMode;
  if(mode==="obsidian"||(mode==="custom"&&!extensions.size))return;
  const external=Array.from(event.dataTransfer?.files??[]);
  let internal:TFile[]=[];
  // Obsidian's own drag descriptors are stable in the installed host. Require its URI as well,
  // so stale descriptors can never turn an unrelated text/browser drop into a file drop.
  if(!external.length&&event.dataTransfer?.getData("text/plain").includes("obsidian://")) {
   const manager=(this.app as unknown as {dragManager:{draggable?:{type:string;file?:TFile;files?:unknown[]}}}).dragManager;
   const drag=manager.draggable;
   if(drag?.type==="file"&&drag.file instanceof TFile)internal=[drag.file];
   else if(drag?.type==="files"&&drag.files?.every(file=>file instanceof TFile))internal=drag.files;
  }
  if(!(external.length&&this.settings.nameMode!=="original")&&![...external,...internal].some(file=>wantsPlainLink(file.name,extensions,mode)))return;
  let view:MarkdownView|undefined;
  this.app.workspace.iterateAllLeaves(leaf=>{
   if(leaf.view instanceof MarkdownView&&event.target&&leaf.view.containerEl.contains(event.target as Node))view=leaf.view;
  });
  if(!view?.file)return;
  const target=view,note=view.file,editor=view.editor;
  const when=new Date();
  const snapshot={text:editor.getValue(),from:editor.getCursor("from"),to:editor.getCursor("to")};
  event.preventDefault();event.stopImmediatePropagation();
  this.pending=this.pending.then(async()=>{
   const files=[...internal];
   for(const input of external) {
    const bytes=await input.arrayBuffer();
    const desired=attachmentFilename(input.name,this.settings.nameMode,when);
    const proposed=await this.app.fileManager.getAvailablePathForAttachment(desired,note.path);
    const folder=proposed.includes("/")?proposed.slice(0,proposed.lastIndexOf("/")):"";
    const reused=await this.findSame(folder,input.name,bytes);
    if(reused){const file=this.app.vault.getAbstractFileByPath(reused);if(file instanceof TFile){files.push(file);continue;}}
    let created:TFile|undefined;
    for(let n=1;n<=10000;n++) {
     const name=n===1?desired:numberedFilename(desired,n);
     const path=folder?folder+"/"+name:name;
     if(this.app.vault.getAbstractFileByPath(path))continue;
     try{created=await this.app.vault.createBinary(path,bytes);break;}
     catch(error){if(this.app.vault.getAbstractFileByPath(path))continue;throw error;}
    }
    if(!created)throw Error("No available filename found.");
    files.push(created);
   }
   const links=files.map(file=>droppedFileLink(file.name,this.app.metadataCache.fileToLinktext(file,note.path,true),extensions,mode)).join("\n");
   if(target.file===note&&target.getMode()==="source"&&editor.getValue()===snapshot.text) {
    editor.replaceRange(links,snapshot.from,snapshot.to,"input");await target.save();
   } else {
    // If the user edited or changed panes during I/O, append instead of overwriting a stale selection.
    if(target.file===note)await target.save();
    await this.app.vault.process(note,current=>current+(current.endsWith("\n")?"\n":"\n\n")+links+"\n");
   }
  }).catch(error=>{console.error("Attachment drop:",error);new Notice(`Could not add the file link: ${String(error)}. Saved files remain in the attachment folder.`,10000);});
 }

 private refreshNativeTargets():void {
  const targets:NativeTarget[]=[];
  this.nativeViews.clear();
  this.app.workspace.iterateAllLeaves(leaf=>{
   if(!(leaf.view instanceof MarkdownView)||!leaf.view.file)return;
   const view=leaf.view,win=view.containerEl.ownerDocument.defaultView;
   const rect=view.contentEl.getBoundingClientRect();
   if(!win||rect.width<30||rect.height<30)return;
   let id=this.nativeIds.get(view);
   if(!id){id=`note-${++this.nativeCounter}`;this.nativeIds.set(view,id);}
   this.nativeViews.set(id,view);
   targets.push({id,path:view.file!.path,x:win.screenX+rect.left,y:win.screenY+rect.top,width:rect.width,height:rect.height});
  });
  this.native?.updateTargets(targets);
 }

 private handleNativeEvent(event:NativeEvent):void {
  this.nativeEvents.push(event);
  if(this.nativeEvents.length>15)this.nativeEvents.shift();
  const receipt=event.directory??event.target??"";
  if(event.event==="receiving"){
   this.receivingNotices.get(receipt)?.hide();
   this.receivingNotices.set(receipt,new Notice("Receiving email…",8000));return;
  }
  if(event.event==="drop"||event.event==="error"){
   this.receivingNotices.get(receipt)?.hide();this.receivingNotices.delete(receipt);
  }
  if(event.event==="error"){new Notice(event.message??"The mail app did not provide the email. Try dragging it again.",10000);return;}
  if(event.event!=="drop")return;
  const when=event.when?new Date(event.when):new Date();
  const view=this.nativeViews.get(event.target??"");
  this.pending=this.pending.then(async()=>{
   const note=this.app.vault.getAbstractFileByPath(event.path??"");
   if(!(note instanceof TFile)||note.extension!=="md")throw Error("The target note no longer exists. Drop the email onto an open note.");
   const files=await nativeMailFiles(event);
   const saved=await this.importFiles(files,note,view,when);
   if(event.errors?.length)new Notice(event.errors.join(" "),10000);
   // Keep received originals recoverable whenever any import step fails.
   if(saved&&!event.errors?.length&&event.directory)await rm(event.directory,{recursive:true,force:true});
  }).catch(error=>{
   console.error("Outlook native import:",error);
   new Notice(error instanceof Error?error.message:String(error),10000);
  });
 }

 private async findSame(folder:string,original:string,bytes:ArrayBuffer):Promise<string|undefined> {
  const parent=folder?this.app.vault.getAbstractFileByPath(folder):this.app.vault.getRoot();
  if(!(parent instanceof TFolder))return;
  for(const file of parent.children) {
   if(!(file instanceof TFile)||file.stat.size!==bytes.byteLength||!sameImportName(original,file.name))continue;
   try{if(sameBytes(await this.app.vault.readBinary(file),bytes))return file.path;}catch{/* Keep unreadable originals untouched. */}
  }
  return undefined;
 }

 private async importFiles(files:MailFile[],note:TFile,view:MarkdownView|undefined,when:Date):Promise<boolean> {
  // Bind to the drop's file, even if the user changes panes during async reads.
  if(this.app.vault.getAbstractFileByPath(note.path)!==note) throw Error("The target note was moved or deleted. Drop the email onto the note again.");
  if(view?.file===note) await view.save();
  const folder=note.parent?.path==="/"?"":note.parent?.path??"";
  const result=await importAttachments(files,folder,{
   findSame:(original,bytes)=>this.findSame(folder,original,bytes),
   exists:path=>!!this.app.vault.getAbstractFileByPath(path),
   read:async path=>{
    const file=this.app.vault.getAbstractFileByPath(path);
    if(!(file instanceof TFile)) throw Error("File not found");
    return this.app.vault.readBinary(file);
   },
   create:async(path,bytes)=>{await this.app.vault.createBinary(path,bytes);},
   append:async update=>{await this.app.vault.process(note,update);},
   link:path=>{
    const file=this.app.vault.getAbstractFileByPath(path);
    if(!(file instanceof TFile)) throw Error("Email file not found");
    return `[[${this.app.metadataCache.fileToLinktext(file,note.path,false)}]]`;
   }
  },when,{nameMode:this.settings.nameMode,preview:this.settings.mailPreview,extract:this.settings.extractAttachments,author:this.settings.logAuthor});
  if(result.previewFailures.length)new Notice("Email saved, but its text could not be read. Open the original file.",10000);
  if(result.extractionFailures.length) {
   console.error("Email attachments:",result.extractionFailures);
   new Notice(`Email saved; ${result.extractionFailures.length} attachment(s) could not be saved separately. Drag the email again to retry.`,10000);
  }
  if(result.failures.length) {
   console.error("Mail Drop: import failed",result.failures);
   new Notice(`${result.added} added; ${result.failures.length} failed: ${result.failures.map(f=>f.name).join(", ")}. Drag these emails again.`,10000);
  } else if(!result.extractionFailures.length&&!result.previewFailures.length)new Notice(result.added?`${result.added===1?"Email added":`${result.added} emails added`}`:result.enriched?"Email content added.":"This email is already linked to this note.");
  return result.failures.length===0&&result.extractionFailures.length===0;
 }
}

class DropSettingsTab extends PluginSettingTab {
 private receiverStatusEl?:HTMLElement;
 updateReceiverStatus():void{if(this.receiverStatusEl)this.receiverStatusEl.textContent=this.plugin.receiverStatus;}
 constructor(private plugin:OutlookDropImporter){super(plugin.app,plugin);}
 display():void {this.renderControls();}
 private renderControls():void {
  this.containerEl.empty();
  this.receiverStatusEl=undefined;
  for(const definition of this.definitions()) {
   definition.render(new Setting(this.containerEl).setName(definition.name));
  }
 }
 getSettingDefinitions():SettingDefinitionItem[] {return this.definitions();}
 private definitions():{name:string;render:(setting:Setting)=>void}[] {
  const definitions:{name:string;render:(setting:Setting)=>void}[]=[];
  const add=(name:string,render:(setting:Setting)=>unknown):void=>{definitions.push({name,render:setting=>{render(setting);}});};
  add("Attachment drops", setting=>setting
   .addDropdown(dropdown=>dropdown
    .addOption("images-only","Embed images only")
    .addOption("custom","Choose by file type")
    .addOption("obsidian","Obsidian default")
    .setValue(this.plugin.settings.dropMode)
    .onChange(async value=>{this.plugin.settings.dropMode=value as DropMode;await this.plugin.saveData(this.plugin.settings);this.renderControls();})));
  add("File names", setting=>setting
   .setDesc("For new attachments. Adds today’s date if the name has no full date.")
   .addDropdown(dropdown=>dropdown.addOption("date-kebab","Date + kebab-case").addOption("kebab","Kebab-case only").addOption("original","Original name")
    .setValue(this.plugin.settings.nameMode).onChange(async value=>{this.plugin.settings.nameMode=value as NameMode;await this.plugin.saveData(this.plugin.settings);})));
  add("Email preview", setting=>setting.setDesc("Show email text below its link, collapsed by default.")
   .addToggle(toggle=>toggle.setValue(this.plugin.settings.mailPreview).onChange(async value=>{this.plugin.settings.mailPreview=value;await this.plugin.saveData(this.plugin.settings);})));
  add("Extract email attachments", setting=>setting.setDesc("Save beside the email and link in the note. Inline images stay in the email.")
   .addToggle(toggle=>toggle.setValue(this.plugin.settings.extractAttachments).onChange(async value=>{this.plugin.settings.extractAttachments=value;await this.plugin.saveData(this.plugin.settings);})));
  add("Added by", setting=>setting.setDesc("Optional name shown in new email entries.")
   .addText(text=>text.setValue(this.plugin.settings.logAuthor).onChange(async value=>{this.plugin.settings.logAuthor=value;await this.plugin.saveData(this.plugin.settings);})));
  if(Platform.isMacOS){
   add("Native email dragging", setting=>setting
    .setDesc("Use a separately installed macOS receiver.")
    .addToggle(toggle=>toggle.setValue(this.plugin.settings.nativeEnabled).onChange(async value=>{this.plugin.settings.nativeEnabled=value;await this.plugin.saveData(this.plugin.settings);await this.plugin.configureReceiver();this.renderControls();})));
   if(this.plugin.settings.nativeEnabled){add("Receiver path", setting=>{this.receiverStatusEl=setting.descEl;return setting
    .setDesc(this.plugin.receiverStatus)
    .addText(text=>text.setPlaceholder("/path/to/outlook-file-promises").setValue(this.plugin.settings.receiverPath).onChange(async value=>{this.plugin.settings.receiverPath=value;await this.plugin.saveData(this.plugin.settings);}))
    .addButton(button=>button.setButtonText("Connect").onClick(async()=>{await this.plugin.configureReceiver();this.renderControls();}));});
   }
   add("Receiver installation", setting=>setting
    .addButton(button=>button.setButtonText("Open guide").onClick(()=>window.open("https://github.com/viggomeesters/obsidian-mail-drop/blob/main/docs/native-receiver.md"))));
  }
  if(this.plugin.settings.dropMode==="custom")add("File types to link", setting=>setting
   .setDesc("Comma-separated file extensions.")
   .addText(text=>text.setPlaceholder("PDF, PNG, JPG").setValue(this.plugin.settings.linkExtensions).onChange(async value=>{
    this.plugin.settings.linkExtensions=value;await this.plugin.saveData(this.plugin.settings);
   })));
  return definitions;
 }
}
