import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ExcelJS from "exceljs";

const fixtures = resolve("test/fixtures/file-artifacts");

await mkdir(fixtures, { recursive: true });
await writeFile(
  resolve(fixtures, "orders.csv"),
  [
    "order_id,amount,status,created_at",
    "o-001,120.5,open,2026-01-01",
    "o-002,88,closed,2026-01-02",
    "o-003,240,open,2026-01-03",
    "",
  ].join("\n"),
);

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Report");
sheet.getCell("B4").value = "Revenue";
sheet.getRow(5).values = [undefined, "month", "region", "revenue", "target"];
[
  ["2026-01", "APAC", 120, 100],
  ["2026-02", "APAC", 150, 120],
  ["2026-03", "EMEA", 90, 95],
  ["2026-04", "EMEA", 210, 180],
].forEach((row, index) => {
  sheet.getRow(6 + index).values = [undefined, ...row];
});
sheet.getCell("H4").value = "Costs";
sheet.getRow(5).values = [undefined, "month", "region", "revenue", "target", undefined, undefined, "category", "budget", "actual", "variance"];
[
  ["Infrastructure", 80, 70, -10],
  ["Payroll", 120, 130, 10],
  ["Marketing", 40, 35, -5],
].forEach((row, index) => {
  sheet.getRow(6 + index).values = [undefined, "2026-01", "APAC", 120, 100, undefined, undefined, ...row];
});
sheet.getRow(7).values = [undefined, "2026-02", "APAC", 150, 120, undefined, undefined, "Payroll", 120, 130, 10];
sheet.getRow(8).values = [undefined, "2026-03", "EMEA", 90, 95, undefined, undefined, "Marketing", 40, 35, -5];
sheet.getRow(9).values = [undefined, "2026-04", "EMEA", 210, 180];

await workbook.xlsx.writeFile(resolve(fixtures, "report.xlsx"));
console.log(`Wrote fixtures to ${dirname(resolve(fixtures, "report.xlsx"))}`);
