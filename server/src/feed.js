import { Router } from "express";
import { body, param, query } from "express-validator";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import {
  Post,
  FeedInteraction,
  FeedComment,
  FeedShare,
  ShareVisit,
  User,
  Contribution,
} from "./models.js";
import { contentModels, published, visible } from "./resources.js";
import { assert, validate, isAdmin, notify, notifyAudience } from "./security.js";
export const TOPICS = [
  "Technology",
  "Careers",
  "Business",
  "Science",
  "Arts & Culture",
  "Education",
  "Health",
  "Sports",
  "Community",
  "Environment",
];
const models = { posts: Post, ...contentModels };
const refRules = [
  param("kind").isIn(Object.keys(models)),
  param("id").isMongoId(),
  validate,
];
const pnum = (v) => Math.min(100000, Math.max(1, parseInt(v, 10) || 1));
const key = (req) => ({
  kind: req.params.kind,
  record: new mongoose.Types.ObjectId(req.params.id),
});
async function readable(req) {
  const item = await models[req.params.kind].findById(req.params.id);
  assert(
    visible(req.user, item) &&
      (isAdmin(req.user) || !["hidden", "archived"].includes(item.visibility)),
    404,
    "Post not found",
  );
  return item;
}
async function stats(item, kind, user) {
  const base = { kind, record: new mongoose.Types.ObjectId(item._id) };
  const [groups, comments, shares, mine] = await Promise.all([
    FeedInteraction.aggregate([
      { $match: { ...base, reaction: { $nin: ["", null] } } },
      { $group: { _id: "$reaction", count: { $sum: 1 } } },
    ]),
    FeedComment.countDocuments(base),
    ShareVisit.countDocuments(base),
    FeedInteraction.findOne({ ...base, user: user._id }),
  ]);
  return {
    reactions: Object.fromEntries(groups.map((x) => [x._id, x.count])),
    comments,
    shares,
    myReaction: mine?.reaction || "",
    viewed: !!mine?.viewedAt,
  };
}
async function card(item, kind, user) {
  const o = item.toObject ? item.toObject() : item;
  delete o.registrations;
  if (kind === "donations" && o.mode !== "information") {
    const [sum] = await Contribution.aggregate([{ $match: { donation: o._id, status: "approved" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    o.total = sum?.total || 0; o.remaining = Math.max(0, o.goal-o.total);
  }
  const author = await User.findById(o.author || o.owner).select(
    "name role avatar",
  );
  return {
    ...o,
    kind,
    author,
    body: o.body || o.description,
    stats: await stats(o, kind, user),
  };
}
export function feedRoutes() {
  const r = Router();
  r.get("/feed/options", (req, res) => res.json({ topics: TOPICS }));
  r.get(
    "/feed",
    query("cutoff").optional().isISO8601(),
    query("mode")
      .optional()
      .isIn(["for-you", "latest", "viewed", "moderation"]),
    query("page").optional().isInt({ min: 1, max: 100000 }),
    query("visibility").optional().isIn(["published", "hidden", "archived"]),
    validate,
    async (req, res) => {
      const mode = req.query.mode || "for-you",
        page = pnum(req.query.page);
      assert(
        mode !== "moderation" || isAdmin(req.user),
        403,
        "Administrator access required",
      );
      const match =
        mode === "moderation"
          ? { visibility: req.query.visibility || "archived" }
          : published;
      const projection = (kind) => ({
        $project: {
          _id: 1,
          createdAt: 1,
          topics: { $ifNull: ["$topics", []] },
          kind: { $literal: kind },
        },
      });
      const pipeline = [{ $match: match }, projection("posts")];
      for (const kind of Object.keys(contentModels))
        pipeline.push({
          $unionWith: {
            coll: models[kind].collection.name,
            pipeline: [{ $match: match }, projection(kind)],
          },
        });
      pipeline.push({
        $lookup: {
          from: FeedInteraction.collection.name,
          let: { record: "$_id", kind: "$kind" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$record", "$$record"] },
                    { $eq: ["$kind", "$$kind"] },
                    { $eq: ["$user", req.user._id] },
                  ],
                },
              },
            },
          ],
          as: "interaction",
        },
      });
      if (mode === "for-you")
        pipeline.push({
          $match: req.query.cutoff
            ? {
                $or: [
                  { "interaction.viewedAt": { $exists: false } },
                  {
                    "interaction.viewedAt": {
                      $gte: new Date(req.query.cutoff),
                    },
                  },
                ],
              }
            : { "interaction.viewedAt": { $exists: false } },
        });
      if (mode === "viewed")
        pipeline.push({
          $match: { "interaction.viewedAt": { $exists: true } },
        });
      pipeline.push(
        {
          $addFields: {
            score:
              mode === "for-you"
                ? {
                    $size: {
                      $setIntersection: ["$topics", req.user.interests || []],
                    },
                  }
                : { $literal: 0 },
          },
        },
        { $sort: { score: -1, createdAt: -1, _id: -1, kind: 1 } },
        {
          $facet: {
            count: [{ $count: "total" }],
            items: [{ $skip: (page - 1) * 12 }, { $limit: 12 }],
          },
        },
      );
      const [result] = await Post.aggregate(pipeline);
      const items = [];
      for (const row of result.items) {
        const item = await models[row.kind].findById(row._id);
        if (item && visible(req.user, item))
          items.push(await card(item, row.kind, req.user));
      }
      const total = result.count[0]?.total || 0;
      res.set("Cache-Control", "no-store").json({
        items,
        total,
        page,
        pages: Math.ceil(total / 12),
        interests: req.user.interests || [],
      });
    },
  );
  r.get("/feed/:kind/:id", refRules, async (req, res) =>
    res.json({
      item: await card(await readable(req), req.params.kind, req.user),
    }),
  );
  r.post("/feed/:kind/:id/view", refRules, async (req, res) => {
    await readable(req);
    await FeedInteraction.updateOne(
      { ...key(req), user: req.user._id },
      { $set: { viewedAt: new Date() } },
      { upsert: true },
    );
    res.json({ message: "Viewed" });
  });
  r.put(
    "/feed/:kind/:id/reaction",
    refRules,
    body("reaction").isIn([
      "like",
      "love",
      "celebrate",
      "support",
      "insightful",
      "",
    ]),
    validate,
    async (req, res) => {
      const post = await readable(req);
      const previous = await FeedInteraction.findOneAndUpdate(
        { ...key(req), user: req.user._id },
        { $set: { reaction: req.body.reaction } },
        { upsert: true, runValidators: true },
      );
      if (req.body.reaction && !previous?.reaction) await notify(post.author || post.owner, `${req.user.name} liked your post`, `/app/feed/${req.params.kind}/${req.params.id}`, null, { category: "community", actor: req.user._id, eventKey: `reaction:${req.params.kind}:${req.params.id}:${req.user._id}` });
      res.json(await stats({ _id: req.params.id }, req.params.kind, req.user));
    },
  );
  r.get("/feed/:kind/:id/comments", refRules, async (req, res) => {
    await readable(req);
    const filter = key(req),
      page = pnum(req.query.page),
      total = await FeedComment.countDocuments(filter);
    res.json({
      items: await FeedComment.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 20)
        .limit(20)
        .populate("author", "name role avatar"),
      total,
      page,
      pages: Math.ceil(total / 20),
    });
  });
  r.post(
    "/feed/:kind/:id/comments",
    refRules,
    body("body").isString().trim().isLength({ min: 1, max: 2000 }),
    validate,
    async (req, res) => {
      const post = await readable(req);
      const comment = await FeedComment.create({
          ...key(req),
          author: req.user._id,
          body: req.body.body,
        });
      await notify(post.author || post.owner, `${req.user.name} commented on your post`, `/app/feed/${req.params.kind}/${req.params.id}`, null, { category: "community", actor: req.user._id });
      res.status(201).json({ item: comment });
    },
  );
  r.delete(
    "/feed/comments/:commentId",
    param("commentId").isMongoId(),
    validate,
    async (req, res) => {
      const c = await FeedComment.findById(req.params.commentId);
      assert(c, 404, "Comment not found");
      assert(
        isAdmin(req.user) || String(c.author) === String(req.user._id),
        403,
        "Only the author or administrator can remove",
      );
      await c.deleteOne();
      await notify(c.author, `Your comment was removed by ${req.user.name}`, `/app/feed/${c.kind}/${c.record}`, null, { category: "moderation", actor: req.user._id });
      res.json({ message: "Comment removed" });
    },
  );
  r.post("/feed/:kind/:id/share", refRules, async (req, res) => {
    await readable(req);
    const item = await FeedShare.create({
      ...key(req),
      creator: req.user._id,
      token: randomBytes(24).toString("hex"),
    });
    res.json({
      path: `/app/feed/${req.params.kind}/${req.params.id}?share=${item.token}`,
    });
  });
  r.post(
    "/feed/:kind/:id/share-view",
    refRules,
    body("token")
      .isString()
      .matches(/^[a-f0-9]{48}$/),
    validate,
    async (req, res) => {
      await readable(req);
      const share = await FeedShare.findOne({
        ...key(req),
        token: req.body.token,
      });
      assert(share, 404, "Share link not found");
      if (String(share.creator) !== String(req.user._id)) {
        const visit = await ShareVisit.updateOne(
          { ...key(req), viewer: req.user._id },
          { $setOnInsert: { creator: share.creator } },
          { upsert: true },
        );
        if (visit.upsertedCount) await notify(share.creator, "Someone opened your shared post", `/app/feed/${req.params.kind}/${req.params.id}`, null, { category: "community" });
      }
      res.json({ message: "Shared post opened" });
    },
  );
  r.patch(
    "/feed/:kind/:id/visibility",
    refRules,
    body("visibility").isIn(["published", "hidden", "archived", "deleted"]),
    validate,
    async (req, res) => {
      assert(isAdmin(req.user), 403, "Administrator access required");
      const item = await models[req.params.kind].findOneAndUpdate(
        { _id: req.params.id, visibility: { $ne: "deleted" } },
        { $set: { visibility: req.body.visibility } },
        { new: true },
      );
      assert(item, 404, "Post not found");
      await notify(item.owner || item.author, `Your post is now ${item.visibility}`, item.visibility === "deleted" ? "/app/notifications" : `/app/feed/${req.params.kind}/${req.params.id}`, null, { category: "moderation", actor: req.user._id });
      res.json({ item });
    },
  );
  r.get("/posts", async (req, res) => {
    const filter = published,
      page = pnum(req.query.page),
      total = await Post.countDocuments(filter);
    res.json({
      items: await Post.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 12)
        .limit(12)
        .populate("author", "name role avatar"),
      total,
      page,
      pages: Math.ceil(total / 12),
    });
  });
  const postRules = [
    body("body").isString().trim().isLength({ min: 1, max: 5000 }),
    body("topics").optional().isArray({ max: 10 }),
    body("topics.*").optional().isIn(TOPICS),
    validate,
  ];
  r.post("/posts", postRules, async (req, res) => {
    const item = await Post.create({ body: req.body.body, topics: req.body.topics || [], author: req.user._id });
    await notifyAudience({ role: { $in: ["student", "alumni"] }, ...(item.topics.length ? { $or: [{ interests: { $in: item.topics } }, { interests: { $size: 0 } }, { interests: { $exists: false } }] } : {}) }, `${req.user.name} shared a community post`, `/app/feed/posts/${item._id}`, { actor: req.user._id, category: "community" });
    await notifyAudience({ role: { $in: ["admin", "superadmin"] } }, `${req.user.name} published a community post`, `/app/feed/posts/${item._id}`, { actor: req.user._id, category: "moderation" });
    res.status(201).json({ item });
  });
  r.patch(
    "/posts/:id",
    param("id").isMongoId(),
    postRules,
    async (req, res) => {
      const item = await Post.findById(req.params.id);
      assert(item && item.visibility !== "deleted", 404, "Post not found");
      assert(
        isAdmin(req.user) || String(item.author) === String(req.user._id),
        403,
        "Only the author or administrator can edit",
      );
      item.body = req.body.body;
      if (req.body.topics) item.topics = req.body.topics;
      await item.save();
      await notify(item.author, `Your community post was updated by ${req.user.name}`, `/app/feed/posts/${item._id}`, null, { category: "moderation", actor: req.user._id });
      res.json({ item });
    },
  );
  r.delete(
    "/posts/:id",
    param("id").isMongoId(),
    validate,
    async (req, res) => {
      const item = await Post.findById(req.params.id);
      assert(item, 404, "Post not found");
      assert(
        isAdmin(req.user) || String(item.author) === String(req.user._id),
        403,
        "Only the author or administrator can remove",
      );
      item.visibility = "deleted";
      await item.save();
      await notify(item.author, `Your community post was removed by ${req.user.name}`, "/app/notifications", null, { category: "moderation", actor: req.user._id });
      res.json({ message: "Post deleted" });
    },
  );
  return r;
}
