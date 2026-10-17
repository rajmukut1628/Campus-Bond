import { bulkMemberRoutes } from "./bulk-members.js";
import { conversionAdminRoutes } from "./lifecycle.js";
import { freshAdministrator } from "./admin-access.js";
import { DEPARTMENTS } from "./catalog.js";
import { memberList, memberQueryRules } from "./member-search.js";
import { activityRoutes } from "./activity.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Router } from "express";
import { body, param } from "express-validator";
import rateLimit from "express-rate-limit";
import { User, VerifiedUser, Ownership, AdminAudit } from "./models.js";
import {
  assert,
  notify,
  notifyAudience,
  roles,
  validate,
  list,
  session as issueSession,
} from "./security.js";
const available = { status: { $ne: "deleted" } };
const tx = (fn) => mongoose.connection.transaction(fn);
const id = [param("id").isMongoId(), validate];
const identity = ["name", "email", "universityId", "department", "batch"];
const pick = (data, keys) =>
  Object.fromEntries(
    keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]),
  );
const text = (key, max) =>
  body(key).isString().trim().isLength({ min: 1, max });
const identityRules = [
  body("batch").optional().isString().trim().isLength({ max: 60 }),
  text("name", 100),
  body("email").isEmail().normalizeEmail({
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
  }),
  body("universityId").if((value, {req}) => !req.adminIdentity).isString().trim().isLength({ min: 1, max: 60 }),
  body("department").optional().isString().trim().isLength({ max: 100 }),
];
const statusRules = [
  body("suspensionDays").optional().isInt({ min: 1, max: 3650 }),
  body("suspensionReason").optional().isString().trim().isLength({ max: 500 }),
  body().custom(v => v.status !== "suspended" || Number.isInteger(Number(v.suspensionDays)) && Number(v.suspensionDays) >= 1 && Number(v.suspensionDays) <= 3650).withMessage("Choose a suspension duration from 1 to 3650 days"),
  body("status").optional().isIn(["active", "suspended", "blocked"]),
  body("active").optional().isBoolean(),
  body().custom(
    (v) => Object.hasOwn(v, "status") || Object.hasOwn(v, "active"),
  ),
  validate,
];
const statusOf = (req) =>
  req.body.status ?? (req.body.active ? "active" : "blocked");
const actor = freshAdministrator;
async function target(req, s, adminOnly = false) {
  const who = await actor(req, s);
  const allowed = adminOnly
    ? ["admin"]
    : who.role === "superadmin"
      ? ["student", "alumni", "admin"]
      : ["student", "alumni"];
  assert(
    !adminOnly || who.role === "superadmin",
    403,
    "Only the Super Admin can manage administrators",
  );
  const user = await User.findOne({
    _id: req.params.id,
    role: { $in: allowed },
    ...available,
  }).session(s);
  assert(user, 403, "This account cannot be managed by your role");
  return user;
}
const audit = async (req, s, action, target, details = "") => {
  await AdminAudit.create([{ actor: req.user._id, target, action, details }], { session: s });
  const affected = await User.findById(target).select("_id").session(s);
  if (affected) await notify(affected._id, `Your account was updated by ${req.user.name}: ${action.replaceAll(".", " ")}${details ? ". " + details : ""}`, "/app/profile", s, { category: "account", actor: req.user._id });
  await notifyAudience({ role: "superadmin" }, `${req.user.name}: ${action.replaceAll(".", " ")}`, "/app/activity", { category: "account", actor: req.user._id }, s);
};
async function linkedUser(record, s) {
  if (!record.claimed) return null;
  const user = await User.findOne(
    record.claimedBy
      ? { _id: record.claimedBy }
      : { email: record.email, universityId: record.universityId },
  ).session(s);
  assert(
    user && user.role === record.role,
    409,
    "Verification record has no matching member; contact the platform operator",
  );
  return user;
}
async function linkedRecord(user, s) {
  if (!["student", "alumni"].includes(user.role)) return null;
  return VerifiedUser.findOne({
    $or: [
      { claimedBy: user._id },
      { email: user.email, universityId: user.universityId },
    ],
  }).session(s);
}
function setStatus(record, status, body = {}, until) {
  record.suspensionUntil = status === "suspended" ? until || new Date(Date.now() + Number(body.suspensionDays) * 86400000) : undefined;
  record.suspensionReason = status === "suspended" ? body.suspensionReason || "" : undefined;
  record.status = status;
  record.active = status === "active";
  if (status === "deleted") record.deletedAt = new Date();
  if (record instanceof User) record.tokenVersion++;
}
async function editMember(req, s, adminOnly, config) {
  const user = await target(req, s, adminOnly);
  const record = await linkedRecord(user, s);
  const editable = ["admin", "superadmin"].includes(user.role) ? ["name", "email"] : identity;
  Object.assign(user, pick(req.body, editable));
  user.tokenVersion++;
  await user.save({ session: s });
  if (record) {
    Object.assign(record, pick(req.body, editable));
    record.claimedBy = user._id;
    await record.save({ session: s });
  }
  await audit(req, s, "member.edit", user._id);
  return user;
}
async function changeMember(req, s, status, adminOnly) {
  const user = await target(req, s, adminOnly);
  const record = await linkedRecord(user, s);
  setStatus(user, status, req.body);
  await user.save({ session: s });
  if (record) {
    setStatus(record, status, req.body, user.suspensionUntil);
    record.claimedBy = user._id;
    await record.save({ session: s });
  }
  await audit(req, s, `member.${status}`, user._id, status === "suspended" ? `Until ${user.suspensionUntil.toISOString()}; ${user.suspensionReason}` : "");
  return user;
}
export function managementRoutes(config) {
  const r = Router();
  r.use(roles("admin", "superadmin"));
  r.get("/admin/users", memberQueryRules, validate, async (req, res) =>
    res.json(await memberList(req)),
  );
  r.post("/admin/users/:id/resend-verification", (req, res) => res.status(410).json({ message: "Email verification is disabled. Members can sign in directly." }));
  r.use(bulkMemberRoutes());
  r.use(activityRoutes());
  r.use(conversionAdminRoutes(config));
  for (const [path, onlyAdmin] of [
    ["/admin/users/:id", false],
    ["/superadmin/admins/:id", true],
  ]) {
    const guard = onlyAdmin
      ? roles("superadmin")
      : roles("admin", "superadmin");
    r.put(path, guard, id, async (req, res, next) => {
      const account = await User.findById(req.params.id).select("role");
      req.adminIdentity = ["admin", "superadmin"].includes(account?.role);
      next();
    }, identityRules, validate, async (req, res) => {
      let user;
      await tx(async (s) => {
        user = await editMember(req, s, onlyAdmin, config);
      });
      res.json({ user, message: "Account updated. The member can sign in directly." });
    });
    r.patch(path, guard, id, statusRules, async (req, res) => {
      let user;
      await tx(async (s) => {
        user = await changeMember(req, s, statusOf(req), onlyAdmin);
      });
      res.json({ user, message: "Account status updated" });
    });
    r.delete(path, guard, id, async (req, res) => {
      await tx((s) => changeMember(req, s, "deleted", onlyAdmin));
      res.json({
        message:
          "Account deleted from active management. Linked history is retained.",
      });
    });
  }
  r.get("/admin/verified-users", async (req, res) =>
    res.json(await list(VerifiedUser, available, req)),
  );
  r.put(
    "/admin/verified-users/:id",
    id,
    identityRules,
    body("role").isIn(["student", "alumni"]),
    validate,
    async (req, res) => {
      let item;
      await tx(async (s) => {
        await actor(req, s);
        item = await VerifiedUser.findOne({
          _id: req.params.id,
          ...available,
        }).session(s);
        assert(item, 404, "Verification record not found");
        const user = await linkedUser(item, s);
        assert(
          !user || req.body.role === user.role,
          409,
          "An activated member role cannot be changed",
        );
        if (!user)
          assert(
            !(await User.exists({
              $or: [
                { email: req.body.email },
                { universityId: req.body.universityId },
              ],
            }).session(s)),
            409,
            "An account already uses this email or university ID",
          );
        Object.assign(item, pick(req.body, [...identity, "role"]));
        if (user) {
          Object.assign(user, pick(req.body, identity));
          user.tokenVersion++;
          await user.save({ session: s });
          item.claimedBy = user._id;
        }
        await item.save({ session: s });
        await audit(req, s, "verification.edit", item._id);
      });
      res.json({ item, message: "Verified account and linked member updated" });
    },
  );
  for (const method of ["patch", "delete"])
    r[method](
      "/admin/verified-users/:id",
      id,
      ...(method === "patch" ? [statusRules] : []),
      async (req, res) => {
        let item;
        await tx(async (s) => {
          await actor(req, s);
          item = await VerifiedUser.findOne({
            _id: req.params.id,
            ...available,
          }).session(s);
          assert(item, 404, "Verification record not found");
          const user = await linkedUser(item, s);
          const status = method === "delete" ? "deleted" : statusOf(req);
          setStatus(item, status, req.body);
          if (user) {
            setStatus(user, status, req.body, item.suspensionUntil);
            await user.save({ session: s });
            item.claimedBy = user._id;
          }
          await item.save({ session: s });
          await audit(req, s, `verification.${status}`, item._id, status === "suspended" ? `Until ${item.suspensionUntil.toISOString()}; ${item.suspensionReason}` : "");
        });
        res.json({
          item,
          message:
            method === "delete"
              ? "Verified account and linked member deleted. History retained."
              : "Verified account and linked member status updated",
        });
      },
    );
  r.get("/superadmin/admins", roles("superadmin"), async (req, res) =>
    res.json(await list(User, { role: "admin", ...available }, req)),
  );
  r.post(
    "/superadmin/admins",
    roles("superadmin"),
    ...identityRules.slice(1, 3),
    body("password")
      .isString()
      .isLength({ min: 11, max: 72 })
      .custom((v) => Buffer.byteLength(v, "utf8") <= 72),
    validate,
    async (req, res) => {
      let user;
      await tx(async (s) => {
        const who = await actor(req, s);
        assert(
          who.role === "superadmin",
          403,
          "Only the Super Admin can create administrators",
        );
        assert(
          !(await VerifiedUser.exists({ email: req.body.email }).session(s)),
          409,
          "A verification record already uses this email",
        );
        [user] = await User.create(
          [
            {
              ...pick(req.body, ["name", "email"]),
              universityId: "ADMIN-" + new mongoose.Types.ObjectId().toString(),
              role: "admin",
              emailVerified: false,
              password: await bcrypt.hash(req.body.password, 12),
            },
          ],
          { session: s },
        );
        await audit(req, s, "administrator.create", user._id);
      });
      res.status(201).json({ user, message: "Administrator created. They can sign in immediately." });
    },
  );
  r.post(
    "/superadmin/ownership/transfer",
    roles("superadmin"),
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.authRateLimit || 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    body("adminId").isMongoId(),
    body("currentPassword").isString().isLength({ min: 1, max: 72 }),
    validate,
    async (req, res) => {
      let previousOwner;
      await tx(async (s) => {
        const owner = await User.findOne({
          _id: req.user._id,
          role: "superadmin",
          active: true,
          ...available,
        })
          .select("+password")
          .session(s);
        assert(
          owner && owner.tokenVersion === req.user.tokenVersion,
          403,
          "Only the current owner can transfer ownership",
        );
        assert(
          await bcrypt.compare(req.body.currentPassword, owner.password),
          400,
          "Current password is incorrect",
        );
        const next = await User.findOne({
          _id: req.body.adminId,
          role: "admin",
          active: true,
          status: { $nin: ["suspended", "blocked", "deleted"] },
        }).session(s);
        assert(next, 409, "Choose a different active administrator");
        let state = await Ownership.findById("platform").session(s);
        if (!state)
          [state] = await Ownership.create(
            [{ _id: "platform", owner: owner._id }],
            { session: s },
          );
        assert(
          String(state.owner) === String(owner._id),
          409,
          "Ownership changed; refresh and try again",
        );
        owner.role = "admin";
        owner.tokenVersion++;
        next.role = "superadmin";
        next.tokenVersion++;
        await owner.save({ session: s });
        await next.save({ session: s });
        state.owner = next._id;
        await state.save({ session: s });
        await audit(
          req,
          s,
          "ownership.transfer",
          next._id,
          `Previous owner: ${owner._id}`,
        );
        previousOwner = owner;
      });
      issueSession(res, previousOwner, config);
      res.json({
        user: previousOwner,
        message:
          "Ownership transferred. You are now an Admin. The new owner must sign in again.",
      });
    },
  );
  return r;
}
