export const SEASONS = ["Spring", "Summer", "Fall"];
export function batchForTerm(year, season) {
  if (!/^\d{4}$/.test(String(year)) || Number(year) < 1950 || Number(year) > 2100 || !SEASONS.includes(season)) return "";
  const batch = 45 + (Number(year) - 2022) * 3 + SEASONS.indexOf(season);
  return batch > 0 ? String(batch) : "";
}
