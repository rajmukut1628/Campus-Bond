import {describe,it,expect} from 'vitest';
import {canContribute,canReviewContribution,campaignEnded} from '../../frontend/src/lib/givingAccess.js';
const now=Date.parse('2026-10-24T10:00:00Z');
const campaign={owner:{_id:'owner'},status:'open',visibility:'published',mode:'fundraising',deadline:new Date(now+1000).toISOString()};
describe('Give Back actions',()=>{
 it.each(['admin','superadmin'])('does not offer %s a payment form',role=>{expect(canContribute({_id:'donor',role},campaign,now)).toBe(false);});
 it.each(['student','alumni'])('allows an eligible %s to contribute',role=>{expect(canContribute({_id:'donor',role},campaign,now)).toBe(true);});
 it('closes exactly at the deadline and handles campaigns without deadlines',()=>{
 expect(canContribute({_id:'donor',role:'student'},campaign,now+1000)).toBe(false);
 expect(campaignEnded(campaign,now+1000)).toBe(true);
 expect(canContribute({_id:'donor',role:'student'},{...campaign,deadline:null},now)).toBe(true);
 });
 it('excludes owners, information posts, closed and moderated campaigns',()=>{
 const donor={_id:'donor',role:'alumni'};
 expect(canContribute({_id:'owner',role:'alumni'},campaign,now)).toBe(false);
 for(const update of [{mode:'information'},{status:'closed'},{visibility:'hidden'},{visibility:'archived'},{visibility:'deleted'}])expect(canContribute(donor,{...campaign,...update},now)).toBe(false);
 });
 it('prevents self-review in both populated and raw contribution records',()=>{
 const user={_id:'reviewer',role:'superadmin'};
 for(const donor of ['reviewer',{_id:'reviewer'}])expect(canReviewContribution(user,{user:donor,status:'pending'})).toBe(false);
 expect(canReviewContribution(user,{user:{_id:'other'},status:'pending'})).toBe(true);
 });
 it('limits alumni reviews to their own campaign and excludes unverified or reviewed records',()=>{
 const user={_id:'owner',role:'alumni'}, contribution={user:'donor',status:'pending'};
 expect(canReviewContribution(user,contribution,campaign)).toBe(true);
 expect(canReviewContribution(user,contribution,{owner:'other'})).toBe(false);
 expect(canReviewContribution({_id:'owner',role:'student'},contribution,campaign)).toBe(false);
 for(const update of [{status:'approved'},{status:'rejected'},{paymentStatus:'failed'},{paymentStatus:'awaiting_gateway'}])expect(canReviewContribution(user,{...contribution,...update},campaign)).toBe(false);
 });
});
