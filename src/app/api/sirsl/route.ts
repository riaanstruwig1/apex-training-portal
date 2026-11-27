import * as XLSX from "xlsx";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sirslEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { fmtDate, sirslRef } from "@/lib/sq";

// Batch 111: the SIRSL as an Excel sheet (staff only), same columns as MOP 14.4.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "cfi" && user.role !== "instructor")) return new Response("Not found", { status: 404 });
  const rows = await db.select().from(sirslEntries).orderBy(desc(sirslEntries.number));
  const data: string[][] = [["No.", "DATE", "Area", "EVENT LOG / ACTIVITY", "ACTION", "DATE COMPLETED", "COMMENTS", "BY WHO"]];
  for (const r of rows) {
    data.push([
      sirslRef(r.number), fmtDate(r.entryDate), r.area, r.event, r.action ?? "",
      r.completedAt ? fmtDate(r.completedAt) : "", r.comments ?? "", r.byName ?? "",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 50 }, { wch: 40 }, { wch: 16 }, { wch: 40 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SIRSL");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Apex_SIRSL_${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
