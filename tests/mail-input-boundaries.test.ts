import {describe,it,expect} from 'vitest';
import {mailPreview,parseMail} from '../src/mail-preview';
import {importAttachments} from '../src/attachments';
const bytes=(s:string)=>new TextEncoder().encode(s).buffer;
describe('synthetic message size and malformed input',()=>{
 it('preserves a large body rather than silently truncating it',async()=>{
  const body='Large synthetic line.\r\n'.repeat(50000)+'UNIQUE-END-MARKER';
  const preview=await mailPreview(bytes('From: fixture@example.invalid\r\nSubject: Large\r\n\r\n'+body));
  expect(preview).toContain('UNIQUE-END-MARKER');expect(preview.length).toBeGreaterThan(1_000_000);
 });
 it('handles malformed bytes as inert data and keeps the parser output independent of HTML execution',async()=>{
  const parsed=await parseMail(bytes('Malformed body <script>throw Error("never run")</script>'));
  expect(parsed.attachments).toEqual([]);expect(await mailPreview(bytes('Subject: Synthetic\r\n\r\n![[injection]]'))).not.toContain('![[injection]]');
 });
 it('refuses an empty source before writing any original or note',async()=>{
  let writes=0;const store={exists:()=>false,read:async()=>bytes(''),create:async()=>{writes++;},append:async()=>{writes++;},link:()=>''};
  const result=await importAttachments([{name:'empty.eml',arrayBuffer:async()=>bytes('')}],'',store);
  expect(result.failures).toHaveLength(1);expect(writes).toBe(0);
 });
});
