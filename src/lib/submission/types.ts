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
