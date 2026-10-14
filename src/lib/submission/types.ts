// Plain data (no database) the pack builder works from, so the whole pack can
// be built and tested without a live database. gather-pack-data.ts fills this
// from the student's portfolio.

export type SignoffTrainingType = "pg" | "ppg" | "ppt";
export type Grade = "excellent" | "good" | "average" | "need_practice";

export type SkillGrades = {
  takeoff?: Grade;
  landing?: Grade;
  turns360?: Grade;
  ridge?: Grade;
  spot?: Grade;
  engine?: Grade;
  weather?: Grade;
  airlaw?: Grade;
  turbulence?: Grade;
};

export type PackLogEntry = {
  date: Date;
  site: string;
  aircraftType: string;
  flightType: string;
  durationMinutes: number;
  launches: number;
  exerciseCodes: string | null;
  verified: boolean;
  verifiedByName: string | null;
  verifiedAt: Date | null;
  instructorName: string | null;
  instructorComment: string | null;
};

export type ExamCopyQuestion = {
  code: string;
  prompt: string;
  marks: number;
  awarded: number;
  selectedLabel: string | null;
  correctLabel: string | null;
  options: { label: string; text: string; isCorrect: boolean }[];
  note: string | null;
  changed: boolean;
};

/** A passed, verified exam (latest passing attempt) for the pack. */
export type ExamCopyData = {
  title: string;
  category: "pg" | "ppg" | "ppt" | "rt" | null;
  attemptNumber: number;
  source: "online" | "paper";
  verifiedAt: Date | null;
  scoreMarks: number | null;
  totalMarks: number | null;
  scorePercent: number | null;
  passPercent: number;
  overrideNote: string | null;
  externalLicenceNumber: string | null;
  verifiedByName: string | null;
  /** Only the signing instructor's own signature is ever placed here. */
  verifierSignature: Buffer | null;
  sections: { code: string; name: string; questions: ExamCopyQuestion[] }[];
  /** Student's scan for a paper exam / held radio licence. */
  proof: { bytes: Buffer; ext: string } | null;
};

export type RadioCertData = {
  studentName: string;
  sahpaNumber: string | null;
  issuedAt: Date;
  ref: string;
  issuerName: string;
  issuerLine: string;
  issuerCaaNo: string | null;
  issuerSignature: Buffer | null;
  heldLicenceOnFile: boolean;
};

export type PackData = {
  trainingType: SignoffTrainingType;
  signedOffAt: Date;
  dtoName: string;
  dtoNumber: string;

  student: {
    fullName: string;
    surname: string;
    firstNames: string;
    initials: string;
    email: string;
    phone: string;
    idPassport: string;
    dob: Date | null;
    homeAddress: string;
    postalAddress: string;
    apexNumber: string | null;
    callSign: string | null;
    sacaaNumber: string | null;
    sahpaNumber: string | null;
    sahpaExpiry: Date | null;
    licenceNumber: string | null;
    medicalDeclarationSignedAt: Date | null;
    medicalDeclarationExpiresAt: Date | null;
  };

  instructor: {
    fullName: string;
    licenceNumber: string;
  };

  /** Images, already read from disk. A signature is only ever present here
   * when its owner has consented (student) or is the signing user
   * (instructor) -- decided in gather-pack-data.ts, never here. */
  studentSignature: Buffer | null;
  instructorSignature: Buffer | null;
  /** Student's pilot declaration may only be signed when the Hub medical
   * declaration is valid and the student is under 60. */
  medicalSignatureAllowed: boolean;
  profilePicture: Buffer | null;
  idCopy: { bytes: Buffer; ext: string } | null;
  radioCertificate: { bytes: Buffer; ext: string } | null;
  radioExamPassed: boolean;

  skillGrades: SkillGrades;
  remedialAction: string;
  radioExaminerName: string;
  radioExaminerLicence: string;
  callSignChoices: [string, string, string];

  logbook: PackLogEntry[];

  /** Course certificate reference (DTO012/yyyymmdd/n) and the instructor's
   * rating line printed under the signature, e.g. "CFI-Grade A PPG, PPT, PPC". */
  dtoCertRef: string;
  instructorRatingLine: string;
  examCopies: ExamCopyData[];
  /** The DTO's CFI as printed in the CA 62-16 stamp, e.g. "DJ Struwig" + CAA no. */
  dtoCfi: { name: string; caaNo: string };
  radioCert: RadioCertData | null;

  /** Things the instructor should know about before submitting. */
  warnings: string[];
};

export const GRADE_LABEL: Record<Grade, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  need_practice: "Need practice",
};

export const TRAINING_LABEL: Record<SignoffTrainingType, string> = {
  pg: "Paragliding (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};
