import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,mkdir,chmod,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installedReceiver} from '../src/receiver';
describe('externally installed native receiver',()=>{
 it('does not install, modify or accept missing, relative or nonexecutable paths',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'receiver-test-'));const file=join(folder,'receiver');
  try{await writeFile(file,'fixture');expect(await installedReceiver('',join(folder,'missing'))).toBeNull();expect(await installedReceiver('relative',file)).toBeNull();expect(await installedReceiver(file,'')).toBeNull();await chmod(file,0o755);expect(await installedReceiver(file,'')).toBe(file);expect(await installedReceiver('',file)).toBe(file);await mkdir(join(folder,'directory'));expect(await installedReceiver(join(folder,'directory'),file)).toBeNull();expect(await readFile(file,'utf8')).toBe('fixture');}finally{await rm(folder,{recursive:true});}
 });
});
