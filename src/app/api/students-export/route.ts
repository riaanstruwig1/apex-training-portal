import * as XLSX from "xlsx";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";

// Basic Excel list of the CFI's students (active, non-archived).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "cfi" && user.role !== "instructor")) return new Response("Not found", { status: 404 });

  // Same-named columns (users.phone / student_profiles.phone) in one join
  // shift values under the sqlite-proxy driver, so query separately and map.
  const us = await db
    .select({ id: users.id, name: users.name, email: users.email, idNo: users.idPassportNumber, phone: users.phone })
    .from(users)
    .where(and(eq(users.role, "student"), eq(users.accountStatus, "active")))
    .orderBy(users.name);
  const ps = await db
    .select({
      userId: studentProfiles.userId,
      phone: studentProfiles.phone,
      status: studentProfiles.status,
      sahpaNumber: studentProfiles.sahpaNumber,
      sahpaExpiry: studentProfiles.sahpaExpiryDate,
    })
    .from(studentProfiles);
  const profileOf = new Map(ps.map((p) => [p.userId, p]));
  const rows = us.flatMap((u) => {
    const p = profileOf.get(u.id);
    if (!p) return [];
    return [{
      name: u.name ?? "",
      email: u.email ?? "",
      idNo: u.idNo,
      userPhone: u.phone,
      profilePhone: p.phone,
      status: p.status,
      sahpaNumber: p.sahpaNumber,
      sahpaExpiry: p.sahpaExpiry,
    }];
  });

  const data: (string | Date)[][] = [["Student Name", "Surname", "ID Number", "SAHPA No", "Expiry Date", "Cell No", "Email"]];
  for (const r of rows) {
    if (r.status === "archived") continue;
    const parts = r.name.trim().split(/\s+/);
    // Keep surname prefixes (van, de, du, le, von, der...) with the surname.
    const PREFIX = new Set(["van", "von", "de", "du", "le", "la", "der", "den", "ten", "ter", "da", "di", "dos"]);
    let si = parts.length - 1;
    while (si > 1 && PREFIX.has(parts[si - 1].toLowerCase())) si--;
    const surname = parts.length > 1 ? parts.slice(si).join(" ") : "";
    const first = parts.length > 1 ? parts.slice(0, si).join(" ") : r.name.trim();
    data.push([
      first,
      surname,
      r.idNo ?? "",
      r.sahpaNumber ?? "",
      r.sahpaExpiry instanceof Date && !isNaN(r.sahpaExpiry.getTime()) ? r.sahpaExpiry.toISOString().slice(0, 10) : "",
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
