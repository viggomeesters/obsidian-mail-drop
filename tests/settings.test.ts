import {describe,it,expect} from 'vitest';
import {readSettings} from '../src/settings';
describe('saved settings and native opt-in',()=>{
 it('keeps native reception off for a new three-file installation',()=>{expect(readSettings(undefined).nativeEnabled).toBe(false);expect(readSettings({}).nativeEnabled).toBe(false);});
 it('preserves legacy mail settings without inventing an author or executable path',()=>{const s=readSettings({dropMode:'images-only',nameMode:'date-kebab',logAuthor:'Alex'});expect(s.nativeEnabled).toBe(true);expect(s.logAuthor).toBe('Alex');expect(s.receiverPath).toBe('');});
 it('preserves explicit opt-out and refuses malformed settings',()=>{expect(readSettings({nativeEnabled:false}).nativeEnabled).toBe(false);expect(readSettings(['bad'])).toEqual(readSettings(undefined));expect(readSettings({nativeEnabled:'yes',receiverPath:42}).receiverPath).toBe('');});
});
