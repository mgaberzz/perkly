import "server-only";
import ExcelJS from "exceljs";

export type Column<T> = { header: string; value: (row: T) => string | number | null | undefined; width?: number; money?: boolean };

const csvCell = (v: unknown) => {
  if (v == null) return "";
  const s = String(v);
  // Neutralise spreadsheet formula injection, then quote
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv<T>(rows: T[], cols: Column<T>[]) {
  const lines = [cols.map((c) => csvCell(c.header)).join(","), ...rows.map((r) => cols.map((c) => csvCell(c.value(r))).join(","))];
  return "﻿" + lines.join("\r\n"); // BOM so Excel opens Arabic text correctly
}

export async function toXlsx<T>(rows: T[], cols: Column<T>[], sheet: string, rtl = false) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Perkly";
  const ws = wb.addWorksheet(sheet.slice(0, 31), { views: [{ state: "frozen", ySplit: 1, rightToLeft: rtl }] });
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, c.header.length + 2), style: c.money ? { numFmt: "#,##0.00" } : {} }));
  for (const r of rows) {
    ws.addRow(cols.map((c) => {
      const v = c.value(r);
      if (v == null) return null;
      if (typeof v === "string" && /^[=+\-@]/.test(v) && Number.isNaN(Number(v))) return `'${v}`;
      return v;
    }));
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7B2FF7" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function fileResponse<T>(rows: T[], cols: Column<T>[], name: string, format: string, rtl = false) {
  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  const file = `${name}-${stamp}`;
  if (format === "xlsx") {
    const buf = await toXlsx(rows, cols, name, rtl);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(toCsv(rows, cols), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"`, "Cache-Control": "no-store" },
  });
}

/** Cairo-local timestamp, spreadsheet friendly */
export const cairo = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("sv-SE", { timeZone: "Africa/Cairo" }).slice(0, 16) : "";
