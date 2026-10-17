import rateLimit from "express-rate-limit";
import { Router } from "express";
import { body, param } from "express-validator";
import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { User, AvatarAsset } from "./models.js";
import { assert, validate } from "./security.js";
import { secureUrl, PHONE_PATTERN } from "./catalog.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter(req, file, cb) {
    const types = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
    ];
    const ext = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];
    if (
      !types.includes(file.mimetype) ||
      !ext.includes(path.extname(file.originalname).toLowerCase())
    )
      return cb(
        Object.assign(
          new Error("Upload a PNG, JPG, JPEG, WebP, GIF or AVIF image"),
          { status: 422 },
        ),
      );
    cb(null, true);
  },
});
const profileRules = [
  body("interests").optional().isArray({ max: 10 }),
  body("interests.*").optional().isString().isLength({ min: 1, max: 60 }),
  body("name").optional().isString().trim().isLength({ min: 2, max: 100 }),
  body("headline").optional().isString().trim().isLength({ max: 160 }),
  body("bio").optional().isString().isLength({ max: 2000 }),
  body("phone").optional({ values: "falsy" }).isString().matches(PHONE_PATTERN),
  body("skills").optional().isArray({ max: 20 }),
  body("skills.*").optional().isString().trim().isLength({ min: 1, max: 60 }),
  body("linkedin").optional().custom(secureUrl),
  body("position").optional().isString().isLength({ max: 120 }),
  body("company").optional().isString().isLength({ max: 120 }),
  body("experience").optional().isString().isLength({ max: 3000 }),
  body("mentoring").optional().isBoolean(),
  body("socialLinks").optional().isArray({ max: 10 }),
  body("socialLinks.*.label").isString().trim().isLength({ min: 1, max: 40 }),
  body("socialLinks.*.url")
    .isString()
    .isLength({ min: 8, max: 500 })
    .custom(secureUrl),
  body("qualifications").optional().isArray({ max: 20 }),
  body("qualifications.*.title")
    .isString()
    .trim()
    .isLength({ min: 1, max: 160 }),
  body("qualifications.*.institution")
    .isString()
    .trim()
    .isLength({ min: 1, max: 160 }),
  body("qualifications.*.year")
    .optional({ values: "falsy" })
    .isInt({ min: 1950, max: 2100 }),
  body("workExperience")
    .optional()
    .isArray({ max: 20 })
    .custom((v, { req }) => req.user.role === "alumni"),
  body("workExperience.*.company")
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 }),
  body("workExperience.*.position")
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 }),
  body("workExperience.*.location")
    .optional()
    .isString()
    .isLength({ max: 160 }),
  body("workExperience.*.description")
    .optional()
    .isString()
    .isLength({ max: 2000 }),
  body("workExperience.*.startDate").optional({ values: "falsy" }).isISO8601(),
  body("workExperience.*.endDate").optional({ values: "falsy" }).isISO8601(),
  body("workExperience.*.current").optional().isBoolean(),
  body("workExperience")
    .optional()
    .custom((rows) =>
      rows.every(
        (r) =>
          !r.startDate ||
          !r.endDate ||
          new Date(r.startDate) <= new Date(r.endDate),
      ),
    ),
  validate,
];
export function profileRoutes() {
  const r = Router();
  r.patch("/users/me", profileRules, async (req, res) => {
    const administrator = ["admin", "superadmin"].includes(req.user.role);
    const keys = administrator ? ["interests", "name", "bio", "phone", "position"] : [
      "interests",
      "name",
      "headline",
      "bio",
      "phone",
      "skills",
      "linkedin",
      "qualifications",
      "socialLinks",
    ];
    if (req.user.role === "alumni")
      keys.push(
        "position",
        "company",
        "experience",
        "mentoring",
        "workExperience",
      );
    if (["admin", "superadmin"].includes(req.user.role)) keys.push("position");
    const data = Object.fromEntries(
      keys
        .filter((k) => req.body[k] !== undefined)
        .map((k) => [k, req.body[k]]),
    );
    if (data.socialLinks)
      data.socialLinks = data.socialLinks.map((v) => ({
        label: v.label,
        url: v.url,
      }));
    if (data.qualifications)
      data.qualifications = data.qualifications.map((v) => ({
        title: v.title,
        institution: v.institution,
        ...(v.year ? { year: Number(v.year) } : {}),
      }));
    if (data.workExperience)
      data.workExperience = data.workExperience.map((v) => ({
        company: v.company,
        position: v.position,
        location: v.location || "",
        description: v.description || "",
        current: v.current === true || v.current === "true",
        ...(v.startDate ? { startDate: v.startDate } : {}),
        ...(!v.current && v.endDate ? { endDate: v.endDate } : {}),
      }));
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, active: true, status: "active" },
      { $set: data },
      { new: true, runValidators: true },
    );
    assert(user, 401, "This account is no longer active");
    res.json({ user });
  });
  r.post(
    "/users/me/avatar",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      keyGenerator: (req) => String(req.user._id),
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    (req, res, next) =>
      upload.single("image")(req, res, (error) => {
        if (error)
          return next(
            Object.assign(error, {
              status: error.code === "LIMIT_FILE_SIZE" ? 413 : 422,
            }),
          );
        next();
      }),
    async (req, res) => {
      assert(req.file, 422, "Choose an image to upload");
      let buffer, info;
      try {
        const image = sharp(req.file.buffer, {
          limitInputPixels: 20000000,
          animated: false,
          failOn: "error",
        });
        const metadata = await image.metadata();
        assert(
          ["png", "jpeg", "webp", "gif", "avif", "heif"].includes(
            metadata.format,
          ),
          422,
          "Unsupported image contents",
        );
        const result = await image
          .rotate()
          .resize({
            width: 1200,
            height: 1200,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer({ resolveWithObject: true });
        buffer = result.data;
        info = result.info;
      } catch (error) {
        throw Object.assign(
          new Error(
            "This image could not be decoded safely. Choose another picture.",
          ),
          { status: 422 },
        );
      }
      assert(
        buffer.length <= 2 * 1024 * 1024,
        422,
        "The processed image is too large. Choose a smaller picture",
      );
      const hash = createHash("sha256").update(buffer).digest("hex");
      let user;
      await mongoose.connection.transaction(async (s) => {
        user = await User.findOneAndUpdate(
          { _id: req.user._id, active: true, status: "active" },
          {
            $set: { avatar: `/api/v1/users/${req.user._id}/avatar?v=${hash}` },
          },
          { new: true, session: s },
        );
        assert(user, 401, "Account is no longer active");
        await AvatarAsset.findOneAndUpdate(
          { user: req.user._id },
          {
            $set: {
              data: buffer,
              mime: "image/webp",
              hash,
              width: info.width,
              height: info.height,
            },
          },
          { upsert: true, runValidators: true, session: s },
        );
      });
      res.json({ user });
    },
  );
  r.delete("/users/me/avatar", async (req, res) => {
    let user;
    await mongoose.connection.transaction(async (s) => {
      user = await User.findOneAndUpdate(
        { _id: req.user._id, active: true, status: "active" },
        { $set: { avatar: "" } },
        { new: true, session: s },
      );
      assert(user, 401, "Account is no longer active");
      await AvatarAsset.deleteOne({ user: req.user._id }, { session: s });
    });
    res.json({ user });
  });
  r.get(
    "/users/:id/avatar",
    param("id").isMongoId(),
    validate,
    async (req, res) => {
      assert(
        await User.exists({
          _id: req.params.id,
          active: true,
          status: "active",
        }),
        404,
        "Profile picture not found",
      );
      const asset = await AvatarAsset.findOne({ user: req.params.id }).select(
        "+data",
      );
      assert(asset, 404, "Profile picture not found");
      res.set({
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
        ETag: `"${asset.hash}"`,
        "X-Content-Type-Options": "nosniff",
      });
      if (req.get("if-none-match") === `"${asset.hash}"`)
        return res.status(304).end();
      res.send(asset.data);
    },
  );
  return r;
}
