export const DEPARTMENTS = [
  "CSE",
  "EEE",
  "Business Administration",
  "English",
  "Law",
  "Pharmacy",
  "Civil Engineering",
  "Textile Engineering",
  "Public Health",
  "Administration",
  "Other",
];
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,30}$/;
export const secureUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
