import { describe, expect, it } from "vitest";

import { buildXlsx, crc32, excelSerial } from "@/lib/reports/xlsx";

/** The entries of a stored (uncompressed) zip, by name. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    expect(view.getUint32(at + 14, true)).toBe(crc32(data));
    files.set(name, new TextDecoder().decode(data));
    at += 30 + nameLength + size;
  }
  return files;
}

describe("buildXlsx", () => {
  const workbook = unzip(
    buildXlsx([
      {
        name: "Expiries: next/90",
        columns: [{ header: "Name", width: 24 }, { header: "Expiry" }, { header: "Days" }],
        rows: [
          ["=HYPERLINK(\"http://evil\")", { date: "2026-10-06" }, 12],
          ["Ana & <Bob>", { date: null }, null],
        ],
      },
    ]),
  );

  it("contains a complete workbook with checksummed entries", () => {
    expect([...workbook.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("keeps text as text, so a cell can never run as a formula", () => {
    const sheet = workbook.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain("=HYPERLINK(&quot;http://evil&quot;)");
    expect(sheet).toContain("Ana &amp; &lt;Bob&gt;");
  });

  it("writes dates as real dates and numbers as numbers", () => {
    const sheet = workbook.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain(`<c r="B2" s="1"><v>${excelSerial("2026-10-06")}</v></c>`);
    expect(sheet).toContain('<c r="C2"><v>12</v></c>');
    expect(excelSerial("1900-03-01")).toBe(61);
  });

  it("cleans sheet names Excel would refuse", () => {
    expect(workbook.get("xl/workbook.xml")).toContain('name="Expiries  next 90"');
  });
});
