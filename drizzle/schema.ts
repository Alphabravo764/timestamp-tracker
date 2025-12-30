import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  profilePhotoUrl: text("profilePhotoUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  deviceFingerprint: varchar("deviceFingerprint", { length: 128 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["free", "premium"]).default("free").notNull(),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Shifts table - core entity for tracking work shifts
export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  siteName: varchar("siteName", { length: 255 }).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  startTimeUtc: timestamp("startTimeUtc").notNull(),
  endTimeUtc: timestamp("endTimeUtc"),
  durationMinutes: int("durationMinutes"),
  liveToken: varchar("liveToken", { length: 64 }).notNull().unique(),
  pairCode: varchar("pairCode", { length: 10 }).unique(),
  pairCodeExpiresAt: timestamp("pairCodeExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
  liveTokenIdx: index("liveToken_idx").on(table.liveToken),
}));

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

// LocationPoints table - stores GPS coordinates during shifts
export const locationPoints = mysqlTable("locationPoints", {
  id: int("id").autoincrement().primaryKey(),
  shiftId: int("shiftId").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  altitude: decimal("altitude", { precision: 10, scale: 2 }),
  speed: decimal("speed", { precision: 10, scale: 2 }),
  heading: decimal("heading", { precision: 10, scale: 2 }),
  capturedAt: timestamp("capturedAt").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  source: mysqlEnum("source", ["gps", "network", "mock"]).default("gps").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  shiftIdIdx: index("shiftId_idx").on(table.shiftId),
  capturedAtIdx: index("capturedAt_idx").on(table.capturedAt),
}));

export type LocationPoint = typeof locationPoints.$inferSelect;
export type InsertLocationPoint = typeof locationPoints.$inferInsert;

// PhotoEvents table - stores photos taken during shifts
export const photoEvents = mysqlTable("photoEvents", {
  id: int("id").autoincrement().primaryKey(),
  shiftId: int("shiftId").notNull(),
  fileUrl: text("fileUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  photoType: mysqlEnum("photoType", ["start", "mid", "end"]).default("mid").notNull(),
  capturedAt: timestamp("capturedAt").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  exifData: text("exifData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  shiftIdIdx: index("shiftId_idx").on(table.shiftId),
  capturedAtIdx: index("capturedAt_idx").on(table.capturedAt),
}));

export type PhotoEvent = typeof photoEvents.$inferSelect;
export type InsertPhotoEvent = typeof photoEvents.$inferInsert;

// Companies table - organizations that monitor staff
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  billingPlan: mysqlEnum("billingPlan", ["free", "standard", "premium"]).default("free").notNull(),
  billingStatus: mysqlEnum("billingStatus", ["active", "suspended", "cancelled"]).default("active").notNull(),
  activeGuardsCount: int("activeGuardsCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// CompanyAdmins table - links users to companies they can manage
export const companyAdmins = mysqlTable("companyAdmins", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "viewer"]).default("admin").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  companyIdIdx: index("companyId_idx").on(table.companyId),
  userIdIdx: index("userId_idx").on(table.userId),
}));

export type CompanyAdmin = typeof companyAdmins.$inferSelect;
export type InsertCompanyAdmin = typeof companyAdmins.$inferInsert;

// Pairings table - links staff to companies for monitoring
export const pairings = mysqlTable("pairings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  userId: int("userId").notNull(),
  shiftId: int("shiftId").notNull(),
  status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
  persistForFutureShifts: boolean("persistForFutureShifts").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
}, (table) => ({
  companyIdIdx: index("companyId_idx").on(table.companyId),
  userIdIdx: index("userId_idx").on(table.userId),
  shiftIdIdx: index("shiftId_idx").on(table.shiftId),
}));

export type Pairing = typeof pairings.$inferSelect;
export type InsertPairing = typeof pairings.$inferInsert;

// ClientLinks table - shareable view-only links for clients
export const clientLinks = mysqlTable("clientLinks", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  scope: mysqlEnum("scope", ["all_guards", "specific_guards", "specific_shifts"]).default("all_guards").notNull(),
  scopeData: text("scopeData"),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  companyIdIdx: index("companyId_idx").on(table.companyId),
  tokenIdx: index("token_idx").on(table.token),
}));

export type ClientLink = typeof clientLinks.$inferSelect;
export type InsertClientLink = typeof clientLinks.$inferInsert;

// PdfReports table - generated PDF reports for shifts
export const pdfReports = mysqlTable("pdfReports", {
  id: int("id").autoincrement().primaryKey(),
  shiftId: int("shiftId").notNull(),
  pdfUrl: text("pdfUrl").notNull(),
  fileSize: int("fileSize"),
  integrityHash: varchar("integrityHash", { length: 64 }),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  shiftIdIdx: index("shiftId_idx").on(table.shiftId),
}));

export type PdfReport = typeof pdfReports.$inferSelect;
export type InsertPdfReport = typeof pdfReports.$inferInsert;
