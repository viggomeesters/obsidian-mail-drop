import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NativeBridge, NativeEvent, nativeMailFiles } from "../src/native";
const delay=(n:number)=>new Promise(resolve=>setTimeout(resolve,n));
async function dropFolder() {
 const path=join(await realpath(tmpdir()),"obsidian-outlook-"+randomUUID());await mkdir(path);return path;
}
describe("native file-promise-overdracht",()=>{
 it("leest exacte EML-bytes uit de eigen ontvangermap",async()=>{
  const folder=await dropFolder();const path=join(folder,"mail.eml"),raw=Buffer.from([0,255,13,10,42]);
  try {await writeFile(path,raw);const files=await nativeMailFiles({event:"drop",directory:folder,files:[path]});expect(files[0].name).toBe("mail.eml");expect(Buffer.from(await files[0].arrayBuffer())).toEqual(raw);expect(await readFile(path)).toEqual(raw);}
  finally{await rm(folder,{recursive:true,force:true});}
 });
 it("weigert bestanden outside the receiving folder",async()=>{
  const folder=await dropFolder(),outside=await dropFolder();const path=join(outside,"mail.eml");
  try{await writeFile(path,"mail");await expect(nativeMailFiles({event:"drop",directory:folder,files:[path]})).rejects.toThrow("outside the receiving folder");}
  finally{await rm(folder,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
 });
 it("weigert een symlink en een niet-EML zonder de bron te verwijderen",async()=>{
  const folder=await dropFolder();const path=join(folder,"bericht.msg");
  try{
   await writeFile(path,"mail");await expect(nativeMailFiles({event:"drop",directory:folder,files:[path]})).rejects.toThrow("instead of an .eml");
   const eml=join(folder,"mail.eml");await writeFile(eml,"mail");const link=join(folder,"link.eml");await symlink(eml,link);
   await expect(nativeMailFiles({event:"drop",directory:folder,files:[link]})).rejects.toThrow("outside the receiving folder");expect(await readFile(path,"utf8")).toBe("mail");
  }finally{await rm(folder,{recursive:true,force:true});}
 });
 it("maakt een native ontvangfout concreet",async()=>{
  await expect(nativeMailFiles({event:"drop",files:[],errors:["Outlook leverde niets aan"]})).rejects.toThrow("Outlook leverde niets aan");
 });
 it("verwerkt gebroken stdoutchunks, deelt doelwijzigingen en stopt zonder weesproces",async()=>{
  const folder=await mkdtemp(join(tmpdir(),"native-bridge-test-"));const script=join(folder,"receiver");
  const events:NativeEvent[]=[],errors:Error[]=[];
  await writeFile(script,`#!/usr/bin/env node
process.stdout.write('{"event":"ready"');
setTimeout(()=>{
 process.stdout.write('}\\n');
 let buffer="";
 process.stdin.on("data",data=>{
  buffer+=data;let at;
  while((at=buffer.indexOf("\\n"))>=0){
   const input=JSON.parse(buffer.slice(0,at));buffer=buffer.slice(at+1);
   process.stdout.write(JSON.stringify({event:"target",path:input.targets[0]?.path})+"\\n");
  }
 });
 process.stdin.on("end",()=>process.exit(0));
},10);
`);await chmod(script,0o755);
  const bridge=new NativeBridge(script,event=>events.push(event),error=>errors.push(error));
  try{
   const targets=[{id:"one",path:"map/note.md",x:30,y:40,width:800,height:900}];bridge.updateTargets(targets);bridge.updateTargets(targets);
   for(let i=0;i<40&&events.length<2;i++)await delay(20);
   expect(events.some(event=>event.event==="ready")).toBe(true);expect(events.filter(event=>event.event==="target")).toHaveLength(1);expect(events.find(event=>event.event==="target")?.path).toBe("map/note.md");
   bridge.stop();await delay(80);expect(errors).toHaveLength(0);expect((bridge as unknown as {child:{exitCode:number|null}}).child.exitCode).toBe(0);
  }finally{bridge.stop();await rm(folder,{recursive:true,force:true});}
 });
});
