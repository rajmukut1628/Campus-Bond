import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { body, param, query } from "express-validator";
import {
  User,
  VerifiedUser,
  ConversionRequest,
  Mentorship,
  Notification,
  Message,
} from "./models.js";
import { assert, roles, validate } from "./security.js";
import { freshAdministrator, managementAudit } from "./admin-access.js";
import { PHONE_PATTERN, DEPARTMENTS } from "./catalog.js";
import {
  pagingRules,
  queryShape,
  literalMatch,
  paginated,
} from "./member-search.js";
const tx = (fn) => mongoose.connection.transaction(fn);
const passwordRules = body("password")
  .isString()
  .isLength({ min: 11, max: 72 })
  .custom((v) => Buffer.byteLength(v, "utf8") <= 72);
export const provisionRules = [
  body("name").isString().trim().isLength({ min: 2, max: 100 }),
  body("email")
    .isEmail()
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
    }),
  body("universityId").isString().trim().isLength({ min: 1, max: 60 }),
  body("department").isIn(DEPARTMENTS),
  body("phone").optional({ values: "falsy" }).isString().matches(PHONE_PATTERN),
  body("batch").optional().isString().trim().isLength({ max: 60 }),
  body("role").isIn(["student", "alumni"]),
  passwordRules,
  validate,
];
export async function provisionMember(req, config) {
  let user, item;
  await tx(async (s) => {
    const operator = await freshAdministrator(req, s);
    assert(
      !(await User.exists({
        $or: [
          { email: req.body.email },
          { universityId: req.body.universityId },
        ],
      }).session(s)),
      409,
      "This email or university ID already belongs to an account",
    );
    item = await VerifiedUser.findOne({
      $or: [{ email: req.body.email }, { universityId: req.body.universityId }],
    }).session(s);
    if (item)
      assert(
        !item.claimed &&
          item.active &&
          item.status === "active" &&
          item.email === req.body.email &&
          item.universityId === req.body.universityId &&
          item.role === req.body.role,
        409,
        "This verification record is already used, restricted, or does not match",
      );
    const info = Object.fromEntries(
      ["name", "email", "universityId", "department", "batch", "role", "phone"]
        .filter((k) => req.body[k] !== undefined)
        .map((k) => [k, req.body[k]]),
    );
    [user] = await User.create(
      [
        {
          ...info,
          emailVerified: false,
          password: await bcrypt.hash(req.body.password, 12),
          createdBy: operator._id,
        },
      ],
      { session: s },
    );
    if (item) {
      Object.assign(item, Object.fromEntries(Object.entries(info).filter(([key]) => key !== "phone")), { claimed: true, claimedBy: user._id });
      await item.save({ session: s });
    } else
      [item] = await VerifiedUser.create(
        [
          {
            ...Object.fromEntries(Object.entries(info).filter(([key]) => key !== "phone")),
            claimed: true,
            claimedBy: user._id,
            createdBy: operator._id,
          },
        ],
        { session: s },
      );
    await managementAudit(req, s, "member.provisioned", user._id);
  });
  return { user, item, message: "Account created. The member can sign in immediately." };
}
export function studentConversionRoutes() {
  const r = Router();
  r.get(
    "/conversions",
    roles("student", "alumni"),
    pagingRules,
    validate,
    async (req, res) =>
      res.json({
        ...(await paginated(ConversionRequest, { student: req.user._id }, req, {
          sort: { createdAt: -1, _id: -1 },
        })),
        pending: (await ConversionRequest.exists({
          student: req.user._id,
          status: "pending",
        }))
          ? true
          : false,
      }),
  );
  r.get(
    "/mentorships/:id/archive/messages",
    roles("student", "alumni"),
    param("id").isMongoId(),
    pagingRules,
    validate,
    async (req, res) => {
      const relationship = await Mentorship.findOne({
        _id: req.params.id,
        status: "completed",
        closedForConversion: true,
        $or: [{ student: req.user._id }, { mentor: req.user._id }],
      })
        .populate("student", "name avatar")
        .populate("mentor", "name avatar");
      assert(
        relationship,
        403,
        "Only original participants can view this graduation archive",
      );
      assert(
        (await User.countDocuments({
          _id: { $in: [relationship.student._id, relationship.mentor._id] },
          active: true,
          status: "active",
        })) === 2,
        403,
        "This archived connection is unavailable",
      );
      const data = await paginated(
        Message,
        { mentorship: relationship._id },
        req,
        { sort: { createdAt: -1, _id: -1 } },
      );
      await Message.populate(data.items, {
        path: "sender",
        select: "name avatar",
      });
      res.json({ ...data, relationship, readOnly: true });
    },
  );
  r.post(
    "/conversions",
    roles("student"),
    body("graduationYear").isInt({ min: 1950, max: new Date().getFullYear() }),
    body("degree").isString().trim().isLength({ min: 2, max: 160 }),
    body("reason").isString().trim().isLength({ min: 10, max: 2000 }),
    validate,
    async (req, res) => {
      let item;
      await tx(async (s) => {
        const user = await User.findOneAndUpdate(
          {
            _id: req.user._id,
            role: "student",
            active: true,
            status: "active",
            tokenVersion: req.user.tokenVersion,
          },
          { $inc: { conversionVersion: 1 } },
          { new: true, session: s },
        );
        assert(user, 403, "Only an active Student can request conversion");
        [item] = await ConversionRequest.create(
          [
            {
              student: user._id,
              graduationYear: req.body.graduationYear,
              degree: req.body.degree,
              reason: req.body.reason,
              department: user.department,
              batch: user.batch,
            },
          ],
          { session: s },
        );
        const reviewers = await User.find({
          role: { $in: ["admin", "superadmin"] },
          active: true,
          status: "active",
        })
          .select("_id")
          .session(s);
        if (reviewers.length)
          await Notification.insertMany(
            reviewers.map((u) => ({
              user: u._id,
              body: `${user.name} requested Student to Alumni conversion`,
              category: "reviews", actor: user._id,
              link: "/app/alumni-requests",
            })),
            { session: s },
          );
      });
      res.status(201).json({ item });
    },
  );
  return r;
}
export function conversionAdminRoutes(config) {
  const r = Router();
  r.get("/admin/account-options", (req, res) =>
    res.json({ departments: DEPARTMENTS, roles: ["student", "alumni"] }),
  );
  for (const path of ["/admin/users", "/admin/verified-users"])
    r.post(path, provisionRules, async (req, res) =>
      res.status(201).json(await provisionMember(req, config)),
    );
  r.get(
    "/admin/conversions",
    queryShape,
    pagingRules,
    query("status").optional().isIn(["pending", "accepted", "rejected", "all"]),
    query("q").optional().isString().trim().isLength({ max: 100 }),
    validate,
    async (req, res) => {
      const filter = {};
      if (req.query.status !== "all")
        filter.status = req.query.status || "pending";
      if (req.query.q) {
        const users = await User.find({
          $or: ["name", "email", "universityId"].map((k) => ({
            [k]: literalMatch(req.query.q),
          })),
        }).select("_id");
        filter.student = { $in: users.map((u) => u._id) };
      }
      const data = await paginated(ConversionRequest, filter, req, {
        sort: { createdAt: -1, _id: -1 },
      });
      await ConversionRequest.populate(data.items, {
        path: "student",
        select: "name email universityId department batch avatar role status",
      });
      res.json(data);
    },
  );
  r.patch(
    "/admin/conversions/:id",
    param("id").isMongoId(),
    body("status").isIn(["accepted", "rejected"]),
    body("reviewNote").optional().isString().trim().isLength({ max: 1000 }),
    body().custom(
      (v) =>
        v.status !== "rejected" ||
        (typeof v.reviewNote === "string" && v.reviewNote.trim().length >= 5),
    ),
    validate,
    async (req, res) => {
      let item;
      await tx(async (s) => {
        await freshAdministrator(req, s);
        item = await ConversionRequest.findOneAndUpdate(
          { _id: req.params.id, status: "pending" },
          {
            $set: {
              status: req.body.status,
              reviewNote: req.body.reviewNote || "",
              reviewedBy: req.user._id,
              reviewedAt: new Date(),
            },
          },
          { new: true, session: s },
        );
        assert(
          item,
          409,
          "This conversion request was already reviewed or does not exist",
        );
        if (item.status === "accepted") {
          const user = await User.findOneAndUpdate(
            {
              _id: item.student,
              role: "student",
              active: true,
              status: "active",
            },
            {
              $set: {
                role: "alumni",
                graduationYear: item.graduationYear,
                mentoring: false,
              },
              $inc: { tokenVersion: 1, conversionVersion: 1 },
            },
            { new: true, session: s },
          );
          assert(
            user,
            409,
            "The requesting account must still be an active Student",
          );
          const existing = await VerifiedUser.findOne({
            $or: [
              { claimedBy: user._id },
              { email: user.email, universityId: user.universityId },
            ],
          }).session(s);
          if (existing) {
            existing.role = "alumni";
            existing.claimed = true;
            existing.claimedBy = user._id;
            await existing.save({ session: s });
          } else
            await VerifiedUser.create(
              [
                {
                  name: user.name,
                  email: user.email,
                  universityId: user.universityId,
                  department: user.department,
                  batch: user.batch,
                  role: "alumni",
                  claimed: true,
                  claimedBy: user._id,
                  createdBy: req.user._id,
                },
              ],
              { session: s },
            );
          const relationships = await Mentorship.find({
            student: user._id,
            status: { $in: ["pending", "accepted"] },
          }).session(s);
          await Mentorship.updateMany(
            { student: user._id, status: "accepted" },
            {
              $set: { status: "completed", closedForConversion: true },
              $inc: { accessVersion: 1 },
            },
            { session: s },
          );
          await Mentorship.updateMany(
            { student: user._id, status: "pending" },
            { $set: { status: "rejected" }, $inc: { accessVersion: 1 } },
            { session: s },
          );
          if (relationships.length)
            await Notification.insertMany(
              relationships.map((m) => ({
                user: m.mentor,
                body: `${user.name} graduated and became Alumni. The previous Student mentorship is now closed; history is retained.`,
                category: "mentorship", actor: user._id,
                link: "/app/requests",
              })),
              { session: s },
            );
        }
        await Notification.create(
          [
            {
              user: item.student,
              category: "reviews", actor: req.user._id,
              body:
                item.status === "accepted"
                  ? "Your Alumni conversion was accepted. Sign in again to access your Alumni profile."
                  : `Your Alumni conversion was rejected: ${item.reviewNote}`,
              link: "/app/conversion",
            },
          ],
          { session: s },
        );
        await managementAudit(
          req,
          s,
          "conversion." + item.status,
          item.student,
        );
      });
      res.json({
        item,
        message:
          item.status === "accepted"
            ? "Converted to Alumni. The same account and all history are retained."
            : "Request rejected. The account remains Student.",
      });
    },
  );
  return r;
}
