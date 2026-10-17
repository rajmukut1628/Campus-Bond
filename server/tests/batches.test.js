import { describe, it, expect } from "vitest";
import { batchForTerm } from "../../client/src/lib/batches.js";
describe("Batch calculation", () => {
  it("maps prior and future terms continuously around Spring 2022 batch 45", () => {
    expect(batchForTerm("2022", "Spring")).toBe("45");
    expect(batchForTerm("2022", "Summer")).toBe("46");
    expect(batchForTerm("2022", "Fall")).toBe("47");
    expect(batchForTerm("2021", "Fall")).toBe("44");
    expect(batchForTerm("2023", "Spring")).toBe("48");
  });
  it("leaves missing, invalid and non-positive terms unassigned", () => {
    for (const [year, season] of [["", "Spring"], ["2022", ""], ["2022.5", "Spring"], ["2000", "Spring"], ["2022", "Winter"]]) expect(batchForTerm(year, season)).toBe("");
  });
});
