import * as XLSX from "xlsx";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";

// Basic Excel list of the CFI's students (active, non-archived).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "cfi" && user.role !== "instructor")) return new Response("Not found", { status: 404 });

  const rows = await db
    .select({
      name: users.name,
      email: users.email,
      idNo: users.idPassportNumber,
      userPhone: users.phone,
      profilePhone: studentProfiles.phone,
      status: studentProfiles.status,
      sahpaNumber: studentProfiles.sahpaNumber,
      sahpaExpiry: studentProfiles.sahpaExpiryDate,
    })
    .from(users)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(and(eq(users.role, "student"), eq(users.accountStatus, "active")))
    .orderBy(users.name);

  const data: (string | Date)[][] = [["Student Name", "Surname", "ID Number", "SAHPA No", "Expiry Date", "Cell No", "Email"]];
  for (const r of rows) {
    if (r.status === "archived") continue;
    const parts = r.name.trim().split(/\s+/);
    const surname = parts.length > 1 ? parts[parts.length - 1] : "";
    const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : r.name.trim();
    data.push([
      first,
      surname,
      r.idNo ?? "",
      r.sahpaNumber ?? "",
      r.sahpaExpiry ? r.sahpaExpiry.toISOString().slice(0, 10) : "",
      r.userPhone || r.profilePhone || "",
      r.email,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 13 }, { wch: 16 }, { wch: 34 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Apex_Students_${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
