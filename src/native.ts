import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { setTimeout as setNodeTimeout } from "node:timers";
import { basename, dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { lstat, readFile, realpath } from "node:fs/promises";
import type { MailFile } from "./attachments";

export interface NativeTarget {id:string;path:string;x:number;y:number;width:number;height:number}
export interface NativeEvent {
 event:string;source?:string;types?:string[];contentTypes?:string[];target?:string;path?:string;when?:string;files?:string[];errors?:string[];directory?:string;message?:string;
}
/** Owns exactly one child, with no launch agent, UI activation, or mailbox access. */
export class NativeBridge {
 private child: ChildProcessWithoutNullStreams;
 private stopped=false;
 private lastTargets="";
 constructor(executable:string,onEvent:(event:NativeEvent)=>void,onError:(error:Error)=>void) {
  this.child=spawn(executable,[],{stdio:["pipe","pipe","pipe"]});
  const lines=createInterface({input:this.child.stdout});
  lines.on("line",line=>{
   try {const event=JSON.parse(line) as NativeEvent;if(typeof event.event==="string")onEvent(event);}
   catch {onError(Error("The email receiver returned an unreadable response."));}
  });
  let detail="";
  this.child.stderr.on("data",data=>{detail=(detail+String(data)).slice(-2000);});
  this.child.on("error",error=>{if(!this.stopped)onError(error);});
  this.child.stdin.on("error",error=>{if(!this.stopped)onError(error);});
  this.child.on("exit",code=>{if(!this.stopped)onError(Error(`The email receiver stopped (${code}). ${detail}`));lines.close();});
 }
 updateTargets(targets:NativeTarget[]):void {
  if(this.stopped||this.child.stdin.destroyed) return;
  const data=JSON.stringify({targets});
  if(data!==this.lastTargets){this.lastTargets=data;this.child.stdin.write(data+"\n");}
 }
 stop():void {
  if(this.stopped)return;this.stopped=true;
  this.child.stdin.end();
  const child=this.child;
  const timer=setNodeTimeout(()=>{if(child.exitCode===null&&!child.killed)child.kill("SIGTERM");},1000);
  timer.unref();
 }
}
/** Read only files delivered into this receiver's private temporary drop directory. */
export async function nativeMailFiles(event:NativeEvent):Promise<MailFile[]> {
 if(!event.directory||!Array.isArray(event.files)||!event.files.length)throw Error(event.errors?.join(" ")||"The mail app did not provide an email. Try dragging it again.");
 const root=await realpath(tmpdir());
 const folder=await realpath(event.directory);
 if(dirname(folder)!==root||!/^obsidian-outlook-[A-Fa-f0-9-]+$/.test(basename(folder)))throw Error("Invalid temporary email folder.");
 const files:MailFile[]=[];
 for(const name of event.files) {
  const path=await realpath(name);
  if(!path.startsWith(folder+sep)||(await lstat(name)).isSymbolicLink())throw Error("The mail app provided a file outside the receiving folder.");
  if(!/\.eml$/i.test(path))throw Error(`The mail app provided ${basename(path)} instead of an .eml email.`);
  files.push({name:basename(path),arrayBuffer:async()=>Uint8Array.from(await readFile(path)).buffer});
 }
 return files;
}
export function helperPath(vaultRoot:string,pluginDirectory:string):string {
 return resolve(join(vaultRoot,pluginDirectory,"outlook-file-promises"));
}
