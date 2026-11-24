import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth/dal";
import { ROLE_LABELS, activityTime, getActivityLog } from "@/lib/activity-log";

// Batch 97: the Activity log as an Excel sheet (CFI only).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "cfi") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const rows = await getActivityLog({
    actorId: url.searchParams.get("who") || undefined,
    action: url.searchParams.get("what") || undefined,
    limit: 100000,
  });
  const data: string[][] = [["Date", "Who", "Role", "What", "Student / person", "Details"]];
  for (const r of rows) {
    data.push([
      activityTime(r.at),
      r.actorName ?? "",
      r.actorRole ? ROLE_LABELS[r.actorRole] ?? r.actorRole : "",
      r.label,
      r.targetUserId === r.actorId ? "" : r.targetName ?? "",
      r.details ?? "",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 20 }, { wch: 24 }, { wch: 11 }, { wch: 30 }, { wch: 24 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activity log");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Apex_Activity_Log_${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
