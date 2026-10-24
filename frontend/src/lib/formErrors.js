export function fieldErrors(error, fields) {
  const names=new Set(fields.map(field=>field.name)), result={};
  for(const entry of error?.response?.data?.errors || []) if(names.has(entry.field) && !result[entry.field]) result[entry.field]=entry.message === "Invalid value" ? "Please check this value." : entry.message;
  return result;
}
