const visible = item => !['hidden', 'archived', 'deleted'].includes(item?.visibility);
export function eventAvailability(item, now = Date.now()) {
  if (!item) return {open:false,label:'Registration closed'};
  if (item.status === 'cancelled') return {open:false,label:'Event cancelled'};
  if (item.mode === 'recap') return {open:false,label:'Past event / Recap'};
  if (!visible(item) || item.status !== 'published' || !(new Date(item.startsAt).getTime() > now)
    || (item.registrationDeadline && !(new Date(item.registrationDeadline).getTime() > now)))
    return {open:false,label:'Registration closed'};
  if (!(Number(item.capacity) > Number(item.participants || 0))) return {open:false,label:'Event full'};
  return {open:true,label:'Registration open'};
}
export function jobApplicationsOpen(item, now = Date.now()) {
  return Boolean(item && visible(item) && item.status === 'open' && new Date(item.closesAt).getTime() > now);
}
