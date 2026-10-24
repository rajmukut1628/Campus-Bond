import { Router } from "express";
import { body, param } from "express-validator";
import mongoose from "mongoose";
import { User, Mentorship, DirectConversation, DirectMessage, MessageAttachment } from "./models.js";
import { assert, roles, validate, list, notify } from "./security.js";
const participant = { active: true, status: "active", role: { $in: ["student", "alumni"] } };
const adminParticipant = { active: true, status: "active", role: { $in: ["admin", "superadmin"] } };
const isAdministrator = user => ["admin", "superadmin"].includes(user.role);
const between = members => ({ $or: [{ student: members[0], mentor: members[1] }, { student: members[1], mentor: members[0] }] });
async function closed(members, session) {
  return !!await Mentorship.exists({ $and: [between(members), { $or: [{ status: "completed" }, { closedForConversion: true }] }] }).session(session || null);
}
export async function directAccess(user, conversation, session, write = false) {
  assert(conversation.members.some(id => String(id) === String(user._id)), 403, "This is a private conversation");
  const staff = conversation.audience === "admins";
  assert(staff === isAdministrator(user), 403, "This conversation belongs to a different account group");
  const allowed = staff ? adminParticipant : participant;
  const people = await User.find({ _id: { $in: conversation.members }, ...allowed }).session(session || null);
  assert(people.length === 2, 403, "Both participants must have active member accounts");
  const blocked = !staff && await closed(conversation.members, session);
  if (write) {
    assert(!blocked, 403, "Completed mentorship conversations cannot be reopened through direct messaging");
    // Serialize with account restrictions and mentorship completion transactions.
    for (const person of people) await User.updateOne({ _id: person._id, ...allowed }, { $inc: { directMessageVersion: 1 } }, { session });
    if (!staff) await Mentorship.updateMany(between(conversation.members), { $inc: { accessVersion: 1 } }, { session });
    await DirectConversation.updateOne({ _id: conversation._id }, { $inc: { accessVersion: 1 } }, { session });
  }
  return { counterpart: people.find(person => String(person._id) !== String(user._id)), canSend: !blocked };
}
export async function directProfileState(user, target) {
  if (!["student", "alumni"].includes(user.role) || target.role !== "alumni" || String(user._id) === String(target._id)) return null;
  const members = [String(user._id), String(target._id)].sort();
  const [conversation, blocked] = await Promise.all([DirectConversation.findOne({ pairKey: members.join(":") }).select("_id").lean(), closed(members)]);
  return { conversationId: conversation?._id || null, blocked, canStart: !blocked && target.contactPreference === "open" };
}
export async function directConversationItems(user) {
  const staff = isAdministrator(user);
  const rows = await DirectConversation.find({ members: user._id, audience: staff ? "admins" : { $ne: "admins" } }).sort({ updatedAt: -1 }).populate("members", "name role avatar active status").lean();
  const eligible = rows.filter(row => row.members.length === 2 && row.members.every(person => person.active && person.status === "active" && (staff ? ["admin", "superadmin"] : ["student", "alumni"]).includes(person.role)));
  const latest = eligible.length ? await DirectMessage.aggregate([{ $match: { conversation: { $in: eligible.map(row => row._id) } } }, { $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: "$conversation", body: { $first: "$body" }, deletedAt: { $first: "$deletedAt" }, attachment: { $first: "$attachment" }, attachments: { $first: "$attachments" }, sentAt: { $first: "$createdAt" } } }]) : [];
  return eligible.map(row => ({ ...row, type: "direct", counterpart: row.members.find(person => String(person._id) !== String(user._id)), title: staff ? "Administrator conversation" : "Direct conversation", lastMessage: latest.find(message => String(message._id) === String(row._id)) }));
}
export function directMessagingRoutes() {
  const r = Router();
  r.post("/admin/conversations", roles("admin", "superadmin"), body("recipient").isMongoId().bail().customSanitizer(value => new mongoose.Types.ObjectId(value).toString()), validate, async (req, res) => {
    assert(String(req.user._id) !== req.body.recipient, 422, "You cannot message yourself");
    let item;
    await mongoose.connection.transaction(async session => {
      const members = [String(req.user._id), req.body.recipient].sort(), pairKey = "admin:" + members.join(":");
      const target = await User.findOne({ _id: req.body.recipient, ...adminParticipant }).session(session);
      assert(target, 403, "Only active Administrators can be contacted here");
      await User.updateOne({ _id: target._id, ...adminParticipant }, { $inc: { directMessageVersion: 1 } }, { session });
      item = await DirectConversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { pairKey, audience: "admins", members, openedBy: req.user._id } }, { upsert: true, new: true, runValidators: true, session });
      await directAccess(req.user, item, session);
    });
    res.json({ item: { _id: item._id } });
  });
  r.post("/direct-conversations", roles("student", "alumni"), body("recipient").isMongoId().bail().customSanitizer(value => new mongoose.Types.ObjectId(value).toString()), validate, async (req, res) => {
    assert(String(req.user._id) !== req.body.recipient, 422, "You cannot message yourself");
    let item;
    await mongoose.connection.transaction(async session => {
      const members = [String(req.user._id), req.body.recipient].sort(), pairKey = members.join(":");
      item = await DirectConversation.findOne({ pairKey }).session(session);
      assert(!await closed(members, session), 403, "Completed mentorship messaging is closed");
      if (item) { await directAccess(req.user, item, session); return; }
      // Existing accepted mentorships continue to use their original messaging permissions.
      const accepted = await Mentorship.findOne({ ...between(members), status: "accepted", closedForConversion: { $ne: true } }).session(session);
      if (accepted) { item = { _id: accepted._id }; return; }
      const target = await User.findOne({ _id: req.body.recipient, ...participant, role: "alumni", contactPreference: "open" }).session(session);
      assert(target, 403, "This Alumni requires a mentorship request before messaging");
      const lock = await User.updateOne({ _id: target._id, ...participant, contactPreference: "open" }, { $inc: { directMessageVersion: 1 } }, { session });
      assert(lock.matchedCount === 1, 409, "Contact preference changed. Refresh the profile");
      item = await DirectConversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { pairKey, members, openedBy: req.user._id } }, { upsert: true, new: true, runValidators: true, session });
    });
    res.json({ item: { _id: item._id } });
  });
  r.use("/conversations/:id/messages", roles("student", "alumni", "admin", "superadmin"), param("id").isMongoId(), validate, async (req, res, next) => {
    const conversation = await DirectConversation.findById(req.params.id);
    if (!conversation) return next();
    const { counterpart, canSend } = await directAccess(req.user, conversation);
    req.directConversation = conversation; req.directCounterpart = counterpart; req.directCanSend = canSend;
    next();
  });
  r.get("/conversations/:id/messages", async (req, res, next) => {
    if (!req.directConversation) return next();
    res.json({ ...await list(DirectMessage, { conversation: req.params.id }, req, { path: "sender", select: "name avatar" }), canSend: req.directCanSend, waitingForMentor: false,
      counterpart: { _id: req.directCounterpart._id, name: req.directCounterpart.name, avatar: req.directCounterpart.avatar, role: req.directCounterpart.role },
      relationship: { _id: req.params.id, type: "direct", audience: req.directConversation.audience || "members", title: req.directConversation.audience === "admins" ? "Administrator conversation" : "Direct conversation", status: req.directCanSend ? "active" : "completed" } });
  });
  r.post("/conversations/:id/messages", body("body").isString().trim().isLength({ min: 1, max: 4000 }), validate, async (req, res, next) => {
    if (!req.directConversation) return next();
    let message;
    await mongoose.connection.transaction(async session => {
      const conversation = await DirectConversation.findById(req.params.id).session(session);
      const { counterpart } = await directAccess(req.user, conversation, session, true);
      [message] = await DirectMessage.create([{ conversation: conversation._id, sender: req.user._id, body: req.body.body }], { session });
      await notify(counterpart._id, `New message from ${req.user.name}`, `/app/messages/${conversation._id}`, session, { actor: req.user._id, category: "messages" });
    });
    res.status(201).json({ item: message });
  });
  r.delete("/conversations/:id/messages/:messageId", param("messageId").isMongoId(), validate, async (req, res, next) => {
    if (!req.directConversation) return next();
    await mongoose.connection.transaction(async session => {
      const conversation = await DirectConversation.findById(req.params.id).session(session);
      await directAccess(req.user, conversation, session, true);
      const message = await DirectMessage.findOneAndUpdate({ _id: req.params.messageId, conversation: conversation._id, sender: req.user._id, deletedAt: { $exists: false } }, { $set: { body: "[Message deleted]", deletedAt: new Date() }, $unset: { attachment: 1, attachments: 1 } }, { new: true, session });
      assert(message, 403, "Only your own undeleted messages can be removed");
      await MessageAttachment.deleteMany({ message: message._id }, { session });
    });
    res.json({ message: "Message deleted" });
  });
  return r;
}
