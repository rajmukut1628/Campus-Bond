import { describe, it, expect } from "vitest";
import { parseMembers, resultCsv } from "../../client/src/lib/member-import.js";
describe("Member CSV and spreadsheet parsing", () => {
  it("preserves leading-zero contact numbers for bulk account creation", () => {
    const rows = parseMembers("name,email,id,phone\nReal Member,member@example.com,01220100002,01744439466");
    expect(rows[0].phone).toBe("01744439466");
    expect(rows[0].universityId).toBe("01220100002");
  });
  it("preserves leading-zero IDs and accepts BOM, spreadsheet tabs and header aliases", () => {
    const rows = parseMembers(
      "\uFEFFFull Name\tEmail\tUniversity ID\tBatch\r\nTest Member\ttest@example.com\t001234\t50\r\n",
    );
    expect(rows).toEqual([
      {
        name: "Test Member",
        email: "test@example.com",
        universityId: "001234",
        batch: "50",
      },
    ]);
  });
  it("handles quoted commas, doubled quotes and multiline cells", () => {
    const rows = parseMembers(
      'name,email,universityId\n"Member, A ""B""",member@example.com,ID1\n"Second\nMember",other@example.com,ID2',
    );
    expect(rows[0].name).toBe('Member, A "B"');
    expect(rows[1].name).toBe("Second\nMember");
  });
  it("rejects broken CSV, missing or duplicate headers, passwords in files and uneven rows", () => {
    for (const input of [
      "name,email\nA,a@example.com",
      "name,email,id,id\nA,a@example.com,A,B",
      "name,email,id,password\nA,a@example.com,A,secret",
      'name,email,id\n"Unclosed,a@example.com,A',
      "name,email,id\nA,a@example.com",
      'name,email,id\n"A"tail,a@example.com,A',
    ])
      expect(() => parseMembers(input)).toThrow();
  });
  it("bounds imports to 100 members and 256 KB", () => {
    const line = (i) => `Member ${i},member${i}@example.com,ID${i}`;
    expect(
      parseMembers(
        "name,email,id\n" +
          Array.from({ length: 100 }, (_, i) => line(i)).join("\n"),
      ),
    ).toHaveLength(100);
    expect(() =>
      parseMembers(
        "name,email,id\n" +
          Array.from({ length: 101 }, (_, i) => line(i)).join("\n"),
      ),
    ).toThrow("100");
    expect(() => parseMembers("x".repeat(256 * 1024 + 1))).toThrow("256 KB");
  });
  it("exports results without passwords and neutralizes spreadsheet formulas", () => {
    const csv = resultCsv([
      {
        name: "=DANGEROUS()",
        email: "a@example.com",
        universityId: "001",
        status: "created",
        password: "DoNotExport!",
      },
    ]);
    expect(csv).toContain("'=DANGEROUS()");
    expect(csv).not.toContain("DoNotExport");
    expect(csv).not.toContain("password");
    expect(csv).toContain('"001"');
  });
});
