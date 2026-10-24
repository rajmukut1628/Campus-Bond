const id = value => String(value?._id || value || '');
const administrator = user => ['admin', 'superadmin'].includes(user?.role);
export function campaignEnded(item, now = Date.now()) {
  return item?.status === 'closed' || Boolean(item?.deadline && new Date(item.deadline).getTime() <= now);
}
export function canContribute(user, item, now = Date.now()) {
  return Boolean(user && item && ['student', 'alumni'].includes(user.role)
    && item.mode !== 'information' && item.status === 'open'
    && !['hidden', 'archived', 'deleted'].includes(item.visibility)
    && !campaignEnded(item, now) && id(item.owner) !== id(user));
}
export function canReviewContribution(user, contribution, campaign) {
  return Boolean(user && contribution && contribution.status === 'pending'
    && !['awaiting_gateway', 'failed'].includes(contribution.paymentStatus)
    && id(contribution.user) !== id(user)
    && (administrator(user) || (user.role === 'alumni' && campaign && id(campaign.owner) === id(user))));
}
