"use server";

import { eq, and, inArray } from "drizzle-orm";
import * as z from "zod";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { flightLogEntries, users } from "@/db/schema";
import { requireStudent, requireInstructor } from "@/lib/auth/dal";

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
  const { user } = await requireStudent();

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

  revalidatePath("/student/logbook");
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
  revalidatePath("/student/logbook");
}

// ---------------------------------------------------------------------------
// CSV logbook import (Notes4 item 4). Only four columns from an exported
// CSV map onto this app's logbook: Date, Take Off Site, Aircraft, Duration
// -- everything else (launches, exercises, notes, instructor) isn't in a
// typical exported CSV, so it's left at sensible defaults and the student
// can still edit/add those by hand afterwards. Header matching is
// case/spacing-insensitive so "Take Off Site", "TakeOffSite" and "Site" all
// work the same.
// ---------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES = {
  date: ["date", "flightdate"],
  site: ["takeoffsite", "site", "location", "launchsite"],
  aircraft: ["aircraft", "wing", "glider", "aircrafttype", "wingmotor"],
  duration: ["duration", "durationminutes", "flighttime", "airtime"],
};

function findColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const alias of aliases) {
    const match = normalized.find((h) => h.norm === alias);
    if (match) return match.raw;
  }
  return null;
}

/** Accepts either "H:MM" (hours:minutes) or a plain number already in
 * minutes -- CSV exports vary, and there's no reliable way to tell a lone
 * number apart, so plain numbers are assumed to already be minutes (same
 * convention as the manual entry form). */
function parseDurationMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.includes(":")) {
    const [h, m] = trimmed.split(":").map((n) => Number(n));
    if (Number.isFinite(h) && Number.isFinite(m)) return Math.round(h * 60 + m);
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export type CsvImportState =
  | { error: string; imported?: never }
  | { error?: never; imported: number; skipped: { row: number; reason: string }[] }
  | undefined;

export async function importLogbookCsv(
  _prevState: CsvImportState,
  formData: FormData
): Promise<CsvImportState> {
  const { user } = await requireStudent();

  const file = formData.get("csvFile");
  const flightType = formData.get("flightType");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }
  if (flightType !== "pg" && flightType !== "ppg" && flightType !== "ppt" && flightType !== "winching") {
    return { error: "Choose the flight type these rows should be logged as." };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (!parsed.data.length) {
    return { error: "That CSV has no rows we could read." };
  }

  const headers = parsed.meta.fields ?? [];
  const dateCol = findColumn(headers, HEADER_ALIASES.date);
  const siteCol = findColumn(headers, HEADER_ALIASES.site);
  const aircraftCol = findColumn(headers, HEADER_ALIASES.aircraft);
  const durationCol = findColumn(headers, HEADER_ALIASES.duration);

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
  const skipped: { row: number; reason: string }[] = [];

  parsed.data.forEach((row, i) => {
    const rowNum = i + 2; // header is row 1
    const dateRaw = row[dateCol]?.trim();
    const site = row[siteCol]?.trim();
    const aircraftType = row[aircraftCol]?.trim();
    const durationRaw = row[durationCol]?.trim();

    if (!dateRaw || !site || !aircraftType || !durationRaw) {
      skipped.push({ row: rowNum, reason: "missing a required value" });
      return;
    }
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      skipped.push({ row: rowNum, reason: `couldn't read date "${dateRaw}"` });
      return;
    }
    const durationMinutes = parseDurationMinutes(durationRaw);
    if (!durationMinutes) {
      skipped.push({ row: rowNum, reason: `couldn't read duration "${durationRaw}"` });
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

  if (toInsert.length > 0) {
    await db.insert(flightLogEntries).values(toInsert);
    revalidatePath("/student/logbook");
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
}
