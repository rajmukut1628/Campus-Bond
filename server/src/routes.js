import { mentorHasStarted, relationshipSummary } from "./mentorship-access.js";
import { feedRoutes } from "./feed.js";
import { published, resourceRoutes } from "./resources.js";
import { recoveryRoutes } from "./recovery.js";
import { profileRoutes } from "./profiles.js";
import { studentConversionRoutes } from "./lifecycle.js";
import { PHONE_PATTERN } from "./catalog.js";
import { managementRoutes } from "./management.js";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { body, param } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  User,
  VerifiedUser,
  Mentorship,
  Message,
  Post,
  Job,
  Event,
  Donation,
  Contribution,
  Notification,
} from "./models.js";
import {
  assert,
  validate,
  roles,
  isAdmin,
  auth,
  session,
  acceptedRelationship,
  notify,
  notifyAudience,
  list,
  publicFields,
  safeUrl,
} from "./security.js";
const id = () => [
  param("id").isMongoId().withMessage("Invalid record ID"),
  validate,
];
const str = (field, max, min = 1) =>
  body(field)
    .isString()
    .trim()
    .isLength({ min, max })
    .withMessage(`${field} must contain ${min}–${max} characters`);
const password = () =>
  body("password")
    .isString()
    .isLength({ min: 11, max: 72 })
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Use at least 11 characters and at most 72 UTF-8 bytes");
const fields = (data, names) =>
  Object.fromEntries(
    names.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]),
  );
const transaction = async (fn) => mongoose.connection.transaction(fn);
export function routes(config) {
  const r = express.Router();
  r.get("/csrf", (req, res) => res.json({ token: req.csrfToken }));
  const sensitive = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit || 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  r.post("/auth/register", (req, res) =>
    res.status(403).json({
      message:
        "Public activation is disabled. Ask an Administrator to create your account, then sign in.",
    }),
  );
  r.post(
    "/auth/login",
    sensitive,
    [str("identifier", 180), str("password", 72), validate],
    async (req, res) => {
      const identifier = req.body.identifier.toLowerCase();
      const user = await User.findOne({
        $or: [{ email: identifier }, { universityId: req.body.identifier }],
      }).select("+password");
      const valid = await bcrypt.compare(
        req.body.password,
        user?.password ||
          "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      );
      assert(
        user?.active &&
          !["suspended", "blocked", "deleted"].includes(user.status) &&
          valid,
        401,
        "Invalid credentials or inactive account",
      );
      req.user = user;
      session(res, user, config);
      res.json({ user });
    },
  );
  r.use(recoveryRoutes(config));
  r.use(auth(config));
  r.get("/auth/me", (req, res) => res.json({ user: req.user }));
  r.post("/auth/logout", async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    res.clearCookie("session", {
      httpOnly: true,
      secure: config.production,
      sameSite: "strict",
      path: "/",
    });
    res.json({ message: "Signed out of all sessions" });
  });
  r.put(
    "/auth/password",
    [str("currentPassword", 72), password(), validate],
    async (req, res) => {
      const user = await User.findById(req.user._id).select("+password");
      assert(
        await bcrypt.compare(req.body.currentPassword, user.password),
        400,
        "Current password is incorrect",
      );
      user.password = await bcrypt.hash(req.body.password, 12);
      user.tokenVersion++;
      await user.save();
      await notify(user._id, "Your password was changed. Other sessions have been revoked.", "/app/profile", null, { category: "account" });
      session(res, user, config);
      res.json({ message: "Password changed; other sessions revoked" });
    },
  );
  r.get("/dashboard", async (req, res) => {
    const member = {
      $or: [{ student: req.user._id }, { mentor: req.user._id }],
    };
    const [mentorships, jobs, events, posts, notifications] = await Promise.all(
      [
        Mentorship.countDocuments({ ...member, status: "accepted" }),
        Job.countDocuments({ ...published, status: "open", closesAt: { $gt: new Date() } }),
        Event.countDocuments({
          ...published,
          status: "published",
          startsAt: { $gt: new Date() },
        }),
        Post.countDocuments(published),
        Notification.countDocuments({ user: req.user._id, read: false }),
      ],
    );
    const stats = { mentorships, jobs, events, posts, notifications };
    if (isAdmin(req.user))
      stats.users = await User.countDocuments({ status: { $ne: "deleted" } });
    res.json({
      stats,
      recent: await Post.find(published)
        .sort({ createdAt: -1 })
        .limit(3)
        .populate("author", "name avatar role"),
    });
  });
  r.use(profileRoutes());
  r.use(studentConversionRoutes());
  r.get("/mentors", async (req, res) => {
    const filter = { role: "alumni", active: true, mentoring: true, _id: { $ne: req.user._id } };
    if (req.query.q)
      filter.$or = ["name", "company", "department"].map((k) => ({
        [k]: {
          $regex: String(req.query.q)
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .slice(0, 100),
          $options: "i",
        },
      }));
    const data = await list(User, filter, req);
    const relations = ["student", "alumni"].includes(req.user.role) ? await Mentorship.find({ student: req.user._id, mentor: { $in: data.items.map(u => u._id) } }) : [];
    data.items = await Promise.all(data.items.map(async u => ({
      ...fields(u.toObject(), ["_id", ...publicFields.split(" ")]),
      mentorship: await relationshipSummary(relations.find(r => String(r.mentor) === String(u._id)))
    })));
    res.json(data);
  });
  r.get("/users/:id", ...id(), async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      active: true,
    }).select(publicFields);
    assert(user, 404, "User not found");
    const relation = ["student", "alumni"].includes(req.user.role) && user.role === "alumni" ? await Mentorship.findOne({ student: req.user._id, mentor: user._id }) : null;
    res.json({ user, mentorship: await relationshipSummary(relation) });
  });
  r.get("/mentorships", async (req, res) =>
    res.json(
      await list(
        Mentorship,
        { $or: [{ student: req.user._id }, { mentor: req.user._id }] },
        req,
        [
          { path: "student", select: publicFields },
          { path: "mentor", select: publicFields },
        ],
      ),
    ),
  );
  r.post(
    "/mentorships",
    roles("student", "alumni"),
    [
      body("mentor").isMongoId(),
      str("title", 160),
      str("description", 3000),
      validate,
    ],
    async (req, res) => {
      assert(String(req.user._id) !== req.body.mentor, 422, "You cannot request mentorship from yourself");
      assert(
        await User.exists({
          _id: req.body.mentor,
          role: "alumni",
          active: true,
          mentoring: true,
        }),
        404,
        "Available mentor not found",
      );
      let record;
      await transaction(async (s) => {
        [record] = await Mentorship.create(
          [
            {
              student: req.user._id,
              mentor: req.body.mentor,
              title: req.body.title,
              description: req.body.description,
            },
          ],
          { session: s },
        );
        await notify(
          record.mentor,
          `${req.user.name} requested mentorship`,
          "/app/requests",
          s,
          { actor: req.user._id, category: "mentorship" },
        );
      });
      res.status(201).json({ item: record });
    },
  );
  r.patch(
    "/mentorships/:id",
    ...id(),
    [body("status").isIn(["accepted", "rejected", "completed"]), validate],
    async (req, res) => {
      let record;
      await transaction(async (s) => {
        record = await Mentorship.findById(req.params.id).session(s);
        assert(record, 404, "Request not found");
        const mentor =
          String(record.mentor) === String(req.user._id) &&
          req.user.role === "alumni";
        const next = req.body.status;
        assert(
          (mentor &&
            record.status === "pending" &&
            ["accepted", "rejected"].includes(next)) ||
            (mentor &&
              record.status === "accepted" &&
              next === "completed"),
          403,
          "This status transition is not permitted",
        );
        record.status = next;
        record.accessVersion++;
        await record.save({ session: s });
        await notify(
          mentor ? record.student : record.mentor,
          `${req.user.name} ${next === "accepted" ? "accepted your mentorship request" : next === "rejected" ? "declined your mentorship request" : "completed your mentorship"}: ${record.title}`,
          "/app/requests",
          s,
        );
      });
      res.json({ item: record });
    },
  );
  r.get("/conversations", roles("student", "alumni"), async (req, res) => {
    const items = await Mentorship.find({
      status: { $in: ["accepted", "completed"] },
      closedForConversion: { $ne: true },
      $or: [{ student: req.user._id }, { mentor: req.user._id }],
    })
      .sort({ updatedAt: -1 })
      .populate("student", publicFields + " active")
      .populate("mentor", publicFields + " active");
    const eligible = items.filter(x => x.student?.active && x.mentor?.active && ["student", "alumni"].includes(x.student.role) && x.mentor.role === "alumni");
    const legacy = eligible.filter(item => !item.mentorStartedAt);
    const legacyStarts = legacy.length ? await Message.aggregate([
      { $match: { $or: legacy.map(item => ({ mentorship: item._id, sender: item.mentor._id })) } },
      { $group: { _id: "$mentorship" } }
    ]) : [];
    const startedIds = new Set(legacyStarts.map(item => String(item._id)));
    const visible = [];
    for (const item of eligible) {
      const started = !!item.mentorStartedAt || startedIds.has(String(item._id));
      if (String(item.mentor._id) === String(req.user._id) || started) visible.push({ ...item.toObject(), mentorStarted: started, canSend: item.status === "accepted" && (String(item.mentor._id) === String(req.user._id) || started) });
    }
    const latest = visible.length ? await Message.aggregate([{ $match: { mentorship: { $in: visible.map(x => x._id) } } }, { $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: "$mentorship", body: { $first: "$body" }, deletedAt: { $first: "$deletedAt" }, sentAt: { $first: "$createdAt" } } }]) : [];
    res.json({ items: visible.map(item => ({...item,lastMessage:latest.find(m=>String(m._id)===String(item._id))})) });
  });
  r.get(
    "/conversations/:id/messages",
    roles("student", "alumni"),
    ...id(),
    async (req, res) => {
      const relation = await acceptedRelationship(req.user, req.params.id, null, true);
      const started = await mentorHasStarted(relation);
      res.json({
        ...await list(Message, { mentorship: req.params.id }, req, { path: "sender", select: "name avatar" }),
        canSend: relation.status === "accepted" && (String(relation.mentor) === String(req.user._id) || started),
        waitingForMentor: relation.status === "accepted" && String(relation.student) === String(req.user._id) && !started,
        counterpart: await User.findById(String(relation.mentor) === String(req.user._id) ? relation.student : relation.mentor).select(publicFields),
        relationship: { _id: relation._id, status: relation.status, title: relation.title, isMentor: String(relation.mentor) === String(req.user._id) }
      });
    },
  );
  r.post(
    "/conversations/:id/messages",
    roles("student", "alumni"),
    ...id(),
    [str("body", 4000), validate],
    async (req, res) => {
      let message;
      await transaction(async (s) => {
        const relation = await acceptedRelationship(req.user, req.params.id, s);
        assert(String(relation.mentor) === String(req.user._id) || await mentorHasStarted(relation, s), 403, "Wait for your Alumni mentor to send the first message");
        const write = await Mentorship.updateOne(
          { _id: relation._id, status: "accepted" },
          { $inc: { accessVersion: 1 }, ...(String(relation.mentor) === String(req.user._id) && !relation.mentorStartedAt ? { $set: { mentorStartedAt: new Date() } } : {}) },
          { session: s },
        );
        assert(write.matchedCount === 1, 409, "Mentorship status changed. Refresh the conversation.");
        [message] = await Message.create(
          [
            {
              mentorship: relation._id,
              sender: req.user._id,
              body: req.body.body,
            },
          ],
          { session: s },
        );
        await notify(
          String(relation.student) === String(req.user._id)
            ? relation.mentor
            : relation.student,
          `New message from ${req.user.name}`,
          `/app/messages/${relation._id}`,
          s,
          { actor: req.user._id, category: "messages" },
        );
      });
      res.status(201).json({ item: message });
    },
  );
  r.delete("/conversations/:id/messages/:messageId", roles("student", "alumni"), ...id(), param("messageId").isMongoId(), validate, async (req,res)=>{
    await transaction(async s=>{
      const relation=await acceptedRelationship(req.user,req.params.id,s);
      const write=await Mentorship.updateOne({_id:relation._id,status:"accepted"},{$inc:{accessVersion:1}},{session:s});
      assert(write.matchedCount===1,409,"Mentorship status changed. Refresh the conversation.");
      const message=await Message.findOneAndUpdate({_id:req.params.messageId,mentorship:relation._id,sender:req.user._id,deletedAt:{$exists:false}},{$set:{body:"[Message deleted]",deletedAt:new Date()}},{new:true,session:s});
      assert(message,403,"Only your own undeleted messages can be removed");
    });
    res.json({message:"Message deleted"});
  });
  r.use(feedRoutes());
  r.use(resourceRoutes());
  r.post(
    "/donations/:id/contributions",
    roles("student", "alumni"),
    ...id(),
    [
      body("amount").isFloat({ min: 1, max: 100000000 }).custom(v => Number.isInteger(Math.round(Number(v) * 100)) && Math.abs(Number(v)*100 - Math.round(Number(v)*100)) < 0.00001),
      body("method").optional().isIn(["manual", "bkash", "nagad"]),
      str("reference", 160),
      validate,
    ],
    async (req, res) => {
      assert(
        await Donation.exists({
          _id: req.params.id,
          mode: { $ne: "information" },
          status: "open",
          visibility: { $nin: ["hidden", "archived", "deleted"] },
          $or: [
            { deadline: { $exists: false } },
            { deadline: null },
            { deadline: { $gt: new Date() } },
          ],
        }),
        409,
        "Campaign is not open",
      );
      let item;
      await transaction(async s => {
        const campaign = await Donation.findById(req.params.id).session(s);
        assert(String(campaign.owner) !== String(req.user._id), 422, "The campaign owner cannot contribute to their own campaign");
        const method = req.body.method || "manual";
        assert(method === "manual" || campaign[method + "Number"], 422, "This payment method is not configured by the owner");
        [item] = await Contribution.create([{ donation: req.params.id, user: req.user._id, donorName: req.user.name, donorEmail: req.user.email, donorPhone: req.user.phone, method, amount: Math.round(Number(req.body.amount)*100)/100, reference: req.body.reference.trim().toUpperCase() }], { session: s });
        await notifyAudience({ role: { $in: ["admin", "superadmin"] } }, `${req.user.name} submitted a contribution for review`, "/app/donations", { category: "reviews", actor: req.user._id }, s);
        if (campaign && String(campaign.owner) !== String(req.user._id)) await notify(campaign.owner, `${req.user.name} submitted a contribution to ${campaign.title}`, `/app/donations/${campaign._id}`, s, { category: "giving", actor: req.user._id });
      });
      res.status(201).json({ item });
    },
  );
  r.get("/donations/:id/contributions", ...id(), async (req, res) => {
    const campaign = await Donation.findById(req.params.id);
    assert(campaign && (isAdmin(req.user) || String(campaign.owner) === String(req.user._id)), 403, "Only the campaign owner or administrator can view contributors");
    const page = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1));
    const filter = { donation: campaign._id };
    const total = await Contribution.countDocuments(filter);
    const items = await Contribution.find(filter).sort({createdAt:-1,_id:-1}).skip((page-1)*20).limit(20).populate("user", "name email universityId phone");
    const summary = await Contribution.aggregate([{ $match: { donation: campaign._id } }, { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } }]);
    res.json({items,summary,total,page,pages:Math.ceil(total/20)});
  });
  r.get("/contributions", async (req, res) =>
    res.json(
      await list(
        Contribution,
        isAdmin(req.user) ? {} : { user: req.user._id },
        req,
        [
          { path: "user", select: "name" },
          { path: "donation", select: "title" },
        ],
      ),
    ),
  );
  r.patch(
    "/contributions/:id",
    roles("alumni", "admin", "superadmin"),
    ...id(),
    [body("status").isIn(["approved", "rejected"]), validate],
    async (req, res) => {
      let item;
      await transaction(async (s) => {
        const existing = await Contribution.findById(req.params.id).session(s);
        assert(existing, 404, "Contribution not found");
        const campaign = await Donation.findById(existing.donation).session(s);
        assert(campaign && (isAdmin(req.user) || String(campaign.owner) === String(req.user._id)), 403, "Only the campaign owner or administrator can review contributions");
        assert(existing.paymentStatus !== "awaiting_gateway" && existing.paymentStatus !== "failed", 409, "Payment has not been verified");
        assert(String(existing.user) !== String(req.user._id), 403, "You cannot approve your own contribution");
        item = await Contribution.findOneAndUpdate(
          { _id: req.params.id, status: "pending" },
          { $set: { status: req.body.status, reviewedBy: req.user._id, reviewedAt: new Date() } },
          { new: true, session: s },
        );
        assert(item, 409, "Contribution missing or already reviewed");
        if (item.user) await notify(
          item.user,
          `Your contribution was ${item.status}`,
          `/app/donations/${item.donation}`,
          s,
        );
      });
      res.json({ item });
    },
  );
  r.get("/notifications/summary", async (req, res) => res.set("Cache-Control", "no-store").json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) }));
  r.get("/notifications", async (req, res) => {
    const categories = ["mentorship", "messages", "events", "careers", "giving", "community", "reviews", "account", "moderation"];
    assert(!req.query.category || categories.includes(req.query.category), 422, "Invalid notification category");
    assert(!req.query.status || ["all", "unread", "read"].includes(req.query.status), 422, "Invalid notification status");
    const page = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1));
    const legacy = { $switch: { branches: [
      ["reviews", "conversion|alumni-requests"], ["messages", "messages"], ["mentorship", "requests"], ["events", "events"], ["careers", "jobs"], ["giving", "donations"], ["community", "feed"]
    ].map(([then, regex]) => ({ case: { $regexMatch: { input: { $ifNull: ["$link", ""] }, regex } }, then })), default: "account" } };
    const filter = { ...(req.query.category ? { category: req.query.category } : {}), ...(req.query.status === "unread" ? { read: false } : req.query.status === "read" ? { read: true } : {}) };
    const [result] = await Notification.aggregate([
      { $match: { user: req.user._id } },
      { $set: { category: { $cond: [{ $in: [{ $ifNull: ["$category", ""] }, ["", null]] }, legacy, "$category"] } } },
      { $facet: {
        items: [{ $match: filter }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 20 }, { $limit: 20 }],
        total: [{ $match: filter }, { $count: "value" }],
        unread: [{ $match: { read: false } }, { $count: "value" }],
        counts: [{ $group: { _id: "$category", total: { $sum: 1 }, unread: { $sum: { $cond: ["$read", 0, 1] } } } }]
      } }
    ]);
    await Notification.populate(result.items, { path: "actor", select: "name role avatar" });
    const total = result.total[0]?.value || 0;
    res.set("Cache-Control", "no-store").json({ items: result.items, total, unread: result.unread[0]?.value || 0, counts: result.counts, page, pages: Math.ceil(total / 20), role: req.user.role });
  });
  r.patch("/notifications/read", async (req, res) => {
    await Notification.updateMany(
      { user: req.user._id },
      { $set: { read: true } },
    );
    res.json({ message: "All notifications marked read" });
  });
  r.patch(
    "/notifications/:id",
    ...id(),
    [body("read").isBoolean(), validate],
    async (req, res) => {
      const item = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { $set: { read: req.body.read } },
        { new: true },
      );
      assert(item, 404, "Notification not found");
      res.json({ item });
    },
  );
  r.use(managementRoutes(config));
  return r;
}
