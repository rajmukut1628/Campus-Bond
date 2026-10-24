import {describe,it,expect} from 'vitest';
import {fieldErrors} from '../../frontend/src/lib/formErrors.js';
import {listKey,readListPosition,saveListPosition} from '../../frontend/src/lib/listNavigation.js';
describe('list return state',()=>{
 it('separates account, role and history entry',()=>{
 const user={_id:'one',role:'student'}, location={key:'entry'};
 const key=listKey(user,location,'jobs');
 expect(listKey({...user,_id:'two'},location,'jobs')).not.toBe(key);
 expect(listKey({...user,role:'alumni'},location,'jobs')).not.toBe(key);
 expect(listKey(user,{key:'other'},'jobs')).not.toBe(key);
 });
 it('restores filters, page and scroll without sharing another key',()=>{
 const storage={getItem(k){return this[k]??null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}};
 const value={values:{q:'engineer',page:2,mine:true},scroll:320,inner:80};
 saveListPosition('one',value,storage);
 expect(readListPosition('one',storage)).toEqual(value);
 expect(readListPosition('two',storage)).toBeNull();
 });
 it('tolerates unavailable or malformed storage',()=>{
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 expect(readListPosition('one',blocked)).toBeNull();
 expect(()=>saveListPosition('one',{},blocked)).not.toThrow();
 expect(readListPosition('one',{getItem:()=>'{bad'})).toBeNull();
 });
});
describe('inline form errors',()=>{
 it('maps only rendered fields and preserves the first useful error',()=>{
 const error={response:{data:{errors:[{field:'email',message:'Invalid email'},{field:'email',message:'Other'},{field:'secret',message:'Hidden'},{field:'name',message:'Invalid value'}]}}};
 expect(fieldErrors(error,[{name:'email'},{name:'name'}])).toEqual({email:'Invalid email',name:'Please check this value.'});
 });
 it('handles a general request failure without inventing field errors',()=>{expect(fieldErrors(Error('offline'),[{name:'email'}])).toEqual({});});
});
