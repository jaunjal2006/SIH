import type { InsertScreening } from "@workspace/db";

export type DemoScenario = "valid" | "expired" | "tampered" | "mismatch" | "blacklisted";

const disclaimer =
  "Academic prototype. Results are simulated/AI-assisted and must not be used as the sole basis for real-world identity, immigration, law-enforcement, or border-security decisions.";

const scenarios: Record<
  DemoScenario,
  {
    documentNumber: string;
    nationality: string;
    score: number;
    validationStatus: string;
    tamperingStatus: string;
    faceVerification: string;
    recommendation: string;
    recordStatus: string;
  }
> = {
  valid: {
    documentNumber: "P10293847",
    nationality: "IND",
    score: 8,
    validationStatus: "PASS",
    tamperingStatus: "PASS",
    faceVerification: "MATCH",
    recommendation: "CLEAR FOR MANUAL REVIEW",
    recordStatus: "VALID",
  },
  expired: {
    documentNumber: "P84736291",
    nationality: "IND",
    score: 32,
    validationStatus: "WARNING",
    tamperingStatus: "PASS",
    faceVerification: "MATCH",
    recommendation: "REQUEST ADDITIONAL VERIFICATION",
    recordStatus: "EXPIRED",
  },
  tampered: {
    documentNumber: "P56473829",
    nationality: "NPL",
    score: 68,
    validationStatus: "WARNING",
    tamperingStatus: "SUSPICIOUS",
    faceVerification: "MATCH",
    recommendation: "REFER TO AUTHORIZED OFFICER",
    recordStatus: "VALID",
  },
  mismatch: {
    documentNumber: "P29384756",
    nationality: "LKA",
    score: 74,
    validationStatus: "PASS",
    tamperingStatus: "PASS",
    faceVerification: "MISMATCH",
    recommendation: "REFER TO AUTHORIZED OFFICER",
    recordStatus: "VALID",
  },
  blacklisted: {
    documentNumber: "P73628194",
    nationality: "BGD",
    score: 94,
    validationStatus: "SUSPICIOUS",
    tamperingStatus: "SUSPICIOUS",
    faceVerification: "MATCH",
    recommendation: "REFER TO AUTHORIZED OFFICER",
    recordStatus: "BLACKLISTED",
  },
};

function riskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score <= 20) return "LOW";
  if (score <= 50) return "MEDIUM";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

function statusFor(score: number): "CLEAR" | "REVIEW" | "ALERT" {
  if (score <= 20) return "CLEAR";
  if (score <= 75) return "REVIEW";
  return "ALERT";
}

function nowId() {
  return `SCR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}

export function buildScreening(
  input: {
    documentType?: string;
    documentNumber?: string;
    nationality?: string;
    fileName?: string;
    personImageProvided?: boolean;
    scenario?: DemoScenario;
  },
): InsertScreening {
  const scenario = input.scenario ?? "valid";
  const selected = scenarios[scenario];
  const documentNumber = input.documentNumber?.trim() || selected.documentNumber;
  const nationality = input.nationality?.trim().toUpperCase() || selected.nationality;
  const personImageProvided = input.personImageProvided ?? true;
  const score = selected.score;
  const isTampered = scenario === "tampered" || scenario === "blacklisted";
  const isMismatch = scenario === "mismatch";
  const factors = [];

  if (scenario === "expired") factors.push({ label: "Expired passport", points: 30, category: "VALIDATION" });
  if (scenario === "blacklisted") factors.push({ label: "Mock database status: BLACKLISTED", points: 50, category: "VALIDATION" });
  if (scenario === "blacklisted") factors.push({ label: "Possible text manipulation", points: 25, category: "TAMPERING" });
  if (scenario === "tampered") factors.push({ label: "Possible photo replacement", points: 30, category: "TAMPERING" });
  if (scenario === "tampered") factors.push({ label: "Possible text manipulation", points: 25, category: "TAMPERING" });
  if (isMismatch) factors.push({ label: "Face mismatch", points: 40, category: "FACE" });
  if (factors.length === 0) factors.push({ label: "Baseline prototype confidence adjustment", points: score, category: "OCR" });

  const extractedFields = [
    { label: "Full Name", value: "Aarav Sharma", confidence: scenario === "tampered" ? 88.2 : 96.4, source: "AI/OCR Extracted" },
    { label: "Passport Number", value: documentNumber, confidence: 98.1, source: "AI/OCR Extracted" },
    { label: "Nationality", value: nationality, confidence: 99.2, source: "AI/OCR Extracted" },
    { label: "Date of Birth", value: "1998-04-16", confidence: 95.8, source: "AI/OCR Extracted" },
    { label: "Date of Expiry", value: scenario === "expired" ? "2024-02-12" : "2031-02-12", confidence: 97.1, source: "AI/OCR Extracted" },
    { label: "Gender", value: "M", confidence: 94.6, source: "AI/OCR Extracted" },
    { label: "Country Code", value: nationality, confidence: 99.1, source: "AI/OCR Extracted" },
  ];

  const validationChecks = [
    { label: "Required fields present", status: "PASS", detail: "All configured passport fields were extracted." },
    { label: "Passport number format", status: "PASS", detail: "Matches configured pattern P########." },
    { label: "Date logic", status: scenario === "expired" ? "WARNING" : "PASS", detail: scenario === "expired" ? "Expiry date is in the past." : "DOB, issue date, and expiry date are logically ordered." },
    { label: "Mock verification database", status: selected.recordStatus === "VALID" ? "PASS" : "SUSPICIOUS", detail: `Synthetic record status: ${selected.recordStatus}.` },
  ];

  const tamperingFindings = isTampered
    ? [
        { region: "Portrait region", type: "Photo replacement indicator", confidence: 91.4, explanation: "Prototype edge and compression comparison found an inconsistent boundary.", status: "SUSPICIOUS" },
        { region: "MRZ / text region", type: "Text manipulation indicator", confidence: 84.7, explanation: "Prototype pixel-region analysis found an abrupt compression transition.", status: "SUSPICIOUS" },
      ]
    : [
        { region: "Full document", type: "Baseline integrity check", confidence: 96.8, explanation: "No suspicious region was found by the prototype image-analysis pass.", status: "PASS" },
      ];

  const face = {
    documentFaceDetected: true,
    personFaceDetected: personImageProvided,
    similarity: isMismatch ? 42 : personImageProvided ? 92 : 0,
    result: personImageProvided ? selected.faceVerification : "INSUFFICIENT QUALITY",
    note: "Prototype face comparison result. Not suitable for real-world identity decisions.",
  };

  return {
    screeningId: nowId(),
    documentType: input.documentType || "Passport",
    documentNumber,
    nationality,
    riskScore: score,
    riskLevel: riskLevel(score),
    status: statusFor(score),
    ocrStatus: "PASS",
    validationStatus: selected.validationStatus,
    tamperingStatus: selected.tamperingStatus,
    faceVerification: face.result,
    recommendation: selected.recommendation,
    processingTimeMs: 1800 + Math.round(Math.random() * 900),
    fileName: input.fileName || "synthetic-demo-passport.png",
    extractedFields,
    ocrConfidence: scenario === "tampered" ? 88.2 : 96.4,
    validationChecks,
    tamperingFindings,
    metadata: {
      "File type": "image/png",
      Resolution: "1600 × 1000 px",
      "Creation metadata": "Unavailable in demo input",
      "Editing software": isTampered ? "Prototype signal only — not proof of fraud" : "None detected",
    },
    face,
    riskFactors: factors,
    prototypeDisclaimer: disclaimer,
  };
}

export { disclaimer, scenarios };