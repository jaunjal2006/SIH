import type { InsertScreening } from "@workspace/db";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type DemoScenario = "valid" | "expired" | "tampered" | "mismatch" | "blacklisted";

export interface ScreeningRulesInput {
  passportNumberFormat: string;
  minValidityDays: number;
  maxValidityYears: number;
  visaValidityDays: number;
  riskThresholds: { lowMax: number; mediumMax: number; highMax: number };
  requiredFields: string[];
}

export interface MockRecordLookup {
  documentNumber: string;
  status: string; // VALID | EXPIRED | BLACKLISTED | SUSPENDED | NOT_FOUND
  expiry: string;
  name: string;
  nationality: string;
}

export interface EngineInput {
  documentType?: string;
  documentNumber?: string;
  nationality?: string;
  fileName?: string;
  personImageProvided?: boolean;
  scenario?: DemoScenario;
  /** Live rules from DB — if omitted, defaults are used */
  rules?: ScreeningRulesInput;
  /** All mock records from DB for document-number lookup */
  mockRecords?: MockRecordLookup[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const disclaimer =
  "Academic prototype. Results are simulated/AI-assisted and must not be used as the sole basis for real-world identity, immigration, law-enforcement, or border-security decisions.";

const DEFAULT_RULES: ScreeningRulesInput = {
  passportNumberFormat: "^P[0-9]{8}$",
  minValidityDays: 30,
  maxValidityYears: 10,
  visaValidityDays: 180,
  riskThresholds: { lowMax: 20, mediumMax: 50, highMax: 75 },
  requiredFields: ["Full Name", "Passport Number", "Nationality", "Date of Birth", "Date of Expiry"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo scenario seed data
// (used ONLY as starting fixtures — actual scoring is computed from checks)
// ─────────────────────────────────────────────────────────────────────────────

export const scenarios: Record<
  DemoScenario,
  {
    documentNumber: string;
    nationality: string;
    name: string;
    dateOfBirth: string;
    dateOfExpiry: string;
    gender: string;
    /** Hint flags — the engine re-derives everything from these */
    forceExpired: boolean;
    forceTampered: boolean;
    forceMismatch: boolean;
    forceBlacklisted: boolean;
  }
> = {
  valid: {
    documentNumber: "P10293847",
    nationality: "IND",
    name: "Aarav Sharma",
    dateOfBirth: "1998-04-16",
    dateOfExpiry: "2031-02-12",
    gender: "M",
    forceExpired: false,
    forceTampered: false,
    forceMismatch: false,
    forceBlacklisted: false,
  },
  expired: {
    documentNumber: "P84736291",
    nationality: "IND",
    name: "Meera Iyer",
    dateOfBirth: "1990-07-23",
    dateOfExpiry: "2024-02-12",       // deliberately in the past
    gender: "F",
    forceExpired: true,
    forceTampered: false,
    forceMismatch: false,
    forceBlacklisted: false,
  },
  tampered: {
    documentNumber: "P56473829",
    nationality: "NPL",
    name: "Rajan Thapa",
    dateOfBirth: "1995-11-05",
    dateOfExpiry: "2031-09-30",
    gender: "M",
    forceExpired: false,
    forceTampered: true,
    forceMismatch: false,
    forceBlacklisted: false,
  },
  mismatch: {
    documentNumber: "P29384756",
    nationality: "LKA",
    name: "Priya Fernando",
    dateOfBirth: "2001-03-18",
    dateOfExpiry: "2032-06-14",
    gender: "F",
    forceExpired: false,
    forceTampered: false,
    forceMismatch: true,
    forceBlacklisted: false,
  },
  blacklisted: {
    documentNumber: "P73628194",
    nationality: "BGD",
    name: "Nadia Rahman",
    dateOfBirth: "1987-09-29",
    dateOfExpiry: "2029-09-18",
    gender: "F",
    forceExpired: false,
    forceTampered: true,              // tampered + blacklisted
    forceMismatch: false,
    forceBlacklisted: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nowId(): string {
  return `SCR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function deriveRiskLevel(
  score: number,
  thresholds: { lowMax: number; mediumMax: number; highMax: number },
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score <= thresholds.lowMax) return "LOW";
  if (score <= thresholds.mediumMax) return "MEDIUM";
  if (score <= thresholds.highMax) return "HIGH";
  return "CRITICAL";
}

function deriveStatus(score: number, thresholds: { highMax: number }): "CLEAR" | "REVIEW" | "ALERT" {
  if (score <= 20) return "CLEAR";
  if (score <= thresholds.highMax) return "REVIEW";
  return "ALERT";
}

function deriveRecommendation(score: number, thresholds: { lowMax: number; highMax: number }): string {
  if (score <= thresholds.lowMax) return "CLEAR FOR MANUAL REVIEW";
  if (score <= thresholds.highMax) return "REQUEST ADDITIONAL VERIFICATION";
  return "REFER TO AUTHORIZED OFFICER";
}

/** Format regex based on document type */
function docNumberRegex(docType: string, rules: ScreeningRulesInput): RegExp | null {
  const t = docType.toLowerCase();
  if (t.includes("passport")) return new RegExp(rules.passportNumberFormat);
  if (t.includes("visa")) return /^V[A-Z0-9]{6,10}$/;
  if (t.includes("national")) return /^N[A-Z0-9]{7,12}$/;
  if (t.includes("driving") || t.includes("licence") || t.includes("license")) return /^DL[A-Z0-9]{6,12}$/;
  if (t.includes("permit")) return /^[A-Z]{2}[0-9]{6,10}$/;
  if (t.includes("travel")) return /^TA[0-9]{7,10}$/;
  return null; // unknown — skip format check
}

/** OCR confidence degrades deterministically based on tampering signals */
function ocrConfidence(isTampered: boolean, docType: string): number {
  const base = docType.toLowerCase().includes("passport") ? 97.2 : 94.8;
  return isTampered ? +(base - 8.5 - Math.random() * 3).toFixed(1) : +(base - Math.random() * 1.2).toFixed(1);
}

/** Per-document-type extracted fields */
function buildExtractedFields(
  docType: string,
  docNumber: string,
  nationality: string,
  name: string,
  dob: string,
  expiry: string,
  gender: string,
  isTampered: boolean,
): Array<{ label: string; value: string; confidence: number; source: string }> {
  const t = docType.toLowerCase();
  const conf = (base: number) =>
    isTampered ? +(base - 7 - Math.random() * 4).toFixed(1) : +(base - Math.random() * 1.5).toFixed(1);

  if (t.includes("passport")) {
    return [
      { label: "Full Name",         value: name,        confidence: conf(97.4), source: "AI/OCR Extracted" },
      { label: "Passport Number",   value: docNumber,   confidence: conf(98.6), source: "AI/OCR Extracted" },
      { label: "Nationality",       value: nationality, confidence: conf(99.1), source: "AI/OCR Extracted" },
      { label: "Date of Birth",     value: dob,         confidence: conf(96.2), source: "AI/OCR Extracted" },
      { label: "Date of Expiry",    value: expiry,      confidence: conf(97.8), source: "AI/OCR Extracted" },
      { label: "Gender",            value: gender,      confidence: conf(95.3), source: "AI/OCR Extracted" },
      { label: "Country Code",      value: nationality, confidence: conf(99.0), source: "AI/OCR Extracted" },
      { label: "MRZ Line 1",        value: isTampered ? "[INCONSISTENCY DETECTED]" : `P<${nationality}${name.replace(/ /g, "<").toUpperCase()}`, confidence: conf(isTampered ? 71.2 : 96.5), source: "AI/OCR Extracted" },
      { label: "MRZ Line 2",        value: `${docNumber}${nationality}${dob.replace(/-/g, "").slice(2)}`, confidence: conf(97.1), source: "AI/OCR Extracted" },
    ];
  }

  if (t.includes("visa")) {
    return [
      { label: "Full Name",         value: name,        confidence: conf(96.8), source: "AI/OCR Extracted" },
      { label: "Visa Number",       value: docNumber,   confidence: conf(98.2), source: "AI/OCR Extracted" },
      { label: "Nationality",       value: nationality, confidence: conf(98.9), source: "AI/OCR Extracted" },
      { label: "Date of Birth",     value: dob,         confidence: conf(95.7), source: "AI/OCR Extracted" },
      { label: "Expiry Date",       value: expiry,      confidence: conf(97.3), source: "AI/OCR Extracted" },
      { label: "Visa Category",     value: "TOURIST",   confidence: conf(91.4), source: "AI/OCR Extracted" },
      { label: "Issuing Country",   value: nationality, confidence: conf(97.0), source: "AI/OCR Extracted" },
    ];
  }

  if (t.includes("national")) {
    return [
      { label: "Full Name",         value: name,        confidence: conf(97.1), source: "AI/OCR Extracted" },
      { label: "ID Number",         value: docNumber,   confidence: conf(98.4), source: "AI/OCR Extracted" },
      { label: "Nationality",       value: nationality, confidence: conf(99.0), source: "AI/OCR Extracted" },
      { label: "Date of Birth",     value: dob,         confidence: conf(96.0), source: "AI/OCR Extracted" },
      { label: "Date of Expiry",    value: expiry,      confidence: conf(97.6), source: "AI/OCR Extracted" },
      { label: "Gender",            value: gender,      confidence: conf(94.8), source: "AI/OCR Extracted" },
      { label: "Address",           value: isTampered ? "[FIELD INCONSISTENCY]" : "Synthetic address — demo only", confidence: conf(88.3), source: "AI/OCR Extracted" },
    ];
  }

  if (t.includes("driving") || t.includes("licence") || t.includes("license")) {
    return [
      { label: "Full Name",         value: name,        confidence: conf(97.0), source: "AI/OCR Extracted" },
      { label: "Licence Number",    value: docNumber,   confidence: conf(98.1), source: "AI/OCR Extracted" },
      { label: "Date of Birth",     value: dob,         confidence: conf(95.9), source: "AI/OCR Extracted" },
      { label: "Expiry Date",       value: expiry,      confidence: conf(97.5), source: "AI/OCR Extracted" },
      { label: "Vehicle Classes",   value: "B, BE",     confidence: conf(90.2), source: "AI/OCR Extracted" },
      { label: "Issuing Authority", value: "SYNTHETIC TRANSPORT DEPT", confidence: conf(88.6), source: "AI/OCR Extracted" },
    ];
  }

  // Permit / Travel Authorization / fallback
  return [
    { label: "Full Name",           value: name,        confidence: conf(96.5), source: "AI/OCR Extracted" },
    { label: "Document Number",     value: docNumber,   confidence: conf(97.8), source: "AI/OCR Extracted" },
    { label: "Nationality",         value: nationality, confidence: conf(98.7), source: "AI/OCR Extracted" },
    { label: "Date of Birth",       value: dob,         confidence: conf(95.4), source: "AI/OCR Extracted" },
    { label: "Expiry Date",         value: expiry,      confidence: conf(97.0), source: "AI/OCR Extracted" },
    { label: "Gender",              value: gender,      confidence: conf(94.1), source: "AI/OCR Extracted" },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Core engine
// ─────────────────────────────────────────────────────────────────────────────

export function buildScreening(input: EngineInput): InsertScreening {
  const rules  = input.rules  ?? DEFAULT_RULES;
  const mocks  = input.mockRecords ?? [];
  const scenario = input.scenario ?? "valid";
  const seed   = scenarios[scenario];

  // ── Resolve document fields (user input > scenario defaults) ──────────────
  const docType   = input.documentType?.trim() || "Passport";
  const docNumber = input.documentNumber?.trim() || seed.documentNumber;
  const nationality = (input.nationality?.trim().toUpperCase() || seed.nationality);
  const name      = seed.name;           // always from scenario seed (no user input)
  const dob       = seed.dateOfBirth;
  const expiry    = input.documentNumber ? seed.dateOfExpiry : seed.dateOfExpiry;
  const gender    = seed.gender;

  const personImageProvided = input.personImageProvided ?? true;

  // ── Force-flags from scenario ─────────────────────────────────────────────
  const forceExpired     = seed.forceExpired;
  const forceTampered    = seed.forceTampered;
  const forceMismatch    = seed.forceMismatch;
  const forceBlacklisted = seed.forceBlacklisted;

  // ── Mock DB lookup ────────────────────────────────────────────────────────
  // Look up the submitted document number in the live mock-records table.
  const dbRecord = mocks.find(
    (r) => r.documentNumber.trim().toUpperCase() === docNumber.toUpperCase(),
  );
  // If no record found at all, treat as NOT_FOUND (neutral — not auto-suspicious)
  const dbStatus = dbRecord?.status ?? (forceBlacklisted ? "BLACKLISTED" : "NOT_FOUND");

  // ── Date arithmetic ───────────────────────────────────────────────────────
  const today    = new Date();
  const expiryDate = new Date(expiry);
  const dobDate    = new Date(dob);

  const daysUntilExpiry = daysBetween(today, expiryDate);      // negative = expired
  const ageYears = Math.floor(daysBetween(dobDate, today) / 365.25);
  const docAgeYears = forceExpired
    ? rules.maxValidityYears + 1                               // force over-age
    : Math.max(0, Math.floor(daysBetween(expiryDate, today) / -365.25) + rules.maxValidityYears);

  const isExpired     = forceExpired || daysUntilExpiry < 0;
  const isExpiringSoon = !isExpired && daysUntilExpiry >= 0 && daysUntilExpiry < rules.minValidityDays;
  const isOverMaxAge  = docAgeYears > rules.maxValidityYears;

  // ── Format validation ─────────────────────────────────────────────────────
  const numberRegex   = docNumberRegex(docType, rules);
  const numberFormatOk = numberRegex ? numberRegex.test(docNumber) : true;

  // ── OCR ───────────────────────────────────────────────────────────────────
  const isTampered  = forceTampered;
  const isMismatch  = forceMismatch;
  const ocrConf     = ocrConfidence(isTampered, docType);
  const ocrStatus   = ocrConf >= 90 ? "PASS" : ocrConf >= 75 ? "WARNING" : "SUSPICIOUS";

  // ── Risk factor accumulation ───────────────────────────────────────────────
  // Each check adds points. Final score is clamped 0–100.
  const factors: Array<{ label: string; points: number; category: string }> = [];

  // --- VALIDATION checks ---
  if (isExpired) {
    factors.push({
      label: "Document is expired",
      points: 30,
      category: "VALIDATION",
    });
  } else if (isExpiringSoon) {
    factors.push({
      label: `Document expires in ${daysUntilExpiry} days (below ${rules.minValidityDays}-day minimum)`,
      points: 15,
      category: "VALIDATION",
    });
  }

  if (isOverMaxAge) {
    factors.push({
      label: `Document age exceeds maximum of ${rules.maxValidityYears} years`,
      points: 12,
      category: "VALIDATION",
    });
  }

  if (!numberFormatOk) {
    factors.push({
      label: `Document number does not match required format`,
      points: 20,
      category: "VALIDATION",
    });
  }

  if (ageYears < 0 || ageYears > 120) {
    factors.push({
      label: "Date of birth is implausible",
      points: 25,
      category: "VALIDATION",
    });
  }

  // --- DATABASE checks ---
  if (dbStatus === "BLACKLISTED") {
    factors.push({
      label: "Document number is BLACKLISTED in verification database",
      points: 55,
      category: "VALIDATION",
    });
  } else if (dbStatus === "SUSPENDED") {
    factors.push({
      label: "Document number is SUSPENDED in verification database",
      points: 35,
      category: "VALIDATION",
    });
  } else if (dbStatus === "EXPIRED") {
    factors.push({
      label: "Verification database record status: EXPIRED",
      points: 20,
      category: "VALIDATION",
    });
  } else if (dbStatus === "NOT_FOUND") {
    factors.push({
      label: "Document number not found in verification database",
      points: 8,
      category: "VALIDATION",
    });
  }
  // VALID = 0 extra points

  // --- TAMPERING checks ---
  if (isTampered) {
    factors.push({
      label: "Photo region shows compression boundary inconsistency",
      points: 32,
      category: "TAMPERING",
    });
    factors.push({
      label: "MRZ / text region shows pixel-level manipulation signal",
      points: 26,
      category: "TAMPERING",
    });
  }

  if (ocrConf < 90) {
    factors.push({
      label: `OCR confidence degraded (${ocrConf}%) — possible print or scan anomaly`,
      points: ocrConf < 75 ? 18 : 8,
      category: "OCR",
    });
  }

  // --- FACE checks ---
  if (isMismatch && personImageProvided) {
    factors.push({
      label: "Face similarity below acceptable threshold (42%)",
      points: 40,
      category: "FACE",
    });
  }

  // ── Compute score from factors ────────────────────────────────────────────
  const rawScore = factors.reduce((acc, f) => acc + f.points, 0);

  // Baseline confidence bump: even a perfect document has minor OCR uncertainty
  const baselinePoints = rawScore === 0 ? 5 : 0;
  if (baselinePoints > 0) {
    factors.push({
      label: "Baseline OCR confidence adjustment (no risk signals detected)",
      points: baselinePoints,
      category: "OCR",
    });
  }

  const score = clamp(rawScore + baselinePoints, 0, 100);

  // ── Derive status fields from score ──────────────────────────────────────
  const riskLvl     = deriveRiskLevel(score, rules.riskThresholds);
  const statusVal   = deriveStatus(score, rules.riskThresholds);
  const recommendation = deriveRecommendation(score, rules.riskThresholds);

  // ── Validation checks (detailed card) ────────────────────────────────────
  const requiredFieldLabels = rules.requiredFields;
  const extractedFieldLabels = buildExtractedFields(
    docType, docNumber, nationality, name, dob, expiry, gender, isTampered,
  ).map((f) => f.label);
  const missingRequired = requiredFieldLabels.filter((r) =>
    !extractedFieldLabels.some((e) => e.toLowerCase().includes(r.toLowerCase())),
  );

  const validationChecks: Array<{ label: string; status: string; detail: string }> = [
    {
      label: "Required fields present",
      status: missingRequired.length === 0 ? "PASS" : "WARNING",
      detail: missingRequired.length === 0
        ? "All required fields were extracted successfully."
        : `Missing fields: ${missingRequired.join(", ")}.`,
    },
    {
      label: "Document number format",
      status: numberFormatOk ? "PASS" : "WARNING",
      detail: numberFormatOk
        ? `Format is valid for ${docType}.`
        : `Number '${docNumber}' does not match the required pattern.`,
    },
    {
      label: "Expiry date logic",
      status: isExpired ? "WARNING" : isExpiringSoon ? "WARNING" : "PASS",
      detail: isExpired
        ? `Document expired on ${expiry} — ${Math.abs(daysUntilExpiry)} days ago.`
        : isExpiringSoon
        ? `Expires in ${daysUntilExpiry} days, below the ${rules.minValidityDays}-day minimum validity threshold.`
        : `Valid for another ${daysUntilExpiry} days (expiry: ${expiry}).`,
    },
    {
      label: "Date of birth plausibility",
      status: ageYears >= 0 && ageYears <= 120 ? "PASS" : "WARNING",
      detail: ageYears >= 0 && ageYears <= 120
        ? `Holder age computed as ${ageYears} years — within acceptable range.`
        : `Computed age of ${ageYears} years is implausible.`,
    },
    {
      label: "Verification database lookup",
      status:
        dbStatus === "VALID"       ? "PASS"
        : dbStatus === "NOT_FOUND" ? "WARNING"
        : "SUSPICIOUS",
      detail:
        dbStatus === "VALID"        ? `Document verified in database — status: VALID.`
        : dbStatus === "NOT_FOUND"  ? `Document number not found in verification database. Manual check advised.`
        : dbStatus === "EXPIRED"    ? `Database record status: EXPIRED. Document may no longer be recognised.`
        : dbStatus === "SUSPENDED"  ? `Database record status: SUSPENDED. Document has been suspended.`
        : dbStatus === "BLACKLISTED" ? `Database record status: BLACKLISTED. Document is flagged as restricted.`
        : `Database status: ${dbStatus}.`,
    },
    {
      label: "Holder nationality cross-check",
      status: dbRecord && dbRecord.nationality && dbRecord.nationality !== nationality ? "WARNING" : "PASS",
      detail: dbRecord && dbRecord.nationality && dbRecord.nationality !== nationality
        ? `Submitted nationality '${nationality}' differs from database record '${dbRecord.nationality}'.`
        : "Nationality matches database record (or no discrepancy found).",
    },
  ];

  // ── Tampering findings ────────────────────────────────────────────────────
  const tamperingFindings: Array<{
    region: string; type: string; confidence: number; explanation: string; status: string;
  }> = isTampered
    ? [
        {
          region: "Portrait region",
          type: "Photo substitution indicator",
          confidence: +(88 + Math.random() * 5).toFixed(1),
          explanation:
            "Edge-frequency analysis detected an inconsistent compression boundary around the portrait area, consistent with photo substitution.",
          status: "SUSPICIOUS",
        },
        {
          region: "MRZ / text region",
          type: "Text manipulation indicator",
          confidence: +(80 + Math.random() * 6).toFixed(1),
          explanation:
            "Pixel-region analysis found an abrupt tone transition in the machine-readable zone, consistent with character-level alteration.",
          status: "SUSPICIOUS",
        },
        {
          region: "Laminate / hologram layer",
          type: "Surface integrity anomaly",
          confidence: +(72 + Math.random() * 8).toFixed(1),
          explanation:
            "Reflection pattern in the laminate layer does not match the expected holographic signature for this document series.",
          status: "SUSPICIOUS",
        },
      ]
    : [
        {
          region: "Full document",
          type: "Baseline integrity check",
          confidence: +(94 + Math.random() * 4).toFixed(1),
          explanation:
            "No suspicious region was detected. Compression boundaries, MRZ zone, and laminate signals are all within expected ranges.",
          status: "PASS",
        },
      ];

  const tamperingStatus =
    tamperingFindings.some((f) => f.status === "SUSPICIOUS") ? "SUSPICIOUS" : "PASS";

  // ── Face comparison ───────────────────────────────────────────────────────
  const faceResult = !personImageProvided
    ? "INSUFFICIENT QUALITY"
    : isMismatch
    ? "MISMATCH"
    : "MATCH";

  const faceSimilarity = isMismatch
    ? +(38 + Math.random() * 8).toFixed(1)          // ~38–46% — clearly below threshold
    : personImageProvided
    ? +(88 + Math.random() * 8).toFixed(1)           // ~88–96% — confident match
    : 0;

  const face = {
    documentFaceDetected: true,
    personFaceDetected: personImageProvided,
    similarity: +faceSimilarity,
    result: faceResult,
    note: personImageProvided
      ? isMismatch
        ? `Face similarity of ${faceSimilarity}% is below the 60% acceptance threshold — refer to officer.`
        : `Face similarity of ${faceSimilarity}% exceeds the 80% acceptance threshold.`
      : "No person image was provided — face comparison could not be performed.",
  };

  // ── Determine overall validation status ──────────────────────────────────
  const hasValidationWarning = validationChecks.some((c) => c.status === "WARNING");
  const hasValidationSuspicious = validationChecks.some((c) => c.status === "SUSPICIOUS");
  const validationStatus =
    hasValidationSuspicious ? "SUSPICIOUS"
    : hasValidationWarning  ? "WARNING"
    : "PASS";

  // ── Metadata ──────────────────────────────────────────────────────────────
  const fileExt = (input.fileName ?? "").split(".").pop()?.toUpperCase() ?? "PNG";
  const metadata: Record<string, string> = {
    "File name":           input.fileName || `synthetic-${scenario}-${docType.toLowerCase().replace(/ /g, "-")}.png`,
    "File type":           `image/${fileExt.toLowerCase()}`,
    "Resolution":          "1600 × 1000 px",
    "Document type":       docType,
    "Scenario":            scenario,
    "Creation metadata":   "Unavailable in demo input",
    "Editing software":    isTampered ? "Signal detected — not proof of fraud" : "None detected",
    "OCR engine":          "Prototype AI/OCR v2.1",
    "DB lookup status":    dbStatus,
  };

  // ── Processing time ───────────────────────────────────────────────────────
  // Heavier scenarios take longer — realistically models actual processing
  const baseMs = 1200;
  const tamperPenalty  = isTampered   ? 400 : 0;
  const facePenalty    = personImageProvided ? 300 : 0;
  const dbPenalty      = mocks.length > 0 ? 100 : 50;
  const jitter         = Math.round(Math.random() * 600);
  const processingTimeMs = baseMs + tamperPenalty + facePenalty + dbPenalty + jitter;

  return {
    screeningId: nowId(),
    documentType: docType,
    documentNumber: docNumber,
    nationality,
    riskScore: score,
    riskLevel: riskLvl,
    status: statusVal,
    ocrStatus,
    validationStatus,
    tamperingStatus,
    faceVerification: faceResult,
    recommendation,
    processingTimeMs,
    fileName: input.fileName || `synthetic-${scenario}-${docType.toLowerCase().replace(/ /g, "-")}.png`,
    extractedFields: buildExtractedFields(docType, docNumber, nationality, name, dob, expiry, gender, isTampered),
    ocrConfidence: ocrConf,
    validationChecks,
    tamperingFindings,
    metadata,
    face,
    riskFactors: factors,
    prototypeDisclaimer: disclaimer,
  };
}
