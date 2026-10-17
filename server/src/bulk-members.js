import { Router } from "express";
import { body } from "express-validator";
import { User, VerifiedUser } from "./models.js";
import { provisionRules } from "./lifecycle.js";
import { roles, validate } from "./security.js";
const keys = [
  "phone",
  "name",
  "email",
  "universityId",
  "department",
  "batch",
  "role",
  "password",
];
export function bulkMemberRoutes() {
  const r = Router();
  r.post(
    "/admin/users/bulk-preview",
    roles("admin", "superadmin"),
    body("members").isArray({ min: 1, max: 100 }),
    body("members.*").isObject({ strict: true }),
    validate,
    async (req, res) => {
      const rows = [];
      for (let index = 0; index < req.body.members.length; index++) {
        const source = req.body.members[index],
          input = Object.fromEntries(
            keys
              .filter((k) => Object.hasOwn(source, k))
              .map((k) => [k, source[k]]),
          ),
          candidate = { body: input };
        const errors = [];
        for (const rule of provisionRules.filter(
          (rule) => typeof rule.run === "function",
        )) {
          const result = await rule.run(candidate);
          for (const e of result.array())
            if (!errors.some((v) => v.field === e.path))
              errors.push({
                field: e.path,
                message:
                  e.path === "password"
                    ? "Use at least 11 characters and at most 72 UTF-8 bytes"
                    : e.path === "email"
                      ? "Enter a valid email address"
                      : e.path === "role"
                        ? "Choose Student or Alumni"
                        : e.path === "department"
                          ? "Choose a department from the list"
                          : `Check ${e.path}`,
              });
        }
        rows.push({ index, input, errors });
      }
      for (const row of rows) {
        for (const field of ["email", "universityId"])
          if (
            typeof row.input[field] === "string" &&
            row.input[field] &&
            rows.some(
              (other) =>
                other.index !== row.index &&
                other.input[field] === row.input[field],
            )
          )
            row.errors.push({
              field,
              message: `Duplicate ${field === "email" ? "email" : "University ID"} in this list`,
            });
      }
      const emails = rows
          .map((r) => r.input.email)
          .filter((v) => typeof v === "string"),
        ids = rows
          .map((r) => r.input.universityId)
          .filter((v) => typeof v === "string");
      const filter = {
        $or: [{ email: { $in: emails } }, { universityId: { $in: ids } }],
      };
      const [users, verified] = await Promise.all([
        User.find(filter).select("email universityId").lean(),
        VerifiedUser.find(filter),
      ]);
      for (const row of rows) {
        const v = row.input;
        if (
          users.some(
            (u) => u.email === v.email || u.universityId === v.universityId,
          )
        )
          row.errors.push({
            field: "identity",
            message: "Email or University ID is already reserved by an account",
          });
        const matches = verified.filter(
          (u) => u.email === v.email || u.universityId === v.universityId,
        );
        if (
          matches.some(
            (u) =>
              u.claimed ||
              !u.active ||
              u.status !== "active" ||
              u.email !== v.email ||
              u.universityId !== v.universityId ||
              u.role !== v.role,
          )
        )
          row.errors.push({
            field: "identity",
            message:
              "Verification record is already used, restricted or does not match",
          });
      }
      const items = rows.map(({ index, input, errors }) => ({
        index,
        member: Object.fromEntries(
          Object.entries(input).filter(([k]) => k !== "password"),
        ),
        valid: errors.length === 0,
        errors,
      }));
      res
        .set("Cache-Control", "no-store")
        .json({
          items,
          total: items.length,
          ready: items.filter((r) => r.valid).length,
          invalid: items.filter((r) => !r.valid).length,
        });
    },
  );
  return r;
}
