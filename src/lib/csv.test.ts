import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Acme, Inc.")).toBe('"Acme, Inc."');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1234")).toBe("'+1234");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("keeps numbers and empty values", () => {
    expect(csvCell(125000.5)).toBe("125000.5");
    expect(csvCell(null)).toBe("");
  });

  it("builds a BOM-prefixed CRLF document", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a,b\r\n1,x\r\n");
  });
});
