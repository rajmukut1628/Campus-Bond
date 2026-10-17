import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { validationResult } from "express-validator";
import { User, Mentorship, Notification } from "./models.js";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, status, message) => {
  if (!condition) throw new HttpError(status, message);
};
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({
      message: "Please check the form fields",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  next();
}
export const roles =
  (...allowed) =>
  (req, res, next) => {
    assert(
      allowed.includes(req.user.role),
      403,
      "You do not have permission for this action",
    );
    next();
  };
export const isAdmin = (u) => ["admin", "superadmin"].includes(u.role);
export function auth(config) {
  return async (req, res, next) => {
    let payload;
    try {
      payload = jwt.verify(req.cookies.session || "", config.secret, {
        algorithms: ["HS256"],
        issuer: "university-connect",
        audience: "university-connect-web",
      });
    } catch {
      throw new HttpError(401, "Please sign in again");
    }
    const user = await User.findById(payload.sub);
    assert(
      user?.active &&
        !["suspended", "blocked", "deleted"].includes(user.status) &&
        user.tokenVersion === payload.version,
      401,
      "Session expired or account inactive",
    );
    req.user = user;
    next();
  };
}
export function session(res, user, config) {
  res.cookie(
    "session",
    jwt.sign({ version: user.tokenVersion }, config.secret, {
      subject: String(user._id),
      expiresIn: "8h",
      issuer: "university-connect",
      audience: "university-connect-web",
      algorithm: "HS256",
    }),
    {
      httpOnly: true,
      secure: config.production,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    },
  );
}
export function csrf(config) {
  return (req, res, next) => {
    if (!req.cookies.csrf) {
      const token = randomBytes(32).toString("hex");
      res.cookie("csrf", token, {
        httpOnly: false,
        secure: config.production,
        sameSite: "strict",
        path: "/",
      });
      req.csrfToken = token;
    } else req.csrfToken = req.cookies.csrf;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      assert(!origin || origin === config.origin, 403, "Origin not allowed");
      const supplied = req.get("x-csrf-token") || "";
      const expected = req.cookies.csrf || "";
      assert(
        Buffer.byteLength(supplied) === 64 &&
          Buffer.byteLength(expected) === 64 &&
          timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)),
        403,
        "CSRF token missing or invalid",
      );
    }
    next();
  };
}
export async function acceptedRelationship(user, id, sessionHandle, allowCompleted = false) {
  const q = Mentorship.findOne({
    _id: id,
    status: allowCompleted ? { $in: ["accepted", "completed"] } : "accepted",
    ...(allowCompleted ? { closedForConversion: { $ne: true } } : {}),
    $or: [{ student: user._id }, { mentor: user._id }],
  });
  if (sessionHandle) q.session(sessionHandle);
  const relation = await q;
  assert(
    relation,
    403,
    "Messaging requires an accepted mentorship relationship",
  );
  const accounts = await User.find({
    _id: { $in: [relation.student, relation.mentor] },
    active: true,
  }).session(sessionHandle || null);
  assert(
    accounts.length === 2 &&
      accounts.some((u) => String(u._id) === String(relation.student) && ["student", "alumni"].includes(u.role)) &&
      accounts.some((u) => String(u._id) === String(relation.mentor) && u.role === "alumni"),
    403,
    "This connection is no longer eligible",
  );
  return relation;
}
export function notificationCategory(body, link = "") {
  if (/conversion|alumni-requests/.test(link)) return "reviews";
  if (/messages/.test(link)) return "messages";
  if (/requests/.test(link)) return "mentorship";
  if (/events/.test(link)) return "events";
  if (/jobs/.test(link)) return "careers";
  if (/donations/.test(link)) return "giving";
  if (/feed/.test(link)) return "community";
  return "account";
}
export async function notify(user, body, link, sessionHandle, meta = {}) {
  if (meta.actor && String(meta.actor) === String(user)) return;
  const item = { user, body: body.slice(0, 500), link, category: notificationCategory(body, link), ...meta };
  if (item.eventKey) return Notification.updateOne({ user, eventKey: item.eventKey }, { $setOnInsert: item }, { upsert: true, ...(sessionHandle ? { session: sessionHandle } : {}) });
  return Notification.create([item], sessionHandle ? { session: sessionHandle } : {});
}
export async function notifyAudience(filter, body, link, meta = {}, sessionHandle) {
  const cursor = User.find({ active: true, status: "active", ...filter }).select("_id").session(sessionHandle || null).cursor();
  let rows = [];
  for await (const user of cursor) {
    if (meta.actor && String(meta.actor) === String(user._id)) continue;
    rows.push({ user: user._id, body: body.slice(0, 500), link, category: notificationCategory(body, link), ...meta });
    if (rows.length === 500) { await Notification.insertMany(rows, sessionHandle ? { session: sessionHandle } : {}); rows = []; }
  }
  if (rows.length) await Notification.insertMany(rows, sessionHandle ? { session: sessionHandle } : {});
}
export const page = (req) => {
  const number = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
  return { number, limit: 12, skip: (number - 1) * 12 };
};
export async function list(Model, filter, req, populate) {
  const { number, limit, skip } = page(req);
  let query = Model.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  if (populate) query = query.populate(populate);
  const [items, total] = await Promise.all([
    query,
    Model.countDocuments(filter),
  ]);
  return { items, total, page: number, pages: Math.ceil(total / limit) };
}
export const publicFields =
  "name role department graduationYear bio skills company position experience linkedin avatar mentoring headline batch workExperience qualifications socialLinks";
export const safeUrl = (value) => !value || /^https:\/\/[^\s]+$/i.test(value);
