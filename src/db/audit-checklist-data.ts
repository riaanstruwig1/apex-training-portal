/**
 * Batch 111: starter audit checklists, one per row of the MOP 13.4 internal
 * review table (Epic Aviation DTO Procedures Manual, SACAA 0012 DTO), plus a
 * "Previous findings" check. DRAFT wording -- Riaan approves it, and every
 * reference must be checked against the MOP and the CAR text before a real audit.
 */
export type ChecklistSeed = { key: string; title: string; reference: string; items: [string, string][] };

export const CHECKLISTS: ChecklistSeed[] = [
  {
    key: "certificate-ops-spec", title: "Certificate and ops spec review", reference: "MOP 7, 8.1",
    items: [
      ["The DTO certificate is valid and on file.", "MOP 7"],
      ["The training the DTO gives matches the approved operational specification (MOP section 7 list).", "MOP 7"],
      ["The nominated persons (Accountable Manager, Quality, Safety, Head of Training) are current and listed.", "MOP 8.1"],
      ["The Accountable Manager's list of nominated persons with signatures is on file and current.", "MOP 7"],
      ["The DTO name and number on forms and certificates are correct (Paramotor SA (Pty) Ltd, SACAA 0012 DTO).", "MOP 7"],
    ],
  },
  {
    key: "student-files", title: "Student files", reference: "MOP 8.2.4, 14.1, 14.2",
    items: [
      ["Sample of student files: sign-up form, indemnity and consent are signed and on file.", "MOP 14.1"],
      ["Each student's SAHPA number and medical declaration are on file and valid.", "MOP 14.1"],
      ["Student logbooks are complete, dated and signed by the instructor.", "MOP 14.2"],
      ["Exercises are signed off in line with the approved syllabus.", "MOP 15"],
      ["Theory exams are marked, verified and filed.", "MOP 14.1"],
      ["Sign-off packs (CA 62-16, CA 62-15 and certificates) are complete for students signed off.", "MOP 17"],
      ["Records are kept as the MOP requires and only the permitted persons have access (POPIA).", "MOP 14.1"],
    ],
  },
  {
    key: "instructor-files", title: "Instructor files", reference: "MOP 8.1, 17, 18",
    items: [
      ["Every listed instructor has a file with licence, rating and endorsement numbers.", "MOP 8.1"],
      ["Instructor licences, ratings and medicals are valid (check expiry dates).", "MOP 17"],
      ["Instructor SAHPA membership is current.", "MOP 8.1"],
      ["Competency checks are recorded, dated, signed and in date.", "MOP 18"],
      ["The list of instructors and their currencies is current and on record.", "MOP 8.1"],
      ["Instructors keep a logbook with date, course, student, hours, comments and signature.", "MOP 14.2"],
    ],
  },
  {
    key: "incident-accident-reports", title: "Incident and accident reports", reference: "MOP 9.2, 13.2",
    items: [
      ["Every incident and accident was reported through the SAHPA reporting system within the SAHPA timelines.", "MOP 13.2"],
      ["The National Safety Officer was notified of safety matters where required.", "MOP 9.2"],
      ["Accident and incident forms required by the ARO are completed and on file.", "MOP 9.2"],
      ["Each event is recorded in the SIRSL with action, date and who.", "MOP 14.4"],
      ["Actions after each event are completed and signed off.", "MOP 13.4"],
    ],
  },
  {
    key: "safety-occurrences", title: "Safety occurrences", reference: "MOP 13.1, 13.2",
    items: [
      ["Occurrences were reported and recorded within the month they occurred.", "MOP 13.2"],
      ["Reports are handled in a Just Culture way.", "MOP 13.1"],
      ["Hazards raised have a recorded mitigation in the SIRSL.", "MOP 13.2"],
      ["Immediate threats were dealt with immediately.", "MOP 13.2"],
      ["Safety concerns are communicated (WhatsApp group, site briefings, Safety notices).", "MOP 13.2"],
    ],
  },
  {
    key: "theory-training", title: "Theory training and material review", reference: "MOP 15, 17",
    items: [
      ["Theory syllabi and training material are current and match the approved appendices.", "MOP 15"],
      ["Exam papers are the current versions and exams are run as the MOP describes (open book).", "MOP 7"],
      ["Exams are marked and verified by a listed instructor.", "MOP 17"],
      ["Reference books named in the MOP are available to students.", "MOP 7"],
      ["Changes in regulations (Part 62, Part 106 when promulgated) are reflected in the material.", "MOP 7"],
    ],
  },
  {
    key: "practical-training", title: "Practical training and content review", reference: "MOP 15, 17, 18",
    items: [
      ["Practical training follows the approved exercises and syllabus.", "MOP 15"],
      ["Minimum training time rules in the MOP (for example 7 days for ab-initio students) are met.", "MOP Appendix A"],
      ["Each exercise sign-off carries the instructor's name, signature and licence or rating number.", "MOP 17"],
      ["Competency based training and assessment is applied and recorded.", "MOP 18"],
      ["Students use suitable equipment for solo training.", "MOP 7"],
    ],
  },
  {
    key: "sirsl-review", title: "Single Integrated Reporting System Log review", reference: "MOP 13.4, 14.4",
    items: [
      ["The SIRSL is in operation and up to date.", "MOP 14.4"],
      ["Every row has a date, event, action, date completed and a name.", "MOP 14.4"],
      ["Nothing is overdue or left without an action.", "MOP 13.4"],
      ["Audits, corrections, maintenance and accident entries are all in the one log.", "MOP 14.4"],
      ["Logged events were reviewed annually (or immediately where there was a threat).", "MOP 13.2"],
    ],
  },
  {
    key: "aircraft-airworthiness", title: "Aircraft review and airworthiness", reference: "MOP 9.2, 14.3",
    items: [
      ["Aircraft and equipment are checked daily before each flight, and the check is recorded.", "MOP 14.3"],
      ["Equipment returned to use after a period of storage was checked and noted airworthy.", "MOP 14.3"],
      ["Maintenance schedules required by the manufacturer are followed.", "MOP 14.3"],
      ["Equipment is operated within manufacturer limits and the safety envelopes of the authority.", "MOP 13.2"],
      ["Airworthiness checking and safety of all equipment is assured by the Safety Officer.", "MOP 9.2"],
    ],
  },
  {
    key: "equipment", title: "Equipment review", reference: "MOP 8.2.4, 14.3",
    items: [
      ["Wings, motors, harnesses and reserves used for training are listed with their service history.", "MOP 14.3"],
      ["Reserve parachutes are repacked in date.", "MOP 14.3"],
      ["Helmets, radios and other safety equipment are serviceable.", "MOP 14.3"],
      ["Damaged or worn equipment is removed from use and recorded.", "MOP 14.3"],
      ["Winch equipment (where used) is inspected and operated within limits.", "MOP 7"],
    ],
  },
  {
    key: "safety-review", title: "Safety review", reference: "MOP 9.2, 13.1, 13.2, 14.5",
    items: [
      ["A site risk assessment exists for each regularly used site and is reviewed on significant change or once a year.", "MOP 13.2, 14.5"],
      ["Mitigation for each risk is noted in the SIRSL.", "MOP 13.2"],
      ["Safety briefings are given on site before flying.", "MOP 13.2"],
      ["Site rules and regulation changes are monitored.", "MOP 9.2"],
      ["The Safety Officer takes part in the safety training run by the ARO.", "MOP 9.2"],
      ["The safety circle (identify, assess, analyse, decide, implement, monitor) is applied.", "MOP 13.2"],
    ],
  },
  {
    key: "annual-activity-report", title: "Annual activity report completion", reference: "MOP 13.4, 14.5, Appendix C",
    items: [
      ["The annual activity report is completed in the Appendix C layout (all 18 items).", "MOP 14.5"],
      ["Counts of courses, refresher training, students trained, incidents and accidents are correct.", "MOP 13.4"],
      ["At least 2 check dates per year are listed.", "MOP 14.5"],
      ["The report is signed and on record.", "MOP 13.4"],
      ["The report was submitted to the authority when required.", "MOP 13.4.2"],
    ],
  },
  {
    key: "previous-findings", title: "Previous findings follow-up", reference: "MOP 13.4",
    items: [
      ["Every earlier finding has a corrective action recorded.", "MOP 13.4"],
      ["Corrective actions are completed and signed off in the SIRSL.", "MOP 13.4"],
      ["The corrective actions worked: the problem has not come back.", "MOP 13.4"],
      ["Findings that are still open are within their due dates.", "MOP 13.4"],
    ],
  },
];
