import { Router } from "express";
import { body, param } from "express-validator";
import mongoose from "mongoose";
import multer from "multer";
import sharp from "sharp";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import {
  Job,
  Event,
  Donation,
  User,
  CoverAsset,
  Contribution,
} from "./models.js";
import {
  assert,
  isAdmin,
  roles,
  validate,
  safeUrl,
  notify,
  notifyAudience,
} from "./security.js";
import { PHONE_PATTERN } from "./catalog.js";
export const contentModels = { jobs: Job, events: Event, donations: Donation };
export const published = {
  visibility: { $nin: ["hidden", "archived", "deleted"] },
};
const id = [param("id").isMongoId(), validate];
const pick = (o, keys) =>
  Object.fromEntries(
    keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]),
  );
const text = (k, max = 160) =>
  body(k).isString().trim().isLength({ min: 1, max });
const optional = (k, max = 3000) =>
  body(k).optional({ values: "falsy" }).isString().trim().isLength({ max });
const fields = {
  jobs: [
    "title",
    "company",
    "location",
    "description",
    "type",
    "status",
    "closesAt",
    "applicationUrl",
    "contactNumber",
    "workMode",
    "salary",
    "requirements",
    "benefits",
    "applicationEmail",
    "topics",
  ],
  events: [
    "title",
    "description",
    "location",
    "startsAt",
    "mode",
    "capacity",
    "status",
    "contactNumber",
    "organizer",
    "endsAt",
    "registrationDeadline",
    "onlineUrl",
    "agenda",
    "topics",
  ],
  donations: [
    "title",
    "description",
    "goal",
    "mode",
    "instructions",
    "status",
    "contactNumber",
    "beneficiary",
    "deadline",
    "purpose",
    "bkashNumber",
    "nagadNumber",
    "topics",
  ],
};
const common = [
  text("title"),
  text("description", 8000),
  body("contactNumber")
    .optional({ values: "falsy" })
    .isString()
    .matches(PHONE_PATTERN),
  body("topics").optional().isArray({ max: 10 }),
  body("topics.*").optional().isString().trim().isLength({ min: 1, max: 60 }),
];
const rules = {
  jobs: [
    text("company"),
    text("location"),
    body("type").isIn(["full-time", "part-time", "internship", "contract", "not-specified"]),
    body("status").isIn(["open", "closed"]),
    body("closesAt").isISO8601(),
    body("applicationUrl").optional().custom(safeUrl),
    body("workMode").optional().isIn(["on-site", "remote", "hybrid", "not-specified"]),
    optional("salary", 160),
    optional("requirements", 5000),
    optional("benefits"),
    body("applicationEmail").optional({ values: "falsy" }).isEmail(),
  ],
  events: [
    text("location", 200),
    body("mode").optional().isIn(["booking", "recap"]),
    body("startsAt").if((value, { req }) => req.body.mode !== "recap" || !!value).isISO8601(),
    body("capacity").if((value, { req }) => req.body.mode !== "recap").isInt({ min: 1, max: 100000 }),
    body("status").isIn(["published", "cancelled"]),
    optional("organizer", 160),
    body("endsAt").optional({ values: "falsy" }).isISO8601(),
    body("registrationDeadline").optional({ values: "falsy" }).isISO8601(),
    body("onlineUrl").optional().custom(safeUrl),
    optional("agenda", 4000),
  ],
  donations: [
    body("mode").optional().isIn(["fundraising", "information"]),
    body("goal").if((value, { req }) => req.body.mode !== "information").isFloat({ min: 1, max: 100000000 }),
    text("instructions", 3000),
    body("status").isIn(["open", "closed"]),
    optional("beneficiary", 200),
    body("deadline").optional({ values: "falsy" }).isISO8601(),
    optional("purpose"),
    body("bkashNumber").optional({ values: "falsy" }).matches(PHONE_PATTERN),
    body("nagadNumber").optional({ values: "falsy" }).matches(PHONE_PATTERN),
  ],
};
export const manage = (u, item) =>
  isAdmin(u) || String(item.owner?._id || item.owner) === String(u._id);
export function visible(u, item) {
  return (
    item &&
    item.visibility !== "deleted" &&
    (isAdmin(u) ||
      String(item.owner?._id || item.owner) === String(u._id) ||
      !["hidden", "archived"].includes(item.visibility))
  );
}
function eventView(item, user) {
  const obj = item.toObject ? item.toObject() : item;
  obj.registered = obj.registrations.some(
    (r) => String(r.user) === String(user._id) && r.status === "registered",
  );
  obj.participants = obj.registrations.filter(
    (r) => r.status === "registered",
  ).length;
  delete obj.registrations;
  return obj;
}
const page = (q) => Math.min(100000, Math.max(1, Number.parseInt(q, 10) || 1));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter(req, file, cb) {
    cb(
      null,
      [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/avif",
      ].includes(file.mimetype) &&
        /\.(png|jpe?g|webp|gif|avif)$/i.test(file.originalname),
    );
  },
});
export function resourceRoutes() {
  const r = Router();
  for (const [kind, Model] of Object.entries(contentModels)) {
    const createRoles = roles("alumni", "admin", "superadmin");
    r.get(`/${kind}`, async (req, res) => {
      const filter = {
        ...(isAdmin(req.user) ? { visibility: { $ne: "deleted" } } : published),
      };
      if (kind === "jobs" && !isAdmin(req.user))
        Object.assign(filter, {
          status: "open",
          closesAt: { $gt: new Date() },
        });
      if (req.query.mine === "true") {
        filter.visibility = { $ne: "deleted" };
        filter.owner = req.user._id;
        delete filter.status;
        delete filter.closesAt;
      }
      if (req.query.type && kind === "jobs")
        filter.type = String(req.query.type);
      if (req.query.q)
        filter.title = {
          $regex: String(req.query.q)
            .slice(0, 100)
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        };
      const p = page(req.query.page),
        total = await Model.countDocuments(filter);
      let items = await Model.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((p - 1) * 12)
        .limit(12)
        .populate("owner", "name role avatar");
      if (kind === "donations") {
        const sums = await Contribution.aggregate([{ $match: { donation: { $in: items.map(x => x._id) }, status: "approved" } }, { $group: { _id: "$donation", total: { $sum: "$amount" } } }]);
        const totals = new Map(sums.map(x => [String(x._id), x.total]));
        items = items.map(item => ({...item.toObject(), total: totals.get(String(item._id)) || 0, remaining: Math.max(0, (item.goal || 0) - (totals.get(String(item._id)) || 0))}));
      }
      if (kind === "events") items = items.map((x) => eventView(x, req.user));
      res.json({ items, total, page: p, pages: Math.ceil(total / 12) });
    });
    r.get(`/${kind}/:id`, id, async (req, res) => {
      const item = await Model.findById(req.params.id).populate(
        "owner",
        "name role avatar",
      );
      assert(visible(req.user, item), 404, "Post not found");
      let total;
      if (kind === "donations") {
        const a = await Contribution.aggregate([
          { $match: { donation: item._id, status: "approved" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        total = a[0]?.total || 0;
      }
      res.json({
        item: kind === "events" ? eventView(item, req.user) : item,
        ...(total !== undefined ? { total, remaining: Math.max(0, (item.goal || 0) - total) } : {}),
      });
    });
    for (const method of ["post", "put"])
      r[method](
        `/${kind}${method === "put" ? "/:id" : ""}`,
        createRoles,
        ...(method === "put" ? id : []),
        common,
        rules[kind],
        validate,
        async (req, res) => {
          const values = pick(req.body, fields[kind]);
          if (kind === "donations") {
            values.mode = values.mode || "fundraising";
            if (values.mode === "information") values.goal = null;
          }
          for (const k of ["deadline", "endsAt", "registrationDeadline"])
            if (values[k] === "") values[k] = null;
          if (method === "post" && kind === "jobs")
            assert(
              new Date(values.closesAt) > new Date(),
              422,
              "Closing date must be in the future",
            );
          if (kind === "events") {
            values.mode = values.mode || "booking";
            if (values.mode === "recap") {
              values.capacity = null;
              if (!values.startsAt) values.startsAt = null;
              assert(!values.startsAt || new Date(values.startsAt) < new Date(), 422, "A recap must describe a past event");
            }
            if (method === "post" && values.mode !== "recap")
              assert(
                new Date(values.startsAt) > new Date(),
                422,
                "Event must be in the future",
              );
            if (values.endsAt)
              assert(
                new Date(values.endsAt) > new Date(values.startsAt),
                422,
                "End time must be after start time",
              );
            if (values.registrationDeadline)
              assert(
                new Date(values.registrationDeadline) <=
                  new Date(values.startsAt),
                422,
                "Registration must close by the event start",
              );
          }
          let item;
          if (method === "post")
            item = await Model.create({ ...values, owner: req.user._id });
          else {
            item = await Model.findById(req.params.id);
            assert(
              item && item.visibility !== "deleted",
              404,
              "Post not found",
            );
            assert(
              manage(req.user, item),
              403,
              "Only the owner or administrator can update this post",
            );
            const query = { _id: item._id, visibility: { $ne: "deleted" } };
            if (kind === "events" && values.mode === "recap")
              assert(!item.registrations.some(r => r.status === "registered"), 409, "Cancel active bookings before changing to a recap");
            if (kind === "events" && values.mode !== "recap")
              query.$expr = {
                $lte: [
                  {
                    $size: {
                      $filter: {
                        input: "$registrations",
                        as: "r",
                        cond: { $eq: ["$$r.status", "registered"] },
                      },
                    },
                  },
                  Number(values.capacity),
                ],
              };
            item = await Model.findOneAndUpdate(
              query,
              { $set: values },
              { new: true, runValidators: true },
            );
            assert(
              item,
              409,
              "Capacity is below current registrations or post changed",
            );
          }
          const category = { jobs: "careers", events: "events", donations: "giving" }[kind];
          if (method === "post") {
            await notifyAudience({ role: { $in: ["student", "alumni"] }, ...(item.topics?.length ? { $or: [{ interests: { $in: item.topics } }, { interests: { $size: 0 } }, { interests: { $exists: false } }] } : {}) }, `${req.user.name} shared ${kind === "jobs" ? "a career opportunity" : kind === "events" ? "an event" : "a giving update"}: ${item.title}`, `/app/${kind}/${item._id}`, { category, actor: req.user._id });
            await notifyAudience({ role: { $in: ["admin", "superadmin"] } }, `${req.user.name} published ${item.title}`, `/app/${kind}/${item._id}`, { category: "moderation", actor: req.user._id });
          } else {
            await notify(item.owner, `Your post was updated by ${req.user.name}: ${item.title}`, `/app/${kind}/${item._id}`, null, { category: "moderation", actor: req.user._id });
            if (kind === "events") for (const booking of item.registrations.filter(r => r.status === "registered")) await notify(booking.user, `Event information updated: ${item.title}`, `/app/events/${item._id}`, null, { category: "events", actor: req.user._id });
          }
          res
            .status(method === "post" ? 201 : 200)
            .json({
              item: kind === "events" ? eventView(item, req.user) : item,
            });
        },
      );
    r.delete(`/${kind}/:id`, id, async (req, res) => {
      const item = await Model.findById(req.params.id);
      assert(item && item.visibility !== "deleted", 404, "Post not found");
      assert(
        manage(req.user, item),
        403,
        "Only the owner or administrator can delete",
      );
      await Model.updateOne(
        { _id: item._id },
        {
          $set: {
            visibility: "deleted",
            ...(kind === "events"
              ? { status: "cancelled" }
              : { status: "closed" }),
          },
        },
      );
      await notify(item.owner, `Your post was removed by ${req.user.name}: ${item.title}`, "/app/notifications", null, { category: "moderation", actor: req.user._id });
      if (kind === "events") for (const booking of item.registrations.filter(r => r.status === "registered")) await notify(booking.user, `Event cancelled: ${item.title}`, "/app/events", null, { category: "events", actor: req.user._id });
      res.json({
        message: "Post deleted from public pages. Related history retained.",
      });
    });
    r.patch(
      `/${kind}/:id/visibility`,
      id,
      body("visibility").isIn(["published", "hidden", "archived"]),
      validate,
      async (req, res) => {
        const item = await Model.findById(req.params.id);
        assert(item && item.visibility !== "deleted", 404, "Post not found");
        assert(
          manage(req.user, item),
          403,
          "Only the owner or administrator can manage visibility",
        );
        assert(
          req.body.visibility !== "hidden" || isAdmin(req.user),
          403,
          "Only administrators can hide posts",
        );
        item.visibility = req.body.visibility;
        await item.save();
        await notify(item.owner, `Your post is now ${item.visibility}: ${item.title}`, `/app/${kind}/${item._id}`, null, { category: "moderation", actor: req.user._id });
        res.json({ item });
      },
    );
    r.post(
      `/${kind}/:id/cover`,
      id,
      rateLimit({
        windowMs: 900000,
        limit: 30,
        keyGenerator: (req) => String(req.user._id),
        standardHeaders: "draft-8",
        legacyHeaders: false,
      }),
      (req, res, next) =>
        upload.single("image")(req, res, (error) =>
          next(
            error
              ? Object.assign(error, {
                  status: error.code === "LIMIT_FILE_SIZE" ? 413 : 422,
                })
              : undefined,
          ),
        ),
      async (req, res) => {
        let item = await Model.findById(req.params.id);
        assert(item && item.visibility !== "deleted", 404, "Post not found");
        assert(
          manage(req.user, item),
          403,
          "Only the owner or administrator can upload",
        );
        assert(req.file, 422, "Choose a supported picture up to 5 MB");
        let data;
        try {
          const image = sharp(req.file.buffer, {
            limitInputPixels: 20000000,
            animated: false,
            failOn: "error",
          });
          const meta = await image.metadata();
          assert(
            ["png", "jpeg", "webp", "gif", "avif", "heif"].includes(
              meta.format,
            ),
            422,
            "Unsupported image",
          );
          data = await image
            .rotate()
            .resize({
              width: 1800,
              height: 1200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();
        } catch {
          assert(false, 422, "Image could not be decoded safely");
        }
        assert(
          data.length <= 3 * 1024 * 1024,
          422,
          "Processed image is too large",
        );
        const hash = createHash("sha256").update(data).digest("hex");
        await mongoose.connection.transaction(async (s) => {
          item = await Model.findOneAndUpdate(
            { _id: req.params.id, visibility: { $ne: "deleted" } },
            {
              $set: {
                cover: `/api/v1/${kind}/${req.params.id}/cover?v=${hash}`,
              },
            },
            { new: true, session: s },
          );
          assert(item, 409, "Post changed");
          await CoverAsset.findOneAndUpdate(
            { kind, record: item._id },
            { $set: { data, hash } },
            { upsert: true, runValidators: true, session: s },
          );
        });
        res.json({ item });
      },
    );
    r.get(`/${kind}/:id/cover`, id, async (req, res) => {
      const item = await Model.findById(req.params.id);
      assert(visible(req.user, item), 404, "Picture not found");
      const asset = await CoverAsset.findOne({ kind, record: item._id }).select(
        "+data",
      );
      assert(asset, 404, "Picture not found");
      res.set({
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        ETag: `"${asset.hash}"`,
      });
      res.send(asset.data);
    });
    r.delete(`/${kind}/:id/cover`, id, async (req, res) => {
      await mongoose.connection.transaction(async (s) => {
        const item = await Model.findById(req.params.id).session(s);
        assert(item && item.visibility !== "deleted", 404, "Post not found");
        assert(
          manage(req.user, item),
          403,
          "Only the owner or administrator can remove",
        );
        item.cover = "";
        await item.save({ session: s });
        await CoverAsset.deleteOne({ kind, record: item._id }, { session: s });
      });
      res.json({ message: "Cover removed" });
    });
  }
  async function book(req, target, manual = false) {
    let result;
    await mongoose.connection.transaction(async (s) => {
      const user = await User.findOne({
        _id: target,
        active: true,
        status: "active",
        role: { $in: ["student", "alumni"] },
      }).session(s);
      assert(user, 404, "Active member not found");
      assert(
        user.phone && PHONE_PATTERN.test(user.phone),
        422,
        "A valid profile phone number is required before booking",
      );
      const event = await Event.findById(req.params.id).session(s);
      assert(event && event.visibility !== "deleted", 404, "Event not found");
      if (manual)
        assert(
          manage(req.user, event),
          403,
          "Only the owner or administrator can manage participants",
        );
      assert(
        !["hidden", "archived"].includes(event.visibility) &&
          event.status === "published" &&
          event.mode !== "recap" &&
          event.startsAt > new Date() &&
          (!event.registrationDeadline ||
            event.registrationDeadline > new Date()),
        409,
        "Registration is closed",
      );
      assert(
        !event.registrations.some(
          (x) => String(x.user) === String(target) && x.status === "registered",
        ),
        409,
        "Already registered",
      );
      assert(
        event.registrations.filter((x) => x.status === "registered").length <
          event.capacity,
        409,
        "Event is full",
      );
      const old = event.registrations.find(
        (x) => String(x.user) === String(target),
      );
      const registration = {
        user: user._id,
        status: "registered",
        registeredAt: new Date(),
        snapshot: {
          name: user.name,
          email: user.email,
          universityId: user.universityId,
          phone: user.phone,
        },
        addedBy: req.user._id,
      };
      if (old) Object.assign(old, registration);
      else event.registrations.push(registration);
      await event.save({ session: s });
      result = eventView(event, req.user);
      await notify(
        user._id,
        `Registered for ${event.title}`,
        `/app/events/${event._id}`,
        s,
        { category: "events", actor: manual ? req.user._id : undefined },
      );
      await notify(event.owner, `${user.name} registered for ${event.title}`, `/app/events/${event._id}`, s, { category: "events", actor: req.user._id });
    });
    return result;
  }
  r.post(
    "/events/:id/register",
    id,
    roles("student", "alumni"),
    async (req, res) =>
      res.status(201).json({ item: await book(req, req.user._id) }),
  );
  r.post(
    "/events/:id/participants",
    id,
    roles("alumni", "admin", "superadmin"),
    body("user").isMongoId(),
    validate,
    async (req, res) =>
      res.status(201).json({ item: await book(req, req.body.user, true) }),
  );
  r.get("/events/:id/member-options", id, async (req, res) => {
    const item = await Event.findById(req.params.id);
    assert(item && item.visibility !== "deleted", 404, "Event not found");
    assert(manage(req.user, item), 403, "Only the owner or administrator can find participants");
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (q.length < 2) return res.json({ items: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const items = await User.find({ active: true, status: "active", role: { $in: ["student", "alumni"] }, $or: ["name", "email", "universityId"].map(k => ({ [k]: { $regex: escaped, $options: "i" } })) }).select("name universityId").limit(20);
    res.json({ items });
  });
  r.get("/events/:id/participants", id, async (req, res) => {
    const item = await Event.findById(req.params.id);
    assert(item, 404, "Event not found");
    assert(
      manage(req.user, item),
      403,
      "Only the owner or administrator can view participants",
    );
    const p = page(req.query.page),
      active = item.registrations.filter((x) => x.status === "registered");
    const rows = active.slice((p - 1) * 20, p * 20);
    await Event.populate(rows, {
      path: "user",
      select: "name email universityId phone",
    });
    res.json({
      items: rows,
      total: active.length,
      page: p,
      pages: Math.ceil(active.length / 20),
    });
  });
  r.patch(
    "/events/:id/registrations",
    id,
    body("user").isMongoId(),
    body("status").equals("cancelled"),
    validate,
    async (req, res) => {
      const item = await Event.findById(req.params.id);
      assert(item, 404, "Event not found");
      assert(
        manage(req.user, item) || String(req.user._id) === req.body.user,
        403,
        "You can only cancel your own registration",
      );
      const updated = await Event.findOneAndUpdate(
        {
          _id: item._id,
          registrations: {
            $elemMatch: { user: req.body.user, status: "registered" },
          },
        },
        { $set: { "registrations.$.status": "cancelled" } },
        { new: true },
      );
      assert(updated, 404, "Active registration not found");
      await notify(
        req.body.user,
        `Registration cancelled for ${item.title}`,
        `/app/events/${item._id}`,
      );
      await notify(item.owner, `Participation removed for ${item.title}`, `/app/events/${item._id}`, null, { category: "events", actor: req.user._id });
      res.json({
        message: "Participation removed; the place is available again",
        item: eventView(updated, req.user),
      });
    },
  );
  return r;
}
