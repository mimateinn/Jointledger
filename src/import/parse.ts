import "server-only";
import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import ExcelJS from "exceljs";
import { detectSheetKind } from "./columns";
import type { ParsedSheet, ParsedUpload } from "./types";

export function hashParts(parts: { name: string; bytes: Uint8Array }[]): string {
  const hash = createHash("sha256");
  for (const part of [...parts].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(part.name);
    hash.update(part.bytes);
  }
  return hash.digest("hex");
}

export function parseCsvText(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function stringifyCell(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    return new Decimal(value).toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) {
      return stringifyCell(value.result as ExcelJS.CellValue);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
}

async function parseXlsx(bytes: Uint8Array): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheets: ParsedSheet[] = [];
  workbook.eachSheet((worksheet) => {
    const matrix: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber - 1] = stringifyCell(cell.value);
      });
      for (let i = 0; i < values.length; i += 1) {
        values[i] = values[i] ?? "";
      }
      if (values.some((item) => item.trim() !== "")) {
        matrix.push(values);
      }
    });
    if (matrix.length === 0) {
      return;
    }
    const headers = matrix[0].map((item) => item.trim());
    const rows = matrix.slice(1);
    const name = worksheet.name;
    sheets.push({
      kind: detectSheetKind(name, headers),
      name,
      headers,
      rows,
    });
  });
  return sheets;
}

function sheetFromCsv(name: string, text: string): ParsedSheet {
  const matrix = parseCsvText(text);
  if (matrix.length === 0) {
    return { kind: "unknown", name, headers: [], rows: [] };
  }
  const headers = matrix[0].map((item) => item.trim());
  return {
    kind: detectSheetKind(name, headers),
    name,
    headers,
    rows: matrix.slice(1),
  };
}

export async function parseUpload(files: { name: string; bytes: Uint8Array }[]): Promise<ParsedUpload> {
  if (files.length === 0) {
    throw new Error("要上傳 csv 或 xlsx");
  }
  const filename = files.map((file) => file.name).join(" + ");
  const fileHash = hashParts(files);
  const sheets: ParsedSheet[] = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx")) {
      sheets.push(...(await parseXlsx(file.bytes)));
    } else if (lower.endsWith(".csv")) {
      sheets.push(sheetFromCsv(file.name, new TextDecoder("utf-8").decode(file.bytes)));
    } else {
      throw new Error(`只接受 csv / xlsx：${file.name}`);
    }
  }

  return { filename, fileHash, sheets };
}

export function pickSheets(parsed: ParsedUpload): { transinfo: ParsedSheet; account: ParsedSheet } {
  const transinfo = parsed.sheets.find((sheet) => sheet.kind === "transinfo");
  const account = parsed.sheets.find((sheet) => sheet.kind === "account");
  if (!transinfo || !account) {
    throw new Error("要有 TransInfo 同 Account Detail 兩頁。xlsx 兩個分頁，或兩個 csv 一齊上傳。");
  }
  return { transinfo, account };
}
