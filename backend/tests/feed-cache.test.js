import {describe,it,expect} from 'vitest';
import {feedSnapshot,invalidateFeed,feedStreamKey} from '../../frontend/src/lib/feedCacheState.js';
const path=(mode='for-you',page=1,cutoff='old',visibility='hidden')=>`/feed?mode=${mode}&page=${page}&cutoff=${cutoff}&visibility=${visibility}`;
const snapshot={items:[{_id:'one',body:'Retained post'}],total:1,pages:1};
const bucket=()=>({entries:new Map([[path(),{data:snapshot,time:100}],[path('favorites'),{data:{items:[]},time:100}]]),controllers:new Set(),generation:0});
describe('feed refresh retention',()=>{
 it('retains visible posts during a normal reload while invalidating other cached tabs',()=>{
 const b=bucket(),controller=new AbortController();b.controllers.add(controller);
 invalidateFeed(b,path(),snapshot);
 expect(feedSnapshot(b,path())).toEqual(snapshot);
 expect(feedSnapshot(b,path('favorites'))).toBeNull();
 expect(controller.signal.aborted).toBe(true);expect(b.generation).toBe(1);
 });
 it('keeps posts during an explicit refresh with a new cutoff and page one',()=>{
 const b=bucket();invalidateFeed(b,path('for-you',2),snapshot,true);
 expect(feedSnapshot(b,path('for-you',1,'new'))).toEqual(snapshot);
 });
 it('does not display retained posts under another tab, sort or moderation visibility',()=>{
 const b=bucket();invalidateFeed(b,path(),snapshot,true);
 for(const target of [path('favorites'),path('viewed'),path('latest'),path('moderation'),path('for-you',1,'new','archived')])expect(feedSnapshot(b,target)).toBeNull();
 });
 it('keeps snapshots private to the mounted account bucket',()=>{
 const a=bucket();invalidateFeed(a,path(),snapshot,true);
 const other={entries:new Map(),controllers:new Set(),generation:0};
 expect(feedSnapshot(other,path('for-you',1,'new'))).toBeNull();
 });
 it('does not reuse a previous page on ordinary pagination',()=>{
 const b=bucket();invalidateFeed(b,path(),snapshot);
 expect(feedSnapshot(b,path('for-you',2))).toBeNull();
 });
 it('prefers fresh results and safely handles a feed that has not loaded',()=>{
 const b=bucket();invalidateFeed(b,path(),snapshot,true);
 const fresh={items:[],total:0};b.entries.set(path('for-you',1,'new'),{data:fresh});
 expect(feedSnapshot(b,path('for-you',1,'new'))).toBe(fresh);
 expect(feedSnapshot(b,null)).toBeNull();expect(feedStreamKey(null)).toBeNull();
 });
});
