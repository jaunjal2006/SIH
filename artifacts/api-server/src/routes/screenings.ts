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
import {
  db,
  mockRecordsTable,
  screeningRulesTable,
  screeningsTable,
  and, or, eq, ilike, desc, asc, gte, lte,
} from "@workspace/db";
import {
  buildScreening,
  type DemoScenario,
  type MockRecordLookup,
  type ScreeningRulesInput,
  scenarios,
} from "../lib/screening-engine";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const defaultRules: ScreeningRulesInput = {
  passportNumberFormat: "^P[0-9]{8}$",
  minValidityDays: 30,
  maxValidityYears: 10,
  visaValidityDays: 180,
  riskThresholds: { lowMax: 20, mediumMax: 50, highMax: 75 },
  requiredFields: ["Full Name", "Passport Number", "Nationality", "Date of Birth", "Date of Expiry"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

function detailFromRow(row: AnyRow) {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date
      ? (row.createdAt as Date).toISOString()
      : String(row.createdAt ?? new Date().toISOString()),
  };
}

async function loadRules(): Promise<ScreeningRulesInput> {
  const rows = await db.select().from(screeningRulesTable).limit(1)._exec();
  if (!rows.length) return defaultRules;
  const row = rows[0];
  return {
    passportNumberFormat: row.passportNumberFormat as string,
    minValidityDays: row.minValidityDays as number,
    maxValidityYears: row.maxValidityYears as number,
    visaValidityDays: row.visaValidityDays as number,
    riskThresholds: row.riskThresholds as ScreeningRulesInput["riskThresholds"],
    requiredFields: row.requiredFields as string[],
  };
}

async function loadMockRecords(): Promise<MockRecordLookup[]> {
  const rows = await db.select().from(mockRecordsTable)._exec();
  return rows.map(r => ({
    documentNumber: r.documentNumber as string,
    status: r.status as string,
    expiry: r.expiry as string,
    name: r.name as string,
    nationality: r.nationality as string,
  }));
}

function resolveDateRange(range?: string, from?: string, to?: string): { from?: Date; to?: Date } {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (range === "7d") {
    const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (range === "30d") {
    const start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (range === "custom" && from && to) {
    return { from: new Date(from), to: new Date(to + "T23:59:59.999Z") };
  }
  const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
  return { from: start, to: now };
}

function buildDailyTrend(rows: AnyRow[], from: Date, to: Date) {
  const dayMap = new Map<string, { screened: number; suspicious: number }>();
  const cursor = new Date(from); cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    dayMap.set(cursor.toISOString().slice(0, 10), { screened: 0, suspicious: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const row of rows) {
    const d = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string);
    const key = d.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const b = dayMap.get(key)!;
      b.screened++;
      if ((row.riskScore as number) > 20) b.suspicious++;
    }
  }
  return [...dayMap.entries()].slice(-14).map(([dateStr, counts]) => {
    const d = new Date(dateStr);
    return { label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), ...counts };
  });
}

async function ensureSeedData() {
  const existing = await db.select().from(screeningsTable).limit(1)._exec();
  if (!existing.length) {
    // seed rules
    const rulesRows = await db.select().from(screeningRulesTable).limit(1)._exec();
    const seedRules = rulesRows.length ? {
      passportNumberFormat: rulesRows[0].passportNumberFormat as string,
      minValidityDays: rulesRows[0].minValidityDays as number,
      maxValidityYears: rulesRows[0].maxValidityYears as number,
      visaValidityDays: rulesRows[0].visaValidityDays as number,
      riskThresholds: rulesRows[0].riskThresholds as ScreeningRulesInput["riskThresholds"],
      requiredFields: rulesRows[0].requiredFields as string[],
    } : defaultRules;

    // seed mock records
    const existingRec = await db.select().from(mockRecordsTable).limit(1)._exec();
    if (!existingRec.length) {
      await db.insert(mockRecordsTable).values([
        { documentNumber: "P10293847", name: "Aarav Sharma",  nationality: "IND", status: "VALID",       expiry: "2031-02-12", notes: "Baseline validation scenario." },
        { documentNumber: "P84736291", name: "Meera Iyer",    nationality: "IND", status: "EXPIRED",     expiry: "2024-02-12", notes: "Expired document scenario." },
        { documentNumber: "P73628194", name: "Nadia Rahman",  nationality: "BGD", status: "BLACKLISTED", expiry: "2029-09-18", notes: "Blacklisted document scenario." },
        { documentNumber: "P29384756", name: "Priya Fernando",nationality: "LKA", status: "VALID",       expiry: "2032-06-14", notes: "Face mismatch scenario." },
        { documentNumber: "P56473829", name: "Rajan Thapa",   nationality: "NPL", status: "VALID",       expiry: "2031-09-30", notes: "Tampering scenario." },
      ] as AnyRow[]).then(() => {});
    }

    const mockRecords = await loadMockRecords();
    for (const scenario of Object.keys(scenarios) as DemoScenario[]) {
      const built = buildScreening({ scenario, documentType: "Passport", personImageProvided: true, rules: seedRules, mockRecords });
      await db.insert(screeningsTable).values(built as unknown as AnyRow).then(() => {});
    }
  }

  const rules = await db.select().from(screeningRulesTable).limit(1)._exec();
  if (!rules.length) {
    await db.insert(screeningRulesTable).values(defaultRules as unknown as AnyRow).then(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const allRows = await db.select().from(screeningsTable).orderBy(desc("createdAt"))._exec();

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const useRows = allRows.length <= 10 ? allRows : allRows.filter(r => new Date(r.createdAt as string) >= todayStart).length > 0
    ? allRows.filter(r => new Date(r.createdAt as string) >= todayStart)
    : allRows;

  const suspicious = useRows.filter(r => (r.riskScore as number) > 20);
  const highRisk   = useRows.filter(r => (r.riskScore as number) > 50);

  const riskDistribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(label => ({
    label, value: allRows.filter(r => r.riskLevel === label).length,
  }));
  const allDocTypes = [...new Set(allRows.map(r => r.documentType as string))];
  const documentTypeDistribution = allDocTypes.map(label => ({
    label, value: allRows.filter(r => r.documentType === label).length,
  }));

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0);
  const trendRows = allRows.filter(r => new Date(r.createdAt as string) >= sevenDaysAgo);
  const dailyTrend = buildDailyTrend(trendRows, sevenDaysAgo, new Date());

  const payload = {
    documentsScreenedToday: useRows.length,
    verifiedDocuments: useRows.filter(r => (r.riskScore as number) <= 20).length,
    suspiciousDocuments: suspicious.length,
    highRiskDocuments: highRisk.length,
    averageProcessingTimeMs: Math.round(useRows.reduce((s, r) => s + (r.processingTimeMs as number), 0) / Math.max(useRows.length, 1)),
    riskDistribution,
    documentTypeDistribution,
    dailyTrend,
    recentScreenings: allRows.slice(0, 6).map(detailFromRow),
  };
  res.json(GetDashboardSummaryResponse.parse(payload));
});

router.get("/screenings", async (req, res): Promise<void> => {
  await ensureSeedData();
  const parsed = ListScreeningsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { search, risk, documentType, limit = 25 } = parsed.data;

  let rows = await db.select().from(screeningsTable).orderBy(desc("createdAt"))._exec();
  if (search) rows = rows.filter(r => or(ilike("screeningId", `%${search}%`), ilike("documentNumber", `%${search}%`), ilike("nationality", `%${search}%`))(r));
  if (risk) rows = rows.filter(r => r.riskLevel === risk);
  if (documentType) rows = rows.filter(r => r.documentType === documentType);
  rows = rows.slice(0, limit);

  res.json(ListScreeningsResponse.parse(rows.map(detailFromRow)));
});

router.post("/screenings", async (req, res): Promise<void> => {
  const parsed = CreateScreeningBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rules, mockRecords] = await Promise.all([loadRules(), loadMockRecords()]);
  const built = buildScreening({ ...(parsed.data as Parameters<typeof buildScreening>[0]), rules, mockRecords });
  const [created] = await db.insert(screeningsTable).values(built as unknown as AnyRow).returning();
  res.status(201).json(GetScreeningResponse.parse(detailFromRow(created)));
});

router.get("/screenings/:id", async (req, res): Promise<void> => {
  const parsed = GetScreeningParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = await db.select().from(screeningsTable).where(eq("id", parsed.data.id))._exec();
  if (!rows.length) { res.status(404).json({ error: "Screening not found" }); return; }
  res.json(GetScreeningResponse.parse(detailFromRow(rows[0])));
});

router.post("/demo/load", async (req, res): Promise<void> => {
  const parsed = LoadDemoCaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [rules, mockRecords] = await Promise.all([loadRules(), loadMockRecords()]);
  const built = buildScreening({ scenario: parsed.data.scenario as DemoScenario, documentType: "Passport", personImageProvided: true, fileName: `synthetic-${parsed.data.scenario}-case.png`, rules, mockRecords });
  const [created] = await db.insert(screeningsTable).values(built as unknown as AnyRow).returning();
  res.status(201).json(LoadDemoCaseResponse.parse(detailFromRow(created)));
});

router.get("/analytics", async (req, res): Promise<void> => {
  await ensureSeedData();
  const parsed = GetAnalyticsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { range, from, to } = parsed.data;
  const { from: dateFrom, to: dateTo } = resolveDateRange(range as string, from as string, to as string);

  let rows = await db.select().from(screeningsTable).orderBy(asc("createdAt"))._exec();
  if (dateFrom) rows = rows.filter(r => new Date(r.createdAt as string) >= dateFrom!);
  if (dateTo)   rows = rows.filter(r => new Date(r.createdAt as string) <= dateTo!);

  const total = rows.length;
  const validCount      = rows.filter(r => (r.riskScore as number) <= 20).length;
  const suspiciousCount = rows.filter(r => (r.riskScore as number) > 20).length;

  const payload = {
    range: range === "today" ? "Today" : range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Last 7 days",
    totalScreened: total,
    validPercentage:      total > 0 ? +((validCount / total) * 100).toFixed(1) : 0,
    suspiciousPercentage: total > 0 ? +((suspiciousCount / total) * 100).toFixed(1) : 0,
    averageProcessingTimeMs: Math.round(rows.reduce((s, r) => s + (r.processingTimeMs as number), 0) / Math.max(total, 1)),
    tamperingFindings: rows.filter(r => r.tamperingStatus === "SUSPICIOUS").length,
    faceMismatches:    rows.filter(r => r.faceVerification === "MISMATCH").length,
    riskDistribution: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(label => ({ label, value: rows.filter(r => r.riskLevel === label).length })),
    dailyTrend: buildDailyTrend(rows, dateFrom ?? new Date(rows[0]?.createdAt as string ?? new Date()), dateTo ?? new Date()),
  };
  res.json(GetAnalyticsResponse.parse(payload));
});

router.get("/rules", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const rows = await db.select().from(screeningRulesTable).limit(1)._exec();
  res.json(GetRulesResponse.parse(rows[0]));
});

router.put("/rules", async (req, res): Promise<void> => {
  const parsed = UpdateRulesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await ensureSeedData();
  const existing = await db.select().from(screeningRulesTable).limit(1)._exec();
  const updated = await db.update(screeningRulesTable).set(parsed.data as AnyRow).where(eq("id", (existing[0] as AnyRow).id as number)).returning();
  res.json(UpdateRulesResponse.parse(updated[0]));
});

router.get("/mock-records", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const rows = await db.select().from(mockRecordsTable).orderBy(desc("id"))._exec();
  res.json(ListMockRecordsResponse.parse(rows));
});

router.post("/mock-records", async (req, res): Promise<void> => {
  const parsed = CreateMockRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [created] = await db.insert(mockRecordsTable).values(parsed.data as AnyRow).returning();
  res.status(201).json(created);
});

router.patch("/mock-records/:id", async (req, res): Promise<void> => {
  const params = UpdateMockRecordParams.safeParse(req.params);
  const body   = UpdateMockRecordBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid mock record" }); return; }
  const updated = await db.update(mockRecordsTable).set(body.data as AnyRow).where(eq("id", params.data.id)).returning();
  if (!updated.length) { res.status(404).json({ error: "Mock record not found" }); return; }
  res.json(updated[0]);
});

router.delete("/mock-records/:id", async (req, res): Promise<void> => {
  const parsed = UpdateMockRecordParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(mockRecordsTable).where(eq("id", parsed.data.id));
  res.sendStatus(204);
});

export default router;
