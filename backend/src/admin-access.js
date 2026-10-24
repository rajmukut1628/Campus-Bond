import { User, AdminAudit } from "./models.js";
import { assert, notify, notifyAudience } from "./security.js";
export async function freshAdministrator(req, s) {
  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      active: true,
      status: { $nin: ["suspended", "blocked", "deleted"] },
      tokenVersion: req.user.tokenVersion,
      role: { $in: ["admin", "superadmin"] },
    },
    { $inc: { managementVersion: 1 } },
    { new: true, session: s },
  );
  assert(user, 403, "Your management permissions changed. Sign in again.");
  return user;
}
export const managementAudit = async (req, s, action, target) => {
  await AdminAudit.create([{ actor: req.user._id, target, action }], { session: s });
  if (action === "member.provisioned") await notify(target, "Your university account is ready. Complete your profile and explore your community.", "/app/profile", s, { category: "account", actor: req.user._id });
  await notifyAudience({ role: "superadmin" }, `${req.user.name}: ${action.replaceAll(".", " ")}`, "/app/activity", { category: "account", actor: req.user._id }, s);
};
