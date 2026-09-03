import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateMockRecordBody,
  CreateScreeningBody,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
  GetDashboardSummaryResponse,
  GetRulesResponse,
  GetScreeningParams,
  GetScreeningResponse,
  ListMockRecordsResponse,
  ListScreeningsQueryParams,
  ListScreeningsResponse,
  LoadDemoCaseBody,
  LoadDemoCaseResponse,
  UpdateMockRecordBody,
  UpdateMockRecordParams,
  UpdateRulesBody,
  UpdateRulesResponse,
} from "@workspace/api-zod";
import { db, mockRecordsTable, screeningRulesTable, screeningsTable } from "@workspace/db";
import { buildScreening, type DemoScenario, disclaimer, scenarios } from "../lib/screening-engine";

const router: IRouter = Router();

const defaultRules = {
  passportNumberFormat: "^P[0-9]{8}$",
  minValidityDays: 30,
  maxValidityYears: 10,
  visaValidityDays: 180,
  riskThresholds: { lowMax: 20, mediumMax: 50, highMax: 75 },
  requiredFields: ["Full Name", "Passport Number", "Nationality", "Date of Birth", "Date of Expiry"],
};

function detailFromRow(row: typeof screeningsTable.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    extractedFields: row.extractedFields,
    validationChecks: row.validationChecks,
    tamperingFindings: row.tamperingFindings,
    metadata: row.metadata,
    face: row.face,
    riskFactors: row.riskFactors,
  };
}

async function ensureSeedData(): Promise<void> {
  const existing = await db.select({ id: screeningsTable.id }).from(screeningsTable).limit(1);
  if (existing.length === 0) {
    for (const scenario of Object.keys(scenarios) as DemoScenario[]) {
      const built = buildScreening({ scenario, documentType: "Passport", personImageProvided: true });
      await db.insert(screeningsTable).values(built);
    }
  }
  const rules = await db.select({ id: screeningRulesTable.id }).from(screeningRulesTable).limit(1);
  if (rules.length === 0) {
    await db.insert(screeningRulesTable).values(defaultRules);
  }
  const records = await db.select({ id: mockRecordsTable.id }).from(mockRecordsTable).limit(1);
  if (records.length === 0) {
    await db.insert(mockRecordsTable).values([
      { documentNumber: "P10293847", name: "Aarav Sharma", nationality: "IND", status: "VALID", expiry: "2031-02-12", notes: "Synthetic record for baseline validation." },
      { documentNumber: "P84736291", name: "Meera Iyer", nationality: "IND", status: "EXPIRED", expiry: "2024-02-12", notes: "Synthetic expired document scenario." },
      { documentNumber: "P73628194", name: "Nadia Rahman", nationality: "BGD", status: "BLACKLISTED", expiry: "2029-09-18", notes: "Synthetic restricted-status scenario." },
    ]);
  }
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const rows = await db.select().from(screeningsTable).orderBy(desc(screeningsTable.createdAt));
  const suspicious = rows.filter((row) => row.riskScore > 20);
  const highRisk = rows.filter((row) => row.riskScore > 50);
  const riskDistribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((label) => ({
    label,
    value: rows.filter((row) => row.riskLevel === label).length,
  }));
  const types = [...new Set(rows.map((row) => row.documentType))];
  const documentTypeDistribution = types.map((label) => ({
    label,
    value: rows.filter((row) => row.documentType === label).length,
  }));
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    return { label, screened: index === 6 ? rows.length : Math.max(0, Math.round(rows.length / 2) - index), suspicious: index === 6 ? suspicious.length : Math.max(0, Math.round(suspicious.length / 2) - index) };
  });
  const payload = {
    documentsScreenedToday: rows.length,
    verifiedDocuments: rows.filter((row) => row.riskScore <= 20).length,
    suspiciousDocuments: suspicious.length,
    highRiskDocuments: highRisk.length,
    averageProcessingTimeMs: Math.round(rows.reduce((sum, row) => sum + row.processingTimeMs, 0) / Math.max(rows.length, 1)),
    riskDistribution,
    documentTypeDistribution,
    dailyTrend: trend,
    recentScreenings: rows.slice(0, 6).map((row) => detailFromRow(row)),
  };
  res.json(GetDashboardSummaryResponse.parse(payload));
});

router.get("/screenings", async (req, res): Promise<void> => {
  await ensureSeedData();
  const parsed = ListScreeningsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, risk, documentType, limit = 25 } = parsed.data;
  const filters = [];
  if (search) {
    filters.push(or(
      ilike(screeningsTable.screeningId, `%${search}%`),
      ilike(screeningsTable.documentNumber, `%${search}%`),
      ilike(screeningsTable.nationality, `%${search}%`),
    ));
  }
  if (risk) filters.push(eq(screeningsTable.riskLevel, risk));
  if (documentType) filters.push(eq(screeningsTable.documentType, documentType));
  const rows = await db.select().from(screeningsTable).where(filters.length ? and(...filters) : undefined).orderBy(desc(screeningsTable.createdAt)).limit(limit);
  res.json(ListScreeningsResponse.parse(rows.map((row) => detailFromRow(row))));
});

router.post("/screenings", async (req, res): Promise<void> => {
  const parsed = CreateScreeningBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const built = buildScreening(parsed.data as Parameters<typeof buildScreening>[0]);
  const [created] = await db.insert(screeningsTable).values(built).returning();
  res.status(201).json(GetScreeningResponse.parse(detailFromRow(created)));
});

router.get("/screenings/:id", async (req, res): Promise<void> => {
  const parsed = GetScreeningParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.select().from(screeningsTable).where(eq(screeningsTable.id, parsed.data.id));
  if (!row) {
    res.status(404).json({ error: "Screening not found" });
    return;
  }
  res.json(GetScreeningResponse.parse(detailFromRow(row)));
});

router.post("/demo/load", async (req, res): Promise<void> => {
  const parsed = LoadDemoCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const built = buildScreening({ scenario: parsed.data.scenario as DemoScenario, documentType: "Passport", personImageProvided: true, fileName: `synthetic-${parsed.data.scenario}-case.png` });
  const [created] = await db.insert(screeningsTable).values(built).returning();
  res.status(201).json(LoadDemoCaseResponse.parse(detailFromRow(created)));
});

router.get("/analytics", async (req, res): Promise<void> => {
  await ensureSeedData();
  const parsed = GetAnalyticsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(screeningsTable).orderBy(asc(screeningsTable.createdAt));
  const tamperingFindings = rows.filter((row) => row.tamperingStatus === "SUSPICIOUS").length;
  const faceMismatches = rows.filter((row) => row.faceVerification === "MISMATCH").length;
  const payload = {
    range: parsed.data.range ?? "7d",
    totalScreened: rows.length,
    validPercentage: Math.round((rows.filter((row) => row.riskScore <= 20).length / Math.max(rows.length, 1)) * 100),
    suspiciousPercentage: Math.round((rows.filter((row) => row.riskScore > 20).length / Math.max(rows.length, 1)) * 100),
    averageProcessingTimeMs: Math.round(rows.reduce((sum, row) => sum + row.processingTimeMs, 0) / Math.max(rows.length, 1)),
    tamperingFindings,
    faceMismatches,
    riskDistribution: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((label) => ({ label, value: rows.filter((row) => row.riskLevel === label).length })),
    dailyTrend: rows.slice(-7).map((row, index) => ({ label: `Day ${index + 1}`, screened: index + 1, suspicious: row.riskScore > 20 ? 1 : 0 })),
  };
  res.json(GetAnalyticsResponse.parse(payload));
});

router.get("/rules", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const [row] = await db.select().from(screeningRulesTable).limit(1);
  const payload = { ...row, riskThresholds: row.riskThresholds, requiredFields: row.requiredFields };
  res.json(GetRulesResponse.parse(payload));
});

router.put("/rules", async (req, res): Promise<void> => {
  const parsed = UpdateRulesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureSeedData();
  const [existing] = await db.select().from(screeningRulesTable).limit(1);
  const [updated] = await db.update(screeningRulesTable).set(parsed.data).where(eq(screeningRulesTable.id, existing.id)).returning();
  res.json(UpdateRulesResponse.parse({ ...updated, riskThresholds: updated.riskThresholds, requiredFields: updated.requiredFields }));
});

router.get("/mock-records", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const records = await db.select().from(mockRecordsTable).orderBy(desc(mockRecordsTable.id));
  res.json(ListMockRecordsResponse.parse(records));
});

router.post("/mock-records", async (req, res): Promise<void> => {
  const parsed = CreateMockRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db.insert(mockRecordsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch("/mock-records/:id", async (req, res): Promise<void> => {
  const params = UpdateMockRecordParams.safeParse(req.params);
  const body = UpdateMockRecordBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid mock record" });
    return;
  }
  const [updated] = await db.update(mockRecordsTable).set(body.data).where(eq(mockRecordsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Mock record not found" });
    return;
  }
  res.json(updated);
});

router.delete("/mock-records/:id", async (req, res): Promise<void> => {
  const parsed = UpdateMockRecordParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(mockRecordsTable).where(eq(mockRecordsTable.id, parsed.data.id));
  res.sendStatus(204);
});

export default router;