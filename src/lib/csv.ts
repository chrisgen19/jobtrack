/**
 * Minimal RFC 4180 CSV writer. Cells that start with =, +, -, @, tab or CR
 * are prefixed with an apostrophe so spreadsheet apps never evaluate them as
 * formulas (CSV injection).
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  // BOM so Excel opens UTF-8 (₱, accents) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
