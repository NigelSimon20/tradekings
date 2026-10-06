import { isISODate, type ISODate } from "@/lib/date/dates";

/**
 * A small Excel (.xlsx) writer: a few sheets of text, numbers and dates, a bold
 * frozen header with filters, and column widths. Enough for "export filtered
 * information to Excel" without a spreadsheet library.
 *
 * Text is written as inline strings, which Excel never evaluates, so a cell
 * starting with "=" stays text — no formula injection, unlike CSV.
 */

export type XlsxCell = string | number | null | undefined | { date: ISODate | null };

export interface XlsxColumn {
  header: string;
  /** In characters; Excel's default is about 9. */
  width?: number;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const encoder = new TextEncoder();

const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;

function xml(value: string): string {
  return value
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A, B, … Z, AA, AB … */
function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** Excel's day number: days since 30 Dec 1899. */
export function excelSerial(date: ISODate): number {
  const [year, month, day] = date.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Sheet names: at most 31 characters, none of []:*?/\ and unique. */
function sheetNames(sheets: XlsxSheet[]): string[] {
  const used = new Set<string>();
  return sheets.map((sheet, position) => {
    const base = sheet.name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || `Sheet${position + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 28)} ${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

const STYLE_DATE = 1;
const STYLE_HEADER = 2;

function cell(ref: string, value: XlsxCell, style = 0): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : "";
  if (typeof value === "object") {
    return value.date && isISODate(value.date)
      ? `<c r="${ref}" s="${STYLE_DATE}"><v>${excelSerial(value.date)}</v></c>`
      : "";
  }
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheet(sheet: XlsxSheet): string {
  const width = Math.max(sheet.columns.length, 1);
  const last = `${columnName(width - 1)}${sheet.rows.length + 1}`;
  const cols = sheet.columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? Math.max(10, column.header.length + 2)}" customWidth="1"/>`)
    .join("");
  const header = `<row r="1">${sheet.columns.map((column, index) => cell(`${columnName(index)}1`, column.header, STYLE_HEADER)).join("")}</row>`;
  const body = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      return `<row r="${r}">${row.map((value, index) => cell(`${columnName(index)}${r}`, value)).join("")}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${header}${body}</sheetData>` +
    (sheet.columns.length ? `<autoFilter ref="A1:${last}"/>` : "") +
    `</worksheet>`
  );
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd mmm yyyy"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** The workbook's files, by path inside the zip. */
function workbookFiles(sheets: XlsxSheet[]): [string, string][] {
  const names = sheetNames(sheets);
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `</Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>` +
    `<definedNames>${sheets
      .map((sheet, index) =>
        sheet.columns.length
          ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${xml(names[index].replace(/'/g, "''"))}'!$A$1:$${columnName(sheet.columns.length - 1)}$${sheet.rows.length + 1}</definedName>`
          : "",
      )
      .join("")}</definedNames>` +
    `</workbook>`;
  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  return [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRels],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", workbookRels],
    ["xl/styles.xml", STYLES],
    ...sheets.map((sheet, index): [string, string] => [`xl/worksheets/sheet${index + 1}.xml`, worksheet(sheet)]),
  ];
}

// ---------------------------------------------------------------------------
// A zip with stored (uncompressed) entries — all a .xlsx needs.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: [string, Uint8Array][]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [path, data] of files) {
    const name = encoder.encode(path);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true); // time
    local.setUint16(12, 0x21, true); // date: 1 Jan 1980
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, 0, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  return zip(workbookFiles(sheets).map(([path, content]) => [path, encoder.encode(content)]));
}

/** A download response for a workbook. */
export function xlsxResponse(workbook: Uint8Array, filename: string): Response {
  return new Response(workbook as BodyInit, {
    headers: {
      "content-type": XLSX_MIME,
      "content-disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
      "cache-control": "no-store",
    },
  });
}
