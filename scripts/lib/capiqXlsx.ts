// Shared .xlsx parsing for the CapIQ importers (rd-spend, transactions) —
// reads the raw OOXML inside the file with adm-zip + fast-xml-parser
// (already dependencies) rather than pulling in a dedicated Excel-parsing
// package for what's really just "read some cells out of a zip of XML."
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

export interface XlsxRow {
  [col: string]: string | undefined;
}

function colLetters(ref: string): string {
  return ref.replace(/[0-9]+$/, "");
}

export function parseSheet(xml: string, sharedStrings: string[]): XlsxRow[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);
  const rowsRaw = doc?.worksheet?.sheetData?.row;
  const rows: any[] = Array.isArray(rowsRaw) ? rowsRaw : rowsRaw ? [rowsRaw] : [];
  return rows.map((row) => {
    const cellsRaw = row.c;
    const cells: any[] = Array.isArray(cellsRaw) ? cellsRaw : cellsRaw ? [cellsRaw] : [];
    const out: XlsxRow = {};
    for (const c of cells) {
      const ref = c["@_r"] as string;
      const type = c["@_t"] as string | undefined;
      let val = c.v;
      if (val === undefined || val === null) continue;
      val = String(val);
      if (type === "s") val = sharedStrings[Number(val)] ?? val;
      out[colLetters(ref)] = val;
    }
    return out;
  });
}

export function parseSharedStrings(xml: string): string[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);
  const siRaw = doc?.sst?.si;
  const si: any[] = Array.isArray(siRaw) ? siRaw : siRaw ? [siRaw] : [];
  return si.map((s) => {
    if (typeof s.t === "string") return s.t;
    if (typeof s.t === "object" && s.t !== undefined) return String(s.t["#text"] ?? "");
    // rich text runs (<r><t>...</t></r>) — concatenate
    const runs = Array.isArray(s.r) ? s.r : s.r ? [s.r] : [];
    return runs.map((r: any) => (typeof r.t === "string" ? r.t : r.t?.["#text"] ?? "")).join("");
  });
}

// Reads sheet1 of a real CapIQ Pro export by path, returning parsed rows.
export function loadCapiqSheet(inputPath: string): XlsxRow[] {
  const zip = new AdmZip(readFileSync(resolve(inputPath)));
  const sharedStrings = parseSharedStrings(zip.getEntry("xl/sharedStrings.xml")!.getData().toString("utf8"));
  return parseSheet(zip.getEntry("xl/worksheets/sheet1.xml")!.getData().toString("utf8"), sharedStrings);
}
