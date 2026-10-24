import {describe,it,expect} from 'vitest';
import {eventAvailability,jobApplicationsOpen} from '../../frontend/src/lib/resourceAvailability.js';
const now=Date.parse('2026-10-24T10:00:00Z');
const event={status:'published',mode:'booking',visibility:'published',startsAt:new Date(now+2000).toISOString(),registrationDeadline:new Date(now+1000).toISOString(),capacity:2,participants:1};
describe('event registration availability',()=>{
 it('offers remaining places before both deadlines',()=>{expect(eventAvailability(event,now).open).toBe(true);});
 it.each(['cancelled','started','deadline','full','recap','hidden','archived','deleted'])('closes the %s state',state=>{
 const updates={cancelled:{status:'cancelled'},started:{startsAt:new Date(now).toISOString()},deadline:{registrationDeadline:new Date(now).toISOString()},full:{participants:2},recap:{mode:'recap'},hidden:{visibility:'hidden'},archived:{visibility:'archived'},deleted:{visibility:'deleted'}};
 expect(eventAvailability({...event,...updates[state]},now).open).toBe(false);
 });
 it('uses accurate messages and frees cancelled seats',()=>{
 expect(eventAvailability({...event,status:'cancelled'},now).label).toBe('Event cancelled');
 expect(eventAvailability({...event,participants:2},now).label).toBe('Event full');
 expect(eventAvailability({...event,participants:1},now).open).toBe(true);
 expect(eventAvailability(event,now+1000).label).toBe('Registration closed');
 });
 it('supports no optional deadline but rejects missing start dates',()=>{
 expect(eventAvailability({...event,registrationDeadline:null},now).open).toBe(true);
 expect(eventAvailability({...event,startsAt:null},now).open).toBe(false);
 });
});
describe('career application availability',()=>{
 const job={status:'open',visibility:'published',closesAt:new Date(now+1000).toISOString()};
 it('closes at the exact deadline, including direct detail views',()=>{expect(jobApplicationsOpen(job,now)).toBe(true);expect(jobApplicationsOpen(job,now+1000)).toBe(false);});
 it('blocks closed, moderated and malformed listings',()=>{
 for(const update of [{status:'closed'},{visibility:'hidden'},{visibility:'archived'},{visibility:'deleted'},{closesAt:null},{closesAt:'invalid'}])expect(jobApplicationsOpen({...job,...update},now)).toBe(false);
 });
});
