"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditChecklistItems, auditChecklists, auditResults, audits,
  occurrenceReports, qsActions, siteSettings, users,
} from "@/db/schema";
import { getCurrentUser, requireCFI } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity-log";
import {
  actionRef, addSirsl, auditRef, fmtDate, getCfiIds, getSqRoles, nextNumber, notifyUsers, occRef,
} from "@/lib/sq";

export type SqState = { error?: string; success?: string; id?: string } | undefined;

const HUB = "Apex Flight Hub";
const clip = (v: FormDataEntryValue | null, n = 2000) => String(v ?? "").trim().slice(0, n);

function refresh() {
  for (const p of ["/instructor/sq", "/instructor/sq/safety", "/instructor/sq/quality", "/instructor/sq/actions", "/instructor/sq/sirsl", "/instructor/dashboard"]) {
    revalidatePath(p);
  }
}

/** Staff (CFI, instructor) -- the people who may use the Safety & Quality screens. */
async function staffUser() {
  const u = await getCurrentUser();
  if (!u || (u.role !== "cfi" && u.role !== "instructor")) return null;
  return u;
}

// ---------------------------------------------------------------------------
// Settings: the Quality person (the Safety Officer already exists, batch 108)
// ---------------------------------------------------------------------------
export async function setQualityPerson(_prev: SqState, formData: FormData): Promise<SqState> {
  const cfi = await requireCFI();
  const id = clip(formData.get("qualityPersonUserId"), 100) || null;
  if (id) {
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (!u || (u.role !== "cfi" && u.role !== "instructor")) return { error: "Choose an instructor." };
  }
  await db
    .insert(siteSettings)
    .values({ id: "singleton", qualityPersonUserId: id })
    .onConflictDoUpdate({ target: siteSettings.id, set: { qualityPersonUserId: id, updatedAt: new Date() } });
  await logActivity(cfi, "quality_person", id, id ? "Set as Quality person" : "Quality person cleared");
  revalidatePath("/instructor/settings");
  refresh();
  return { success: "Saved." };
}

// ---------------------------------------------------------------------------
// Safety (SO): occurrence reports
// ---------------------------------------------------------------------------
const OCC_TYPES = ["accident", "incident", "near_miss", "hazard", "equipment", "other"];
const INJURIES = ["none", "minor", "serious", "fatal"];

/** Anyone signed in can report an occurrence or hazard (Just Culture, MOP 13.1). */
export async function createOccurrence(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const type = clip(formData.get("type"), 30);
  const description = clip(formData.get("description"), 4000);
  const injuries = clip(formData.get("injuries"), 20) || "none";
  const when = clip(formData.get("occurredAt"), 40);
  if (!OCC_TYPES.includes(type)) return { error: "Choose the type of occurrence." };
  if (!INJURIES.includes(injuries)) return { error: "Choose the injuries." };
  if (!description) return { error: "Describe what happened." };
  const occurredAt = when ? new Date(`${when}:00+02:00`) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return { error: "Check the date and time." };

  const number = await nextNumber("occurrence");
  const [row] = await db
    .insert(occurrenceReports)
    .values({
      number, type, occurredAt, injuries, description,
      site: clip(formData.get("site"), 200) || null,
      equipment: clip(formData.get("equipment"), 300) || null,
      people: clip(formData.get("people"), 500) || null,
      damage: clip(formData.get("damage"), 500) || null,
      weather: clip(formData.get("weather"), 300) || null,
      immediateAction: clip(formData.get("immediateAction"), 1000) || null,
      confidential: formData.get("confidential") === "on",
      reporterUserId: user.id,
      reporterName: user.name,
      createdAt: new Date(),
    })
    .returning({ id: occurrenceReports.id });
  await logActivity(user, "occurrence_report", null, `${occRef(number)}: ${type}`);
  await addSirsl({
    area: "safety",
    event: `${occRef(number)} ${type.replace("_", " ")} reported`,
    action: "Review by the Safety Officer",
    by: formData.get("confidential") === "on" ? null : { id: user.id, name: user.name },
    refType: "occurrence",
    refId: row.id,
    date: occurredAt,
  });
  const roles = await getSqRoles(user);
  const serious = injuries === "serious" || injuries === "fatal";
  after(() =>
    notifyUsers([roles.soId], `${HUB}: ${serious ? "URGENT - " : ""}new occurrence report ${occRef(number)} (${type.replace("_", " ")}, injuries: ${injuries}). Please review it in Safety & Quality.`)
  );
  refresh();
  return { success: `${occRef(number)} recorded. The Safety Officer has been told.`, id: row.id };
}

export async function reviewOccurrence(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  if (!roles.so) return { error: "Only the Safety Officer can review occurrence reports." };
  const id = clip(formData.get("id"), 100);
  const mode = clip(formData.get("mode"), 20); // save | close | action
  const soNotes = clip(formData.get("soNotes"), 4000);
  const external = clip(formData.get("externalReportedAt"), 300);
  const [occ] = await db.select().from(occurrenceReports).where(eq(occurrenceReports.id, id)).limit(1);
  if (!occ) return { error: "Report not found." };

  const base = { soNotes: soNotes || null, externalReportedAt: external || null };
  if (mode === "save") {
    await db.update(occurrenceReports).set(base).where(eq(occurrenceReports.id, id));
    await logActivity(user, "occurrence_review", null, `${occRef(occ.number)}: notes saved`);
    refresh();
    return { success: "Saved." };
  }
  if (mode === "close") {
    if (!soNotes) return { error: "Write what was done (for example: immediate intervention made) before closing." };
    const now = new Date();
    await db.update(occurrenceReports).set({ ...base, status: "closed", closedAt: now, closedByName: user.name }).where(eq(occurrenceReports.id, id));
    await addSirsl({
      area: "safety", event: `${occRef(occ.number)} closed`, action: soNotes, completedAt: now,
      comments: external ? `Reported externally: ${external}` : null, by: { id: user.id, name: user.name }, refType: "occurrence", refId: id,
    });
    await logActivity(user, "occurrence_review", null, `${occRef(occ.number)}: closed`);
    refresh();
    return { success: `${occRef(occ.number)} closed and logged.` };
  }
  if (mode === "action") {
    const title = clip(formData.get("actionTitle"), 200);
    const description = clip(formData.get("actionDescription"), 3000);
    const due = clip(formData.get("dueDate"), 20);
    if (!title) return { error: "Say what action the CFI must take." };
    const number = await nextNumber("safety_action");
    const dueDate = due ? new Date(`${due}T17:00:00+02:00`) : null;
    await db.update(occurrenceReports).set({ ...base, status: "action" }).where(eq(occurrenceReports.id, id));
    const [a] = await db
      .insert(qsActions)
      .values({
        number, area: "safety", title, description: description || null, reference: occRef(occ.number),
        sourceType: "occurrence", sourceId: id, raisedByUserId: user.id, raisedByName: user.name, raisedAt: new Date(),
        dueDate, status: "with_cfi",
      })
      .returning({ id: qsActions.id });
    await addSirsl({
      area: "safety", event: `${actionRef("safety", number)} raised from ${occRef(occ.number)}`, action: title,
      by: { id: user.id, name: user.name }, refType: "action", refId: a.id,
    });
    await logActivity(user, "sq_action_raised", null, `${actionRef("safety", number)}: ${title}`);
    const cfis = await getCfiIds();
    after(() => notifyUsers(cfis, `${HUB}: safety action ${actionRef("safety", number)} for the CFI: ${title}${dueDate ? ` (due ${fmtDate(dueDate)})` : ""}.`));
    refresh();
    return { success: `${actionRef("safety", number)} sent to the CFI.` };
  }
  return { error: "Unknown request." };
}

/** A manual safety action or quality finding raised outside an occurrence / audit. */
export async function raiseManualAction(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  const area = clip(formData.get("area"), 10) === "quality" ? "quality" : "safety";
  if ((area === "safety" && !roles.so) || (area === "quality" && !roles.qa)) {
    return { error: area === "safety" ? "Only the Safety Officer can raise safety actions." : "Only the Quality person can raise findings." };
  }
  const title = clip(formData.get("title"), 200);
  if (!title) return { error: "Say what has to be done." };
  const level = area === "quality" ? (clip(formData.get("level"), 2) === "1" ? 1 : 2) : null;
  const due = clip(formData.get("dueDate"), 20);
  const dueDate = due ? new Date(`${due}T17:00:00+02:00`) : null;
  const number = await nextNumber(area === "quality" ? "finding" : "safety_action");
  const [a] = await db
    .insert(qsActions)
    .values({
      number, area, level, title,
      description: clip(formData.get("description"), 3000) || null,
      reference: clip(formData.get("reference"), 200) || null,
      sourceType: "manual", raisedByUserId: user.id, raisedByName: user.name, raisedAt: new Date(), dueDate, status: "with_cfi",
    })
    .returning({ id: qsActions.id });
  const ref = actionRef(area, number);
  await addSirsl({ area, event: `${ref} raised${level ? ` (Level ${level})` : ""}`, action: title, by: { id: user.id, name: user.name }, refType: "action", refId: a.id });
  await logActivity(user, "sq_action_raised", null, `${ref}: ${title}`);
  const cfis = await getCfiIds();
  after(() => notifyUsers(cfis, `${HUB}: ${area === "quality" ? "finding" : "safety action"} ${ref}${level ? ` (Level ${level})` : ""} for the CFI: ${title}.`));
  refresh();
  return { success: `${ref} sent to the CFI.` };
}

// ---------------------------------------------------------------------------
// The shared flow: CFI completes and submits -> SO / QA signs off or returns
// ---------------------------------------------------------------------------
export async function submitAction(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "cfi") return { error: "Only the CFI completes and submits actions." };
  const id = clip(formData.get("id"), 100);
  const response = clip(formData.get("response"), 4000);
  if (!response) return { error: "Write what was done to correct it (and the root cause, if you know it)." };
  const [a] = await db.select().from(qsActions).where(eq(qsActions.id, id)).limit(1);
  if (!a || a.status !== "with_cfi") return { error: "This action is not waiting for the CFI." };
  const now = new Date();
  await db
    .update(qsActions)
    .set({ status: "submitted", cfiResponse: response, cfiUserId: user.id, cfiName: user.name, cfiSubmittedAt: now })
    .where(and(eq(qsActions.id, id), eq(qsActions.status, "with_cfi")));
  const ref = actionRef(a.area, a.number);
  await logActivity(user, "sq_action_submitted", null, `${ref}: ${a.title}`);
  const roles = await getSqRoles(user);
  const signer = a.area === "quality" ? roles.qaId : roles.soId;
  after(() => notifyUsers([signer], `${HUB}: the CFI has completed ${ref} (${a.title}). It is waiting for your sign-off.`));
  refresh();
  return { success: `${ref} submitted for sign-off.` };
}

export async function signOffAction(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  const id = clip(formData.get("id"), 100);
  const decision = clip(formData.get("decision"), 10); // signoff | return
  const comment = clip(formData.get("comment"), 2000);
  const [a] = await db.select().from(qsActions).where(eq(qsActions.id, id)).limit(1);
  if (!a || a.status !== "submitted") return { error: "This action is not waiting for sign-off." };
  const allowed = a.area === "quality" ? roles.qa : roles.so;
  if (!allowed) return { error: a.area === "quality" ? "Only the Quality person signs off findings." : "Only the Safety Officer signs off safety actions." };
  const ref = actionRef(a.area, a.number);
  const now = new Date();
  if (decision === "return") {
    if (!comment) return { error: "Say what is still missing." };
    await db.update(qsActions).set({ status: "with_cfi", returnComment: comment }).where(and(eq(qsActions.id, id), eq(qsActions.status, "submitted")));
    await logActivity(user, "sq_action_returned", null, `${ref}: ${comment.slice(0, 120)}`);
    const cfis = await getCfiIds();
    after(() => notifyUsers(cfis, `${HUB}: ${ref} was returned to you by ${user.name}: ${comment.slice(0, 200)}`));
    refresh();
    return { success: `${ref} returned to the CFI.` };
  }
  await db
    .update(qsActions)
    .set({ status: "closed", signedOffByUserId: user.id, signedOffByName: user.name, signedOffAt: now, signOffComment: comment || null })
    .where(and(eq(qsActions.id, id), eq(qsActions.status, "submitted")));
  await addSirsl({
    area: a.area,
    event: `${ref}${a.level ? ` (Level ${a.level})` : ""}: ${a.title}`,
    action: a.cfiResponse,
    completedAt: now,
    comments: `Done by ${a.cfiName ?? "CFI"}${comment ? `. Sign-off: ${comment}` : ""}`,
    by: { id: user.id, name: user.name },
    refType: "action",
    refId: id,
  });
  if (a.sourceType === "occurrence" && a.sourceId) {
    const siblings = await db.select({ s: qsActions.status }).from(qsActions).where(and(eq(qsActions.sourceId, a.sourceId), eq(qsActions.sourceType, "occurrence")));
    const stillOpen = siblings.some((x) => x.s !== "closed");
    if (!stillOpen) {
      await db.update(occurrenceReports).set({ status: "closed", closedAt: now, closedByName: user.name }).where(eq(occurrenceReports.id, a.sourceId));
    }
  }
  await logActivity(user, "sq_action_signed_off", null, `${ref}: ${a.title}`);
  refresh();
  return { success: `${ref} signed off and logged in the SIRSL.` };
}

export async function addManualSirsl(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  if (!roles.so && !roles.qa) return { error: "Only the Safety Officer or the Quality person adds log entries." };
  const event = clip(formData.get("event"), 500);
  if (!event) return { error: "Describe the event or activity." };
  const done = clip(formData.get("completedAt"), 20);
  await addSirsl({
    area: roles.so && !roles.qa ? "safety" : roles.qa && !roles.so ? "quality" : "general",
    event,
    action: clip(formData.get("action"), 1000) || null,
    completedAt: done ? new Date(`${done}T12:00:00+02:00`) : null,
    comments: clip(formData.get("comments"), 1000) || null,
    by: { id: user.id, name: user.name },
  });
  await logActivity(user, "sirsl_entry", null, event.slice(0, 120));
  refresh();
  return { success: "Added to the SIRSL." };
}

// ---------------------------------------------------------------------------
// Quality (QA): audits
// ---------------------------------------------------------------------------
export async function startAudit(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  if (!roles.qa) return { error: "Only the Quality person can do audits." };
  const checklistId = clip(formData.get("checklistId"), 100);
  const [cl] = await db.select().from(auditChecklists).where(eq(auditChecklists.id, checklistId)).limit(1);
  if (!cl) return { error: "Choose a checklist." };
  const items = await db.select().from(auditChecklistItems).where(eq(auditChecklistItems.checklistId, cl.id)).orderBy(asc(auditChecklistItems.position));
  if (items.length === 0) return { error: "That checklist has no items." };
  const d = clip(formData.get("auditDate"), 20);
  const number = await nextNumber("audit");
  const [row] = await db
    .insert(audits)
    .values({
      number, checklistId: cl.id, checklistTitle: cl.title, scope: clip(formData.get("scope"), 300) || null,
      auditDate: d ? new Date(`${d}T12:00:00+02:00`) : new Date(),
      auditorUserId: user.id, auditorName: user.name, createdAt: new Date(),
    })
    .returning({ id: audits.id });
  await db.insert(auditResults).values(items.map((i) => ({ auditId: row.id, position: i.position, question: i.question, reference: i.reference })));
  await logActivity(user, "audit_started", null, `${auditRef(number)}: ${cl.title}`);
  refresh();
  return { success: `${auditRef(number)} started.`, id: row.id };
}

export async function saveAuditResult(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  if (!roles.qa) return { error: "Only the Quality person can do audits." };
  const id = clip(formData.get("id"), 100);
  const result = clip(formData.get("result"), 20);
  if (!["compliant", "non_compliant", "observation", "na"].includes(result)) return { error: "Pick an answer." };
  const [r] = await db.select().from(auditResults).where(eq(auditResults.id, id)).limit(1);
  if (!r) return { error: "Item not found." };
  const [au] = await db.select().from(audits).where(eq(audits.id, r.auditId)).limit(1);
  if (!au || au.status !== "in_progress") return { error: "This audit is completed and locked." };
  const comment = clip(formData.get("comment"), 1500);
  if ((result === "non_compliant" || result === "observation") && !comment) return { error: "Add a comment for a non-compliance or observation." };
  const level = result === "non_compliant" ? (clip(formData.get("level"), 2) === "1" ? 1 : 2) : null;
  await db
    .update(auditResults)
    .set({ result, comment: comment || null, evidence: clip(formData.get("evidence"), 500) || null, findingLevel: level })
    .where(eq(auditResults.id, id));
  revalidatePath(`/instructor/sq/quality/${au.id}`);
  return { success: "Saved." };
}

export async function completeAudit(_prev: SqState, formData: FormData): Promise<SqState> {
  const user = await staffUser();
  if (!user) return { error: "Staff only." };
  const roles = await getSqRoles(user);
  if (!roles.qa) return { error: "Only the Quality person can do audits." };
  const auditId = clip(formData.get("auditId"), 100);
  const conclusion = clip(formData.get("conclusion"), 3000);
  const [au] = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);
  if (!au) return { error: "Audit not found." };
  if (au.status !== "in_progress") return { error: "Already completed." };
  const results = await db.select().from(auditResults).where(eq(auditResults.auditId, auditId)).orderBy(asc(auditResults.position));
  const open = results.filter((r) => !r.result).length;
  if (open > 0) return { error: `${open} item(s) are not answered yet.` };
  const now = new Date();
  // Claim the audit first so a double click cannot create the findings twice.
  const claimed = await db
    .update(audits)
    .set({ status: "completed", completedAt: now, conclusion: conclusion || null })
    .where(and(eq(audits.id, auditId), eq(audits.status, "in_progress")))
    .returning({ id: audits.id });
  if (claimed.length === 0) return { error: "Already completed." };
  const ref = auditRef(au.number);
  let findings = 0;
  for (const r of results) {
    if (r.result !== "non_compliant") continue;
    const number = await nextNumber("finding");
    const [a] = await db
      .insert(qsActions)
      .values({
        number, area: "quality", level: r.findingLevel ?? 2, title: r.question,
        description: r.comment, reference: [ref, r.reference].filter(Boolean).join(" / "),
        sourceType: "audit", sourceId: auditId, raisedByUserId: user.id, raisedByName: user.name, raisedAt: now,
        status: "with_cfi",
      })
      .returning({ id: qsActions.id });
    await db.update(auditResults).set({ actionId: a.id }).where(eq(auditResults.id, r.id));
    findings++;
  }
  const counts = {
    c: results.filter((r) => r.result === "compliant").length,
    n: results.filter((r) => r.result === "non_compliant").length,
    o: results.filter((r) => r.result === "observation").length,
  };
  await addSirsl({
    area: "quality",
    event: `${ref} ${au.checklistTitle} audit completed`,
    action: findings > 0 ? `${findings} finding(s) sent to the CFI` : "No findings",
    completedAt: now,
    comments: `${counts.c} compliant, ${counts.n} non-compliant, ${counts.o} observation(s)`,
    by: { id: user.id, name: user.name },
    refType: "audit",
    refId: auditId,
  });
  await logActivity(user, "audit_completed", null, `${ref}: ${au.checklistTitle} (${findings} finding(s))`);
  if (findings > 0) {
    const cfis = await getCfiIds();
    after(() => notifyUsers(cfis, `${HUB}: audit ${ref} (${au.checklistTitle}) is complete with ${findings} finding(s) for the CFI. Open Safety & Quality > Actions.`));
  }
  revalidatePath(`/instructor/sq/quality/${auditId}`);
  refresh();
  return { success: `${ref} completed and locked.${findings ? ` ${findings} finding(s) sent to the CFI.` : ""}` };
}
