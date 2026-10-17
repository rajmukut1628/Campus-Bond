import { query } from "express-validator";
import { User } from "./models.js";
import { assert } from "./security.js";
export const literalPattern = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Construct RegExp from a fully escaped literal; query operators never reach MongoDB.
export function literalMatch(value) {
  return {
    $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    $options: "i",
  };
}
export const pagingRules = [
  query("page").optional().isInt({ min: 1, max: 100000 }).toInt(),
];
export const queryShape = query()
  .custom(
    (value) =>
      Object.keys(value).every((key) => !/[\[\]$]/.test(key)) &&
      Object.values(value).every((item) => typeof item === "string"),
  )
  .withMessage("Invalid query parameters");
export const memberQueryRules = [
  queryShape,
  ...pagingRules,
  query("role").optional().isIn(["all", "student", "alumni", "admin"]),
  query("q").optional().isString().trim().isLength({ max: 100 }),
  query("batch").optional().isString().trim().isLength({ max: 60 }),
  query("department").optional().isString().trim().isLength({ max: 100 }),
];
export async function paginated(
  Model,
  filter,
  req,
  { select, sort = { name: 1, _id: 1 } } = {},
) {
  const page = Number(req.query.page) || 1,
    limit = 20;
  let find = Model.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (select) find = find.select(select);
  const [items, total] = await Promise.all([
    find.lean(),
    Model.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit), limit };
}
export async function memberList(req) {
  const { q = "", batch = "", department = "" } = req.query;
  const permitted =
    req.user.role === "superadmin"
      ? ["student", "alumni", "admin"]
      : ["student", "alumni"];
  const chosen =
    req.query.role || (q || batch || department ? "all" : "student");
  assert(
    chosen === "all" || permitted.includes(chosen),
    403,
    "Your role cannot view those accounts",
  );
  const filter = {
    status: { $ne: "deleted" },
    role: chosen === "all" ? { $in: permitted } : chosen,
  };
  if (q)
    filter.$or = ["name", "email", "universityId", "batch", "department"].map(
      (field) => ({ [field]: literalMatch(q) }),
    );
  if (batch) filter.batch = /^\d+$/.test(batch) && !(Number(batch) >= 1950 && Number(batch) <= 2100) ? batch : literalMatch(batch);
  if (department) filter.department = literalMatch(department);
  return {
    ...(await paginated(User, filter, req, {
      select:
        "name email universityId role status active department batch createdAt emailVerified suspensionUntil suspensionReason",
    })),
    effectiveRole: chosen,
  };
}
