import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const screeningsTable = pgTable("screenings", {
  id: serial("id").primaryKey(),
  screeningId: text("screening_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number").notNull(),
  nationality: text("nationality").notNull(),
  riskScore: integer("risk_score").notNull(),
  riskLevel: text("risk_level").notNull(),
  status: text("status").notNull(),
  ocrStatus: text("ocr_status").notNull(),
  validationStatus: text("validation_status").notNull(),
  tamperingStatus: text("tampering_status").notNull(),
  faceVerification: text("face_verification").notNull(),
  recommendation: text("recommendation").notNull(),
  processingTimeMs: integer("processing_time_ms").notNull(),
  fileName: text("file_name").notNull(),
  extractedFields: jsonb("extracted_fields").notNull(),
  ocrConfidence: real("ocr_confidence").notNull(),
  validationChecks: jsonb("validation_checks").notNull(),
  tamperingFindings: jsonb("tampering_findings").notNull(),
  metadata: jsonb("metadata").notNull(),
  face: jsonb("face").notNull(),
  riskFactors: jsonb("risk_factors").notNull(),
  prototypeDisclaimer: text("prototype_disclaimer").notNull(),
});

export const insertScreeningSchema = createInsertSchema(screeningsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertScreening = z.infer<typeof insertScreeningSchema>;
export type Screening = typeof screeningsTable.$inferSelect;

export const mockRecordsTable = pgTable("mock_records", {
  id: serial("id").primaryKey(),
  documentNumber: text("document_number").notNull().unique(),
  name: text("name").notNull(),
  nationality: text("nationality").notNull(),
  status: text("status").notNull(),
  expiry: text("expiry").notNull(),
  notes: text("notes").notNull(),
});

export const insertMockRecordSchema = createInsertSchema(mockRecordsTable).omit({
  id: true,
});
export type InsertMockRecord = z.infer<typeof insertMockRecordSchema>;
export type MockRecord = typeof mockRecordsTable.$inferSelect;

export const screeningRulesTable = pgTable("screening_rules", {
  id: serial("id").primaryKey(),
  passportNumberFormat: text("passport_number_format").notNull(),
  minValidityDays: integer("min_validity_days").notNull(),
  maxValidityYears: integer("max_validity_years").notNull(),
  visaValidityDays: integer("visa_validity_days").notNull(),
  riskThresholds: jsonb("risk_thresholds").notNull(),
  requiredFields: jsonb("required_fields").notNull(),
});

export const insertScreeningRulesSchema = createInsertSchema(
  screeningRulesTable,
).omit({ id: true });
export type InsertScreeningRules = z.infer<typeof insertScreeningRulesSchema>;
export type ScreeningRules = typeof screeningRulesTable.$inferSelect;