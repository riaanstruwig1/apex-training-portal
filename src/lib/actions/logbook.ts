"use server";

import { eq, and, inArray } from "drizzle-orm";
import * as z from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { flightLogEntries, users } from "@/db/schema";
import { requireStudentOrPilot, requireInstructor } from "@/lib/auth/dal";

/** The logbook lives at a different URL for a student vs. a pilot-side
 * account (pilot, or a CFI/instructor's own linked pilot profile) even
 * though it's the same feature and the same rows -- pick the path to
 * revalidate off the acting user's role. */
function logbookPathFor(role: string): string {
  return role === "student" ? "/student/logbook" : "/pilot/logbook";
}

const LogEntrySchema = z.object({
  date: z.string().min(1, { error: "Enter the flight date." }),
  site: z.string().trim().min(1, { error: "Enter the site/location." }),
  aircraftType: z.string().trim().min(1, { error: "Enter the wing/motor used." }),
  flightType: z.enum(["pg", "ppg", "ppt", "winching"]),
  durationMinutes: z.coerce.number().int().min(1, { error: "Enter a duration in minutes." }),
  launches: z.coerce.number().int().min(1).default(1),
  exerciseCodesCovered: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  instructorUserId: z.string().trim().optional(),
});

export type LogEntryState = { error: string } | undefined;

export async function addLogbookEntry(
  _prevState: LogEntryState,
  formData: FormData
): Promise<LogEntryState> {
  const user = await requireStudentOrPilot();

  // Exercises covered is a checklist (multiple checkboxes share this name),
  // not a single field -- collect every checked value.
  const checkedCodes = formData.getAll("exerciseCodesCovered") as string[];

  const parsed = LogEntrySchema.safeParse({
    date: formData.get("date"),
    site: formData.get("site"),
    aircraftType: formData.get("aircraftType"),
    flightType: formData.get("flightType"),
    durationMinutes: formData.get("durationMinutes"),
    launches: formData.get("launches") || 1,
    exerciseCodesCovered: checkedCodes.length ? checkedCodes.join(", ") : undefined,
    notes: formData.get("notes") || undefined,
    instructorUserId: formData.get("instructorUserId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const data = parsed.data;

  // Trust but verify: confirm the picked instructorUserId is actually a
  // current CFI/instructor account before storing it, rather than trusting
  // whatever id a submitted form claims.
  let instructorUserId: string | null = null;
  if (data.instructorUserId) {
    const [staff] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, data.instructorUserId), inArray(users.role, ["cfi", "instructor"])))
      .limit(1);
    instructorUserId = staff?.id ?? null;
  }

  await db.insert(flightLogEntries).values({
    studentId: user.id,
    date: new Date(data.date),
    site: data.site,
    aircraftType: data.aircraftType,
    flightType: data.flightType,
    durationMinutes: data.durationMinutes,
    launches: data.launches,
    exerciseCodesCovered: data.exerciseCodesCovered || null,
    notes: data.notes || null,
    instructorUserId,
  });

  revalidatePath(logbookPathFor(user.role));
}

/** Instructor countersigns a student's logbook entry, with an optional comment. */
export async function verifyLogbookEntry(
  entryId: string,
  studentId: string,
  comment?: string
) {
  const instructor = await requireInstructor();

  await db
    .update(flightLogEntries)
    .set({
      verified: true,
      verifiedByUserId: instructor.id,
      verifiedAt: new Date(),
      instructorComment: comment?.trim() || null,
    })
    .where(eq(flightLogEntries.id, entryId));

  revalidatePath(`/instructor/students/${studentId}`);
  // The owning account could be a student or a pilot-side one -- revalidate
  // both logbook paths rather than looking up the role just for this.
  revalidatePath("/student/logbook");
  revalidatePath("/pilot/logbook");
}

// ---------------------------------------------------------------------------
// CSV/Excel logbook import (Notes4 item 4/30). Only four columns from an
// exported file map onto this app's logbook: Date, Take Off Site, Aircraft,
// Duration -- everything else (launches, exercises, notes, instructor)
// isn't in a typical export, so it's left at sensible defaults and the
// student can still edit/add those by hand afterwards. Header matching is
// case/spacing-insensitive so "Take Off Site", "TakeOffSite" and "Site" all
// work the same. Both plain .csv and .xlsx are accepted (confirmed via
// real-world testing 20 Sep 2026 that flight-tracking apps like FlySkyHy
// export .xlsx, not .csv, with one sheet per year) -- an .xlsx with several
// sheets has every sheet read and combined into one import.
// ---------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES = {
  date: ["date", "flightdate"],
  site: ["takeoffsite", "site", "location", "launchsite"],
  aircraft: ["aircraft", "wing", "glider", "aircrafttype", "wingmotor"],
  // "durationminutes" and "durationdecimal" both match a header literally
  // called "Duration (minutes)" / "Duration (decimal)" once punctuation is
  // stripped -- "minutes" is listed first so it's preferred when an export
  // (like FlySkyHy's) has both columns.
  duration: ["durationminutes", "duration", "durationdecimal", "flighttime", "airtime"],
};

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const alias of aliases) {
    const match = normalized.find((h) => h.norm === alias);
    if (match) return match.raw;
  }
  return null;
}

/** Accepts "H:MM" (hours:minutes), a plain number already in minutes, or
 * (for the "Duration (decimal)" column some exports use instead) a decimal
 * number of hours -- there's no reliable way to tell a lone number apart
 * from decimal-hours vs. minutes, so this is only used as a fallback when
 * no whole-minutes column was found; see durationIsDecimalHours below. */
function parseDurationMinutes(raw: string | number, isDecimalHours = false): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(isDecimalHours ? raw * 60 : raw);
  }
  const trimmed = raw.trim();
  if (trimmed.includes(":")) {
    const [h, m] = trimmed.split(":").map((n) => Number(n));
    if (Number.isFinite(h) && Number.isFinite(m)) return Math.round(h * 60 + m);
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(isDecimalHours ? n * 60 : n);
}

/** A cell can come back as a string (CSV, or a text xlsx cell), a number
 * (a numeric xlsx cell, e.g. duration), or a Date (an xlsx date cell read
 * with cellDates:true) -- this normalizes any of those to a trimmed string
 * for the columns we only ever treat as text (site, aircraft). */
function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Some exports (FlySkyHy among them) pack the aircraft/wing name(s) as a
 * ";"-delimited list, often with stray leading/trailing separators and
 * double spaces, e.g. ";Ozone Speedsters;Airconception  Tornado 280 " --
 * this tidies that into "Ozone Speedsters, Airconception Tornado 280"
 * without dropping or reordering anything, and leaves an already-plain
 * value (the normal case) untouched. */
function cleanAircraftLabel(raw: string): string {
  if (!raw.includes(";")) return raw.trim();
  const parts = raw
    .split(";")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : raw.trim();
}

function parseDateValue(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0, Math.round(d.S ?? 0)));
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

type ImportRow = Record<string, unknown>;
/** One sheet's worth of rows (a plain CSV counts as a single unnamed
 * "sheet") plus a label used only in skipped-row messages, so an .xlsx
 * with several sheets (e.g. one per year) can say which sheet a skipped
 * row came from. */
type ImportSheet = { label: string | null; rows: ImportRow[] };

const XLSX_EXTENSIONS = [".xlsx", ".xls"];
const XLSX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
function looksLikeXlsx(file: File): boolean {
  if (XLSX_MIME_TYPES.includes(file.type)) return true;
  const name = file.name?.toLowerCase() ?? "";
  return XLSX_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export type CsvImportState =
  | { error: string; imported?: never }
  | { error?: never; imported: number; skipped: { row: string; reason: string }[] }
  | undefined;

export async function importLogbookCsv(
  _prevState: CsvImportState,
  formData: FormData
): Promise<CsvImportState> {
  const user = await requireStudentOrPilot();

  const file = formData.get("csvFile");
  const flightType = formData.get("flightType");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (flightType !== "pg" && flightType !== "ppg" && flightType !== "ppt" && flightType !== "winching") {
    return { error: "Choose the flight type these rows should be logged as." };
  }

  let sheets: ImportSheet[];
  if (looksLikeXlsx(file)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch {
      return { error: "Couldn't read that Excel file -- is it a valid .xlsx export?" };
    }
    sheets = workbook.SheetNames.map((name) => ({
      label: workbook.SheetNames.length > 1 ? name : null,
      rows: XLSX.utils.sheet_to_json<ImportRow>(workbook.Sheets[name], { defval: "" }),
    })).filter((s) => s.rows.length > 0);
  } else {
    const text = await file.text();
    const parsed = Papa.parse<ImportRow>(text, { header: true, skipEmptyLines: true });
    sheets = [{ label: null, rows: parsed.data }];
  }

  const allRows = sheets.flatMap((s) => s.rows);
  if (!allRows.length) {
    return { error: "That file has no rows we could read." };
  }

  // Column names are matched once, off the first sheet's headers -- a
  // multi-sheet export (one per year) always repeats the same header row,
  // same as a normal CSV only has one.
  const headers = Object.keys(allRows[0]);
  const dateCol = findColumn(headers, HEADER_ALIASES.date);
  const siteCol = findColumn(headers, HEADER_ALIASES.site);
  const aircraftCol = findColumn(headers, HEADER_ALIASES.aircraft);
  const durationCol = findColumn(headers, HEADER_ALIASES.duration);
  const durationIsDecimalHours = durationCol
    ? normalizeHeader(durationCol) === "durationdecimal"
    : false;

  if (!dateCol || !siteCol || !aircraftCol || !durationCol) {
    const missing = [
      !dateCol && "Date",
      !siteCol && "Take Off Site",
      !aircraftCol && "Aircraft",
      !durationCol && "Duration",
    ]
      .filter(Boolean)
      .join(", ");
    return {
      error: `Couldn't find a column for: ${missing}. Expected headers like Date, Take Off Site, Aircraft, Duration.`,
    };
  }

  const toInsert: (typeof flightLogEntries.$inferInsert)[] = [];
  const skipped: { row: string; reason: string }[] = [];

  for (const sheet of sheets) {
    sheet.rows.forEach((row, i) => {
      const rowLabel = sheet.label ? `${sheet.label}, row ${i + 2}` : `Row ${i + 2}`;
      const dateValue = row[dateCol];
      const site = cellToString(row[siteCol]);
      const aircraftType = cleanAircraftLabel(cellToString(row[aircraftCol]));
      const durationValue = row[durationCol];

      if (dateValue === "" || !site || !aircraftType || durationValue === "") {
        skipped.push({ row: rowLabel, reason: "missing a required value" });
        return;
      }
      const date = parseDateValue(dateValue);
      if (!date) {
        skipped.push({ row: rowLabel, reason: `couldn't read date "${cellToString(dateValue)}"` });
        return;
      }
      const durationMinutes = parseDurationMinutes(
        typeof durationValue === "number" ? durationValue : cellToString(durationValue),
        durationIsDecimalHours
      );
      if (!durationMinutes) {
        skipped.push({
          row: rowLabel,
          reason: `couldn't read duration "${cellToString(durationValue)}"`,
        });
        return;
      }

      toInsert.push({
        studentId: user.id,
        date,
        site,
        aircraftType,
        flightType,
        durationMinutes,
        launches: 1,
      });
    });
  }

  if (toInsert.length > 0) {
    await db.insert(flightLogEntries).values(toInsert);
    revalidatePath(logbookPathFor(user.role));
  }

  return { imported: toInsert.length, skipped };
}

/** Lets the instructor edit/add a comment on an entry that's already verified,
 * without re-triggering the verification itself. */
export async function updateLogbookComment(
  entryId: string,
  studentId: string,
  comment: string
) {
  await requireInstructor();

  await db
    .update(flightLogEntries)
    .set({ instructorComment: comment.trim() || null })
    .where(eq(flightLogEntries.id, entryId));

  revalidatePath(`/instructor/students/${studentId}`);
  revalidatePath("/student/logbook");
  revalidatePath("/pilot/logbook");
}
