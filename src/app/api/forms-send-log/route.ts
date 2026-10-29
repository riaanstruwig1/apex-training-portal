import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth/dal";
import { getFormsSendLog } from "@/lib/forms-send-log";
import { formatPhone } from "@/lib/invite-message";

// Batch 88: the Forms & procedures send log as an Excel sheet (Admin/CFI).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "cfi" && user.role !== "admin")) return new Response("Not found", { status: 404 });

  const { entries, total } = await getFormsSendLog(100000);
  const data: (string | number)[][] = [["No.", "Date", "Name", "Cell number", "Type", "What was sent", "Documents", "Sent by", "Result", "Note"]];
  entries.forEach((e, i) => {
    data.push([
      total - i,
      e.dateText,
      e.recipientName ?? "",
      formatPhone(e.phone),
      e.kind === "pack" ? "Send pack" : "Document",
      e.title,
      e.documents.join("; "),
      e.sentByName ?? "",
      e.status === "sent" ? "Sent" : e.status === "partial" ? "Partly sent" : "Failed",
      e.detail ?? "",
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 24 }, { wch: 17 }, { wch: 11 }, { wch: 34 }, { wch: 50 }, { wch: 20 }, { wch: 11 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Send log");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Apex_Forms_Send_Log_${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
