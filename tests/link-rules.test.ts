import {describe,it,expect} from 'vitest';
import {delegateAttachmentLink} from '../src/link-rules';
import {readSettings} from '../src/settings';
describe('attachment rule delegation',()=>{
 it('preserves the opt-in cooperation setting',()=>expect(readSettings({dropMode:'link-rules'}).dropMode).toBe('link-rules'));
 it('uses the synchronous response and keeps native syntax if no formatter is available',()=>{
  const doc={defaultView:{CustomEvent:class{constructor(_name:string,options:{detail:unknown}){Object.assign(this,{detail:options.detail});}}},dispatchEvent:(event:{detail:{link:string;handled:boolean}})=>{event.detail.link='[[report.pdf]]';event.detail.handled=true;return true;}};
  expect(delegateAttachmentLink(doc as unknown as Document,'report.pdf','![[report.pdf]]')).toEqual({link:'[[report.pdf]]',handled:true});
  doc.dispatchEvent=()=>true;
  expect(delegateAttachmentLink(doc as unknown as Document,'report.pdf','![[report.pdf]]')).toEqual({link:'![[report.pdf]]',handled:false});
 });
});
