const memberRoles = ["student", "alumni"];
const adminRoles = ["admin", "superadmin"];
export function canAccessRoute(role, pathname) {
  const section = pathname.split("/")[2] || "";
  if (["admins", "activity"].includes(section)) return role === "superadmin";
  if (["users", "verified", "alumni-requests"].includes(section)) return adminRoles.includes(role);
  if (["mentors", "requests", "archives", "conversion"].includes(section)) return memberRoles.includes(role);
  return true;
}
// A fresh sign-in always starts a new account context, never a previous account's URL.
export function loginDestination() {
  return "/app/feed";
}
