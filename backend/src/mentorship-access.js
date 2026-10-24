import { Message } from './models.js';
export async function mentorHasStarted(relation, session) {
  if (relation.mentorStartedAt) return true;
  return !!(await Message.exists({ mentorship: relation._id, sender: relation.mentor }).session(session || null));
}
export async function relationshipSummary(relation, session) {
  if (!relation) return null;
  return { _id: relation._id, status: relation.status, closedForConversion: relation.closedForConversion, mentorStarted: await mentorHasStarted(relation, session) };
}
