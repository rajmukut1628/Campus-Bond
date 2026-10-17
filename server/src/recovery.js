import { Router } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User, EmailToken } from "./models.js";
import { assert, validate, notify } from "./security.js";
import { sendAccountEmail, digest, requireMail } from "./mail.js";
export function recoveryRoutes(config) {
  const r = Router(),
    limit = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.recoveryRateLimit || 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    });
  for (const [path, purpose] of [
    ["forgot-password", "reset"],
  ])
    r.post(
      `/auth/${path}`,
      limit,
      body("email")
        .isEmail()
        .normalizeEmail({
          gmail_remove_dots: false,
          gmail_remove_subaddress: false,
          outlookdotcom_remove_subaddress: false,
        }),
      validate,
      async (req, res) => {
        requireMail(config);
        const user = await User.findOne({
          email: req.body.email,
          active: true,
          status: "active",
          ...(purpose === "verify" ? { emailVerified: false } : {}),
        });
        if (user) {
          const recent = await EmailToken.exists({
            user: user._id,
            purpose,
            createdAt: { $gt: new Date(Date.now() - 60000) },
            usedAt: { $exists: false },
          });
          if (!recent) {
            try {
              await sendAccountEmail(user, purpose, config);
            } catch {
              console.error(
                "Account email delivery failed; check SMTP configuration.",
              );
            }
          }
        }
        res.json({
          message:
            "If an eligible account matches this email, a secure link will arrive shortly. Please also check Spam.",
        });
      },
    );
  const token = () =>
    body("token")
      .isString()
      .matches(/^[a-f0-9]{64}$/);
  for (const endpoint of ["/auth/verify-email", "/auth/resend-verification"])
    r.post(endpoint, (req, res) => res.status(410).json({ message: "Email verification is disabled. Sign in directly or use Forgot password." }));
  r.post(
    "/auth/reset-password",
    limit,
    token(),
    body("password")
      .isString()
      .isLength({ min: 11, max: 72 })
      .custom((v) => Buffer.byteLength(v) <= 72),
    validate,
    async (req, res) => {
      const hash = await bcrypt.hash(req.body.password, 12);
      await mongoose.connection.transaction(async (s) => {
        const t = await EmailToken.findOneAndUpdate(
          {
            hash: digest(req.body.token),
            purpose: "reset",
            usedAt: { $exists: false },
            expiresAt: { $gt: new Date() },
          },
          { $set: { usedAt: new Date() } },
          { new: true, session: s },
        );
        assert(t, 400, "This reset link is invalid, expired or already used.");
        const u = await User.findOneAndUpdate(
          { _id: t.user, email: t.email, active: true, status: "active" },
          {
            $set: { password: hash, emailVerified: true },
            $inc: { tokenVersion: 1 },
          },
          { new: true, session: s },
        );
        assert(u, 400, "Account is unavailable or its email has changed.");
        await notify(u._id, "Your password was reset using email recovery. Previous sessions have been revoked.", "/app/profile", s, { category: "account" });
        await EmailToken.updateMany(
          { user: u._id, usedAt: { $exists: false } },
          { $set: { usedAt: new Date() } },
          { session: s },
        );
      });
      res.clearCookie("session", {
        httpOnly: true,
        secure: config.production,
        sameSite: "strict",
        path: "/",
      });
      res.json({ message: "Password reset. Sign in with your new password." });
    },
  );
  return r;
}
