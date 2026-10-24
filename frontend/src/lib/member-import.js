const headers = {
  phone: "phone",
  phonenumber: "phone",
  name: "name",
  fullname: "name",
  email: "email",
  mail: "email",
  universityid: "universityId",
  id: "universityId",
  studentid: "universityId",
  department: "department",
  dept: "department",
  batch: "batch",
  role: "role",
};
export function parseMembers(text) {
  if (typeof text !== "string" || text.length > 256 * 1024)
    throw Error("Use a CSV or pasted table no larger than 256 KB.");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] || "",
    delimiter = first.includes("\t") ? "\t" : ",";
  const table = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const endCell = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
  };
  const endRow = () => {
    endCell();
    if (row.some((v) => v !== "")) table.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell.trim() || closed)
        throw Error(
          "Invalid CSV quotes. Use the template or paste spreadsheet rows.",
        );
      quoted = true;
      cell = "";
    } else if (c === delimiter) endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else if (closed) {
      if (!/\s/.test(c))
        throw Error("Unexpected text after a quoted CSV field.");
    } else cell += c;
  }
  if (quoted) throw Error("A quoted CSV field is not closed.");
  if (cell || row.length) endRow();
  if (table.length < 2)
    throw Error("Include a header row and at least one member.");
  const names = table
    .shift()
    .map((h) => headers[h.toLowerCase().replace(/[\s_-]/g, "")]);
  if (names.some((h) => !h) || new Set(names).size !== names.length)
    throw Error(
      "Use only these headers: name, email, universityId, department, batch, role, phone. Password is entered separately.",
    );
  if (!["name", "email", "universityId"].every((h) => names.includes(h)))
    throw Error("The name, email and universityId columns are required.");
  if (table.length > 100) throw Error("Import at most 100 members at a time.");
  return table.map((values, index) => {
    if (values.length !== names.length)
      throw Error(
        `Row ${index + 2} has ${values.length} columns; expected ${names.length}.`,
      );
    return Object.fromEntries(names.map((h, i) => [h, values[i]]));
  });
}
export function resultCsv(rows) {
  const columns = [
    "phone",
    "name",
    "email",
    "universityId",
    "department",
    "batch",
    "role",
    "status",
    "emailSent",
    "message",
  ];
  const quote = (value) => {
    let s = String(value ?? "");
    if (/^[=+@\t\r-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [columns, ...rows.map((row) => columns.map((k) => row[k]))]
      .map((row) => row.map(quote).join(","))
      .join("\r\n")
  );
}
