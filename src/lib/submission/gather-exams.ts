import "server-only";
import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { examAttempts, exams, users } from "@/db/schema";
import { getExamDetail } from "@/lib/exams";
import { effectiveMarks } from "@/lib/exam-marks";
import { resolveUploadPath } from "@/lib/uploads";
import { ExamCopyData, RadioCertData } from "./types";

async function readUpload(userId: string, file: string | null): Promise<Buffer | null> {
  if (!file) return null;
  const p = resolveUploadPath(userId, file);
  return p ? readFile(p).catch(() => null) : null;
}

/** yyyymmdd in South African time. */
export function ymd(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}${g("month")}${g("day")}`;
}

type Attempt = typeof examAttempts.$inferSelect;
const isPass = (a: Attempt) => (a.resultOverride ? a.resultOverride === "pass" : !!a.passed);

/** Latest verified PASSING attempt per exam for a student. */
async function passedAttempts(studentId: string): Promise<Attempt[]> {
  const rows = await db.select().from(examAttempts).where(and(eq(examAttempts.studentId, studentId), eq(examAttempts.status, "verified")));
  const best = new Map<string, Attempt>();
  for (const a of rows.filter(isPass).sort((x, y) => y.attemptNumber - x.attemptNumber)) {
    if (!best.has(a.examId)) best.set(a.examId, a);
  }
  return [...best.values()];
}

/** Copies of every passed exam (PG, PPG, PPT, radio) for the pack. */
export async function gatherExamCopies(studentId: string, signingInstructorId: string, signingInstructorSignature: Buffer | null): Promise<ExamCopyData[]> {
  const attempts = await passedAttempts(studentId);
  if (!attempts.length) return [];
  const examRows = await db.select().from(exams).where(inArray(exams.id, attempts.map((a) => a.examId)));
  const examById = new Map(examRows.map((e) => [e.id, e]));
  const verifierIds = [...new Set(attempts.map((a) => a.verifiedByUserId).filter((x): x is string => !!x))];
  const verifierRows = verifierIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, verifierIds)) : [];
  const nameOf = new Map(verifierRows.map((v) => [v.id, v.name]));

  const out: ExamCopyData[] = [];
  for (const a of attempts) {
    const ex = examById.get(a.examId);
    if (!ex) continue;
    const isSigner = a.verifiedByUserId === signingInstructorId;
    const base = {
      title: ex.title,
      category: (ex.category as ExamCopyData["category"]) ?? null,
      attemptNumber: a.attemptNumber,
      source: a.source as "online" | "paper",
      verifiedAt: a.verifiedAt,
      scoreMarks: a.scoreMarks,
      totalMarks: a.totalMarks,
      scorePercent: a.scorePercent,
      passPercent: ex.passPercent,
      overrideNote: a.resultOverride === "pass" ? (a.resultOverrideNote ?? "PASS") : null,
      externalLicenceNumber: a.externalLicenseNumber,
      verifiedByName: a.verifiedByUserId ? nameOf.get(a.verifiedByUserId) ?? null : null,
      verifierSignature: isSigner ? signingInstructorSignature : null,
    };
    const proofBytes = a.proofFile ? await readUpload(studentId, a.proofFile) : null;
    const proof = proofBytes && a.proofFile ? { bytes: proofBytes, ext: (a.proofFile.split(".").pop() ?? "bin").toLowerCase() } : null;
    if (a.source === "paper") {
      out.push({ ...base, sections: [], proof });
      continue;
    }
    const detail = await getExamDetail(a.examId, studentId, true, a.id);
    if (!detail) continue;
    out.push({
      ...base,
      proof: null,
      print: { exam: detail.exam, attempt: detail.attempt! },
      sections: detail.exam.sections.map((s) => ({
        code: s.code,
        name: s.name,
        questions: s.questions.map((q) => ({
          code: q.code,
          prompt: q.prompt,
          marks: q.marks,
          awarded: effectiveMarks(q),
          selectedLabel: q.options.find((o) => o.id === q.selectedOptionId)?.label ?? null,
          correctLabel: q.options.find((o) => o.isCorrect)?.label ?? null,
          options: q.options.map((o) => ({ label: o.label, text: o.text ?? "(picture)", isCorrect: !!o.isCorrect })),
          note: q.staffNote,
          changed: q.answerChanged,
        })),
      })),
    });
  }
  return out;
}

/** Radio certificate data once the radio exam is passed and verified; null otherwise. */
export async function gatherRadioCert(studentId: string): Promise<RadioCertData | null> {
  const attempts = await passedAttempts(studentId);
  if (!attempts.length) return null;
  const examRows = await db.select().from(exams).where(inArray(exams.id, attempts.map((a) => a.examId)));
  const rtIds = new Set(examRows.filter((e) => e.category === "rt").map((e) => e.id));
  const a = attempts.filter((x) => rtIds.has(x.examId)).sort((x, y) => (y.verifiedAt?.getTime() ?? 0) - (x.verifiedAt?.getTime() ?? 0))[0];
  if (!a) return null;
  const issuedAt = a.verifiedAt ?? new Date();

  // Reference: DTO0012/yyyymmdd<n>, n = order among radio passes verified the same day.
  const allRt = await db.select().from(examAttempts).where(and(inArray(examAttempts.examId, [...rtIds]), eq(examAttempts.status, "verified")));
  const sameDay = allRt.filter((x) => isPass(x) && x.verifiedAt && ymd(x.verifiedAt) === ymd(issuedAt)).sort((x, y) => (x.verifiedAt!.getTime() - y.verifiedAt!.getTime()) || x.id.localeCompare(y.id));
  const n = Math.max(1, sameDay.findIndex((x) => x.id === a.id) + 1);

  const [stu] = await db.select({ name: users.name }).from(users).where(eq(users.id, studentId)).limit(1);
  const { studentProfiles, pilotProfiles } = await import("@/db/schema");
  const [sp] = await db.select({ s: studentProfiles.sahpaNumber }).from(studentProfiles).where(eq(studentProfiles.userId, studentId)).limit(1);
  const [pp] = await db.select({ s: pilotProfiles.sahpaNumber }).from(pilotProfiles).where(eq(pilotProfiles.userId, studentId)).limit(1);

  let issuerName = "Instructor";
  let issuerLine = "Flight Instructor";
  let issuerSignature: Buffer | null = null;
  let issuerCaaNo: string | null = null;
  if (a.verifiedByUserId) {
    const [v] = await db.select({ name: users.name, role: users.role, sig: users.signatureFile }).from(users).where(eq(users.id, a.verifiedByUserId)).limit(1);
    if (v) {
      issuerName = v.name;
      issuerLine = v.role === "cfi" ? "Chief Flight Instructor (CFI)" : "Flight Instructor";
      issuerSignature = await readUpload(a.verifiedByUserId, v.sig);
      const [ip] = await db.select({ s: pilotProfiles.sacaaNumber }).from(pilotProfiles).where(eq(pilotProfiles.userId, a.verifiedByUserId)).limit(1);
      issuerCaaNo = ip?.s ?? null;
    }
  }
  return {
    studentName: stu?.name ?? "Student",
    sahpaNumber: sp?.s ?? pp?.s ?? null,
    issuedAt,
    ref: `DTO0012/${ymd(issuedAt)}${n}`,
    issuerName,
    issuerLine,
    issuerCaaNo,
    issuerSignature,
    heldLicenceOnFile: a.source === "paper",
  };
}
