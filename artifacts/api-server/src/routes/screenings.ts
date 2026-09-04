import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
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
import {
  buildScreening,
  type DemoScenario,
  type MockRecordLookup,
  type ScreeningRulesInput,
  disclaimer,
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

/** Load live rules from DB; fall back to defaults if table is empty. */
async function loadRules(): Promise<ScreeningRulesInput> {
  const [row] = await db.select().from(screeningRulesTable).limit(1);
  if (!row) return defaultRules;
  return {
    passportNumberFormat: row.passportNumberFormat,
    minValidityDays: row.minValidityDays,
    maxValidityYears: row.maxValidityYears,
    visaValidityDays: row.visaValidityDays,
    riskThresholds: row.riskThresholds as ScreeningRulesInput["riskThresholds"],
    requiredFields: row.requiredFields as string[],
  };
}

/** Load all mock records for document-number lookup. */
async function loadMockRecords(): Promise<MockRecordLookup[]> {
  const rows = await db.select().from(mockRecordsTable);
  return rows.map((r) => ({
    documentNumber: r.documentNumber,
    status: r.status,
    expiry: r.expiry,
    name: r.name,
    nationality: r.nationality,
  }));
}

/**
 * Resolve a date range from the query params into [from, to] Date objects.
 * Returns undefined for each boundary if not applicable.
 */
function resolveDateRange(
  range: string | undefined,
  from: string | undefined,
  to: string | undefined,
): { from: Date | undefined; to: Date | undefined } {
  const now = new Date();

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }

  if (range === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }

  if (range === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }

  if (range === "custom" && from && to) {
    return { from: new Date(from), to: new Date(to + "T23:59:59.999Z") };
  }

  // Default: last 7 days
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { from: start, to: now };
}

/**
 * Build a daily trend array for [from, to] using real DB rows.
 * Each entry = { label: "Mon", screened: N, suspicious: N }
 */
function buildDailyTrend(
  rows: Array<{ createdAt: Date; riskScore: number }>,
  from: Date,
  to: Date,
): Array<{ label: string; screened: number; suspicious: number }> {
  // Build a map of dateString → { screened, suspicious }
  const dayMap = new Map<string, { screened: number; suspicious: number }>();

  // Walk every day in the range
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    dayMap.set(key, { screened: 0, suspicious: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Tally rows into their day bucket
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const bucket = dayMap.get(key)!;
      bucket.screened++;
      if (row.riskScore > 20) bucket.suspicious++;
    }
  }

  // Convert to the TrendPoint shape
  const entries: Array<{ label: string; screened: number; suspicious: number }> = [];
  for (const [dateStr, counts] of dayMap.entries()) {
    const d = new Date(dateStr);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    entries.push({ label, ...counts });
  }

  // Keep at most last 14 days to avoid chart overflow; prefer recency
  return entries.slice(-14);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed data (runs once on first read)
// ─────────────────────────────────────────────────────────────────────────────

async function ensureSeedData(): Promise<void> {
  const [existingScreening] = await db
    .select({ id: screeningsTable.id })
    .from(screeningsTable)
    .limit(1);

  if (!existingScreening) {
    // Seed rules first so the engine can use them
    const [rulesRow] = await db.select().from(screeningRulesTable).limit(1);
    let seedRules = defaultRules;
    if (rulesRow) {
      seedRules = {
        passportNumberFormat: rulesRow.passportNumberFormat,
        minValidityDays: rulesRow.minValidityDays,
        maxValidityYears: rulesRow.maxValidityYears,
        visaValidityDays: rulesRow.visaValidityDays,
        riskThresholds: rulesRow.riskThresholds as ScreeningRulesInput["riskThresholds"],
        requiredFields: rulesRow.requiredFields as string[],
      };
    }

    // Seed mock records first so engine lookups work during seed
    const [existingRecord] = await db.select({ id: mockRecordsTable.id }).from(mockRecordsTable).limit(1);
    if (!existingRecord) {
      await db.insert(mockRecordsTable).values([
        {
          documentNumber: "P10293847",
          name: "Aarav Sharma",
          nationality: "IND",
          status: "VALID",
          expiry: "2031-02-12",
          notes: "Synthetic record — baseline validation scenario.",
        },
        {
          documentNumber: "P84736291",
          name: "Meera Iyer",
          nationality: "IND",
          status: "EXPIRED",
          expiry: "2024-02-12",
          notes: "Synthetic record — expired document scenario.",
        },
        {
          documentNumber: "P73628194",
          name: "Nadia Rahman",
          nationality: "BGD",
          status: "BLACKLISTED",
          expiry: "2029-09-18",
          notes: "Synthetic record — blacklisted document scenario.",
        },
        {
          documentNumber: "P29384756",
          name: "Priya Fernando",
          nationality: "LKA",
          status: "VALID",
          expiry: "2032-06-14",
          notes: "Synthetic record — face mismatch scenario.",
        },
        {
          documentNumber: "P56473829",
          name: "Rajan Thapa",
          nationality: "NPL",
          status: "VALID",
          expiry: "2031-09-30",
          notes: "Synthetic record — tampering scenario.",
        },
      ]);
    }

    const mockRecords = await loadMockRecords();

    // Seed one screening per scenario
    for (const scenario of Object.keys(scenarios) as DemoScenario[]) {
      const built = buildScreening({
        scenario,
        documentType: "Passport",
        personImageProvided: true,
        rules: seedRules,
        mockRecords,
      });
      await db.insert(screeningsTable).values(built);
    }
  }

  // Ensure rules row exists
  const [existingRules] = await db
    .select({ id: screeningRulesTable.id })
    .from(screeningRulesTable)
    .limit(1);
  if (!existingRules) {
    await db.insert(screeningRulesTable).values(defaultRules);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /dashboard/summary
router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureSeedData();

  const allRows = await db
    .select()
    .from(screeningsTable)
    .orderBy(desc(screeningsTable.createdAt));

  // "Today" counts
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRows = allRows.filter((r) => r.createdAt >= todayStart);

  // Use all-time totals for summary cards (more useful when few records)
  const useRows = allRows.length <= 10 ? allRows : todayRows.length > 0 ? todayRows : allRows;

  const suspicious = useRows.filter((r) => r.riskScore > 20);
  const highRisk   = useRows.filter((r) => r.riskScore > 50);

  const riskDistribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((label) => ({
    label,
    value: allRows.filter((r) => r.riskLevel === label).length,
  }));

  const allDocTypes = [...new Set(allRows.map((r) => r.documentType))];
  const documentTypeDistribution = allDocTypes.map((label) => ({
    label,
    value: allRows.filter((r) => r.documentType === label).length,
  }));

  // Real daily trend: last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const trendRows = allRows.filter((r) => r.createdAt >= sevenDaysAgo);
  const dailyTrend = buildDailyTrend(trendRows, sevenDaysAgo, new Date());

  const payload = {
    documentsScreenedToday: useRows.length,
    verifiedDocuments: useRows.filter((r) => r.riskScore <= 20).length,
    suspiciousDocuments: suspicious.length,
    highRiskDocuments: highRisk.length,
    averageProcessingTimeMs: Math.round(
      useRows.reduce((sum, r) => sum + r.processingTimeMs, 0) / Math.max(useRows.length, 1),
    ),
    riskDistribution,
    documentTypeDistribution,
    dailyTrend,
    recentScreenings: allRows.slice(0, 6).map(detailFromRow),
  };

  res.json(GetDashboardSummaryResponse.parse(payload));
});

// GET /screenings
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
    filters.push(
      or(
        ilike(screeningsTable.screeningId, `%${search}%`),
        ilike(screeningsTable.documentNumber, `%${search}%`),
        ilike(screeningsTable.nationality, `%${search}%`),
      ),
    );
  }
  if (risk) filters.push(eq(screeningsTable.riskLevel, risk));
  if (documentType) filters.push(eq(screeningsTable.documentType, documentType));

  const rows = await db
    .select()
    .from(screeningsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(screeningsTable.createdAt))
    .limit(limit);

  res.json(ListScreeningsResponse.parse(rows.map(detailFromRow)));
});

// POST /screenings  ← key change: fetches live rules + mock records first
router.post("/screenings", async (req, res): Promise<void> => {
  const parsed = CreateScreeningBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Load live rules and mock records in parallel
  const [rules, mockRecords] = await Promise.all([loadRules(), loadMockRecords()]);

  const built = buildScreening({
    ...(parsed.data as Parameters<typeof buildScreening>[0]),
    rules,
    mockRecords,
  });

  const [created] = await db.insert(screeningsTable).values(built).returning();
  res.status(201).json(GetScreeningResponse.parse(detailFromRow(created)));
});

// GET /screenings/:id
router.get("/screenings/:id", async (req, res): Promise<void> => {
  const parsed = GetScreeningParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(screeningsTable)
    .where(eq(screeningsTable.id, parsed.data.id));

  if (!row) {
    res.status(404).json({ error: "Screening not found" });
    return;
  }

  res.json(GetScreeningResponse.parse(detailFromRow(row)));
});

// POST /demo/load  ← also uses live rules + mock records
router.post("/demo/load", async (req, res): Promise<void> => {
  const parsed = LoadDemoCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rules, mockRecords] = await Promise.all([loadRules(), loadMockRecords()]);

  const built = buildScreening({
    scenario: parsed.data.scenario as DemoScenario,
    documentType: "Passport",
    personImageProvided: true,
    fileName: `synthetic-${parsed.data.scenario}-case.png`,
    rules,
    mockRecords,
  });

  const [created] = await db.insert(screeningsTable).values(built).returning();
  res.status(201).json(LoadDemoCaseResponse.parse(detailFromRow(created)));
});

// GET /analytics  ← real date-range filtering
router.get("/analytics", async (req, res): Promise<void> => {
  await ensureSeedData();

  const parsed = GetAnalyticsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { range, from, to } = parsed.data;
  const { from: dateFrom, to: dateTo } = resolveDateRange(
    range as string | undefined,
    from as string | undefined,
    to as string | undefined,
  );

  // Build date filter
  const dateFilters = [];
  if (dateFrom) dateFilters.push(gte(screeningsTable.createdAt, dateFrom));
  if (dateTo)   dateFilters.push(lte(screeningsTable.createdAt, dateTo));

  const rows = await db
    .select()
    .from(screeningsTable)
    .where(dateFilters.length ? and(...dateFilters) : undefined)
    .orderBy(asc(screeningsTable.createdAt));

  const total = rows.length;
  const validCount      = rows.filter((r) => r.riskScore <= 20).length;
  const suspiciousCount = rows.filter((r) => r.riskScore > 20).length;
  const tamperingCount  = rows.filter((r) => r.tamperingStatus === "SUSPICIOUS").length;
  const mismatchCount   = rows.filter((r) => r.faceVerification === "MISMATCH").length;

  const riskDistribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((label) => ({
    label,
    value: rows.filter((r) => r.riskLevel === label).length,
  }));

  // Real daily trend for the resolved window
  const trendFrom = dateFrom ?? new Date(rows[0]?.createdAt ?? new Date());
  const trendTo   = dateTo   ?? new Date();
  const dailyTrend = buildDailyTrend(rows, trendFrom, trendTo);

  const rangeLabel =
    range === "today" ? "Today"
    : range === "7d"  ? "Last 7 days"
    : range === "30d" ? "Last 30 days"
    : range === "custom" && from && to ? `${from} → ${to}`
    : "Last 7 days";

  const payload = {
    range: rangeLabel,
    totalScreened: total,
    validPercentage: total > 0 ? +((validCount / total) * 100).toFixed(1) : 0,
    suspiciousPercentage: total > 0 ? +((suspiciousCount / total) * 100).toFixed(1) : 0,
    averageProcessingTimeMs: Math.round(
      rows.reduce((sum, r) => sum + r.processingTimeMs, 0) / Math.max(total, 1),
    ),
    tamperingFindings: tamperingCount,
    faceMismatches: mismatchCount,
    riskDistribution,
    dailyTrend,
  };

  res.json(GetAnalyticsResponse.parse(payload));
});

// GET /rules
router.get("/rules", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const [row] = await db.select().from(screeningRulesTable).limit(1);
  res.json(GetRulesResponse.parse({
    ...row,
    riskThresholds: row.riskThresholds,
    requiredFields: row.requiredFields,
  }));
});

// PUT /rules
router.put("/rules", async (req, res): Promise<void> => {
  const parsed = UpdateRulesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureSeedData();
  const [existing] = await db.select().from(screeningRulesTable).limit(1);
  const [updated] = await db
    .update(screeningRulesTable)
    .set(parsed.data)
    .where(eq(screeningRulesTable.id, existing.id))
    .returning();

  res.json(UpdateRulesResponse.parse({
    ...updated,
    riskThresholds: updated.riskThresholds,
    requiredFields: updated.requiredFields,
  }));
});

// GET /mock-records
router.get("/mock-records", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const records = await db
    .select()
    .from(mockRecordsTable)
    .orderBy(desc(mockRecordsTable.id));
  res.json(ListMockRecordsResponse.parse(records));
});

// POST /mock-records
router.post("/mock-records", async (req, res): Promise<void> => {
  const parsed = CreateMockRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db.insert(mockRecordsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

// PATCH /mock-records/:id
router.patch("/mock-records/:id", async (req, res): Promise<void> => {
  const params = UpdateMockRecordParams.safeParse(req.params);
  const body   = UpdateMockRecordBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid mock record" });
    return;
  }
  const [updated] = await db
    .update(mockRecordsTable)
    .set(body.data)
    .where(eq(mockRecordsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Mock record not found" });
    return;
  }
  res.json(updated);
});

// DELETE /mock-records/:id
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
