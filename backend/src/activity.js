import { Router } from "express";
import { query } from "express-validator";
import mongoose from "mongoose";
import { ActivityLog } from "./models.js";
import { roles, validate, list, assert } from "./security.js";
import { literalMatch, pagingRules, queryShape } from "./member-search.js";
const actions = {
  "PUT /feed/:kind/:id/reaction": ["feed.reacted", "Updated a feed reaction"],
  "POST /feed/:kind/:id/comments": ["feed.commented", "Added a feed comment"],
  "DELETE /feed/comments/:commentId": [
    "feed.comment_deleted",
    "Deleted a feed comment",
  ],
  "POST /feed/:kind/:id/share": [
    "feed.link_copied",
    "Created a feed share link",
  ],
  "POST /feed/:kind/:id/share-view": [
    "feed.share_opened",
    "Opened a shared feed post",
  ],
  "PATCH /feed/:kind/:id/visibility": [
    "feed.moderated",
    "Updated feed visibility",
  ],
  "POST /events/:id/participants": [
    "event.participant_added",
    "Added an event participant",
  ],
  "DELETE /donations/:id": ["campaign.deleted", "Deleted a campaign"],

  "POST /conversions": [
    "conversion.requested",
    "Requested Student to Alumni conversion",
  ],
  "POST /users/me/avatar": [
    "profile.picture_updated",
    "Updated profile picture",
  ],
  "DELETE /users/me/avatar": [
    "profile.picture_removed",
    "Removed profile picture",
  ],
  "POST /auth/login": ["account.login", "Signed in"],
  "POST /auth/register": ["account.activated", "Activated account"],
  "POST /auth/logout": ["account.logout", "Signed out"],
  "PUT /auth/password": ["account.password_changed", "Changed password"],
  "PATCH /users/me": ["profile.updated", "Updated profile"],
  "POST /mentorships": ["mentorship.requested", "Requested mentorship"],
  "POST /conversations/:id/messages": [
    "message.sent",
    "Sent a mentorship message",
  ],
  "POST /posts": ["post.created", "Created a community post"],
  "PATCH /posts/:id": ["post.updated", "Edited a community post"],
  "DELETE /posts/:id": ["post.deleted", "Deleted a community post"],
  "POST /jobs": ["job.created", "Created a job listing"],
  "PUT /jobs/:id": ["job.updated", "Updated a job listing"],
  "DELETE /jobs/:id": ["job.deleted", "Deleted a job listing"],
  "POST /events": ["event.created", "Created an event"],
  "PUT /events/:id": ["event.updated", "Updated an event"],
  "DELETE /events/:id": ["event.deleted", "Deleted an event"],
  "POST /events/:id/register": ["event.registered", "Registered for an event"],
  "PATCH /events/:id/registrations": [
    "event.registration_cancelled",
    "Cancelled an event registration",
  ],
  "POST /donations": ["campaign.created", "Created a donation campaign"],
  "PUT /donations/:id": ["campaign.updated", "Updated a donation campaign"],
  "POST /donations/:id/contributions": [
    "contribution.submitted",
    "Submitted a manual contribution record",
  ],
  "PATCH /notifications/read": [
    "notifications.read",
    "Marked notifications as read",
  ],
  "PATCH /notifications/:id": [
    "notification.updated",
    "Updated notification read status",
  ],
};
const statusActions = new Set([
  "active",
  "suspended",
  "blocked",
  "accepted",
  "rejected",
  "completed",
  "approved",
]);
function describe(req) {
  const route = req.route?.path;
  if (typeof route !== "string") return null;
  if (route === "/admin/users/bulk-preview") return null;
  const key = req.method + " " + route;
  if (actions[key]) return [...actions[key], route];
  const status = statusActions.has(req.body?.status)
    ? req.body.status
    : req.body?.active === true
      ? "active"
      : req.body?.active === false
        ? "blocked"
        : "updated";
  if (route === "/admin/conversions/:id" && req.method === "PATCH")
    return ["conversion." + status, "Alumni conversion " + status, route];
  if (route === "/mentorships/:id" && req.method === "PATCH")
    return ["mentorship." + status, "Mentorship " + status, route];
  if (route === "/contributions/:id" && req.method === "PATCH")
    return [
      "contribution." + status,
      "Reviewed a contribution: " + status,
      route,
    ];
  const resource = route.startsWith("/admin/verified-users")
    ? "verification"
    : route.startsWith("/admin/users")
      ? "member"
      : route.startsWith("/superadmin/admins")
        ? "administrator"
        : null;
  if (resource) {
    const verb = {
      POST: "created",
      PUT: "updated",
      DELETE: "deleted",
      PATCH: status,
    }[req.method];
    if (verb)
      return [
        resource + "." + verb,
        resource[0].toUpperCase() + resource.slice(1) + " account " + verb,
        route,
      ];
  }
  if (route === "/superadmin/ownership/transfer")
    return ["ownership.transferred", "Transferred platform ownership", route];
  return null;
}
export function recordActivity(req, res, next) {
  const original = res.json.bind(res);
  res.json = function (payload) {
    const event =
      res.statusCode >= 200 && res.statusCode < 300 && req.user
        ? describe(req)
        : null;
    if (!event || res.locals.activityRecorded) return original(payload);
    res.locals.activityRecorded = true;
    const id = payload?.item?._id || payload?.user?._id || req.params?.id;
    const entry = {
      actor: req.user._id,
      actorRole: req.user.role,
      action: event[0],
      summary: event[1],
      route: event[2],
      ...(mongoose.isValidObjectId(id) ? { resourceId: id } : {}),
    };
    // Record before returning success. Logging failures are retried without misreporting a committed business action as failed.
    const write = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await ActivityLog.create(entry);
          return;
        } catch (error) {
          if (attempt === 2)
            console.error("Activity recording failed:", error.message);
        }
      }
    };
    void write()
      .then(() => original(payload))
      .catch(next);
    return res;
  };
  next();
}
const rules = [
  queryShape,
  ...pagingRules,
  query("role").optional().isIn(["admin", "alumni", "student"]),
  query("userId").optional().isMongoId(),
  query("q").optional().isString().trim().isLength({ max: 100 }),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
  validate,
];
function activityMatch(req) {
  const filter = { actorRole: req.query.role || "student" };
  if (req.query.userId)
    filter.actor = new mongoose.Types.ObjectId(req.query.userId);
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    assert(
      !req.query.from ||
        !req.query.to ||
        new Date(req.query.from) <= new Date(req.query.to),
      422,
      "Start date must be before end date",
    );
  }
  return filter;
}
function actorSearch(req) {
  return req.query.q
    ? {
        $match: {
          $or: ["actor.name", "actor.email", "actor.universityId"].map((k) => ({
            [k]: literalMatch(req.query.q),
          })),
        },
      }
    : null;
}
const actorLookup = [
  {
    $lookup: {
      from: "users",
      localField: "actor",
      foreignField: "_id",
      as: "actor",
    },
  },
  { $unwind: "$actor" },
];
const publicActor = {
  _id: "$actor._id",
  name: "$actor.name",
  email: "$actor.email",
  universityId: "$actor.universityId",
  role: "$actor.role",
  status: "$actor.status",
};
export function activityRoutes() {
  const r = Router();
  r.use("/superadmin/activity", roles("superadmin"));
  r.get("/superadmin/activity/users", rules, async (req, res) => {
    const match = activityMatch(req),
      page = Number(req.query.page) || 1,
      limit = 20;
    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$actor",
          actor: { $first: "$actor" },
          count: { $sum: 1 },
          lastAt: { $first: "$createdAt" },
          lastAction: { $first: "$summary" },
        },
      },
      ...actorLookup,
    ];
    const search = actorSearch(req);
    if (search) pipeline.push(search);
    pipeline.push(
      { $sort: { lastAt: -1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                count: 1,
                lastAt: 1,
                lastAction: 1,
                actor: publicActor,
              },
            },
          ],
          count: [{ $count: "total" }],
        },
      },
    );
    const [result] = await ActivityLog.aggregate(pipeline);
    const total = result?.count[0]?.total || 0;
    res.json({
      items: result?.items || [],
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  });
  r.get("/superadmin/activity", rules, async (req, res) => {
    const page = Number(req.query.page) || 1,
      limit = 20;
    const pipeline = [{ $match: activityMatch(req) }, ...actorLookup];
    const search = actorSearch(req);
    if (search) pipeline.push(search);
    pipeline.push(
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                action: 1,
                summary: 1,
                createdAt: 1,
                resourceId: 1,
                actorRole: 1,
                actor: publicActor,
              },
            },
          ],
          count: [{ $count: "total" }],
        },
      },
    );
    const [result] = await ActivityLog.aggregate(pipeline);
    const total = result?.count[0]?.total || 0;
    res.json({
      items: result?.items || [],
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  });
  return r;
}
