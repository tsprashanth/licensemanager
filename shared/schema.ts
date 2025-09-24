import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  website: text("website"),
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const licenses = pgTable("licenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  softwareName: text("software_name").notNull(),
  vendorId: varchar("vendor_id").references(() => vendors.id).notNull(),
  teamId: varchar("team_id").references(() => teams.id).notNull(),
  licenseType: text("license_type").notNull(), // subscription, perpetual, enterprise
  totalSeats: integer("total_seats").notNull(),
  usedSeats: integer("used_seats").default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  billingFrequency: text("billing_frequency").notNull(), // monthly, quarterly, annually, one-time
  purchaseDate: date("purchase_date").notNull(),
  expiryDate: date("expiry_date"),
  contactPerson: text("contact_person").notNull(),
  description: text("description"),
  status: text("status").default("active"), // active, expiring, expired, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  licenses: many(licenses),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  licenses: many(licenses),
}));

export const licensesRelations = relations(licenses, ({ one }) => ({
  team: one(teams, {
    fields: [licenses.teamId],
    references: [teams.id],
  }),
  vendor: one(vendors, {
    fields: [licenses.vendorId],
    references: [vendors.id],
  }),
}));

// Insert schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
});

export const insertLicenseSchema = createInsertSchema(licenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  usedSeats: true,
}).extend({
  cost: z.string().transform((val) => parseFloat(val)),
  totalSeats: z.string().transform((val) => parseInt(val)),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Types
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type License = typeof licenses.$inferSelect;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
