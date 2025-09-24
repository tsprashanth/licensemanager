import { teams, vendors, licenses, type Team, type Vendor, type License, type InsertTeam, type InsertVendor, type InsertLicense, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, like, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Team methods
  getAllTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;

  // Vendor methods
  getAllVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  getOrCreateVendor(name: string): Promise<Vendor>;

  // License methods
  getAllLicenses(): Promise<License[]>;
  getLicense(id: string): Promise<License | undefined>;
  createLicense(license: InsertLicense): Promise<License>;
  updateLicense(id: string, license: Partial<License>): Promise<License>;
  deleteLicense(id: string): Promise<void>;
  searchLicenses(filters: {
    search?: string;
    teamId?: string;
    vendorId?: string;
    status?: string;
  }): Promise<License[]>;
  getLicensesByTeam(teamId: string): Promise<License[]>;
  getExpiringLicenses(days: number): Promise<License[]>;
  getDuplicateLicenses(): Promise<{ softwareName: string; licenses: License[] }[]>;
  getLicenseMetrics(): Promise<{
    totalLicenses: number;
    monthlyCost: number;
    expiringSoon: number;
    utilizationRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(teams).where(eq(teams.id, id)) as any;
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(teams).where(eq(teams.name, username)) as any;
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(teams).values({
      name: insertUser.username,
      description: insertUser.password
    }).returning() as any;
    return user;
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(teams.name);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async getAllVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(vendors.name);
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async getOrCreateVendor(name: string): Promise<Vendor> {
    const [existingVendor] = await db.select().from(vendors).where(eq(vendors.name, name));
    if (existingVendor) {
      return existingVendor;
    }
    return await this.createVendor({ name });
  }

  async getAllLicenses(): Promise<License[]> {
    return await db.select().from(licenses).orderBy(desc(licenses.createdAt));
  }

  async getLicense(id: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license || undefined;
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const [newLicense] = await db.insert(licenses).values({
      ...license,
      cost: license.cost.toString(),
    }).returning();
    return newLicense;
  }

  async updateLicense(id: string, license: Partial<License>): Promise<License> {
    const [updatedLicense] = await db
      .update(licenses)
      .set({ ...license, updatedAt: new Date() })
      .where(eq(licenses.id, id))
      .returning();
    return updatedLicense;
  }

  async deleteLicense(id: string): Promise<void> {
    await db.delete(licenses).where(eq(licenses.id, id));
  }

  async searchLicenses(filters: {
    search?: string;
    teamId?: string;
    vendorId?: string;
    status?: string;
  }): Promise<License[]> {
    const conditions = [];

    if (filters.search) {
      conditions.push(like(licenses.softwareName, `%${filters.search}%`));
    }
    if (filters.teamId) {
      conditions.push(eq(licenses.teamId, filters.teamId));
    }
    if (filters.vendorId) {
      conditions.push(eq(licenses.vendorId, filters.vendorId));
    }
    if (filters.status) {
      conditions.push(eq(licenses.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db.select().from(licenses).where(whereClause).orderBy(desc(licenses.createdAt));
  }

  async getLicensesByTeam(teamId: string): Promise<License[]> {
    return await db.select().from(licenses).where(eq(licenses.teamId, teamId));
  }

  async getExpiringLicenses(days: number): Promise<License[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db.select().from(licenses).where(
      and(
        sql`${licenses.expiryDate} <= ${futureDate.toISOString().split('T')[0]}`,
        sql`${licenses.expiryDate} >= ${new Date().toISOString().split('T')[0]}`,
        eq(licenses.status, "active")
      )
    );
  }

  async getDuplicateLicenses(): Promise<{ softwareName: string; licenses: License[] }[]> {
    const allLicenses = await this.getAllLicenses();
    const groupedBySoftware = allLicenses.reduce((acc, license) => {
      const softwareName = license.softwareName.toLowerCase();
      if (!acc[softwareName]) {
        acc[softwareName] = [];
      }
      acc[softwareName].push(license);
      return acc;
    }, {} as Record<string, License[]>);

    return Object.entries(groupedBySoftware)
      .filter(([_, licenses]) => licenses.length > 1)
      .map(([softwareName, licenses]) => ({ softwareName, licenses }));
  }

  async getLicenseMetrics(): Promise<{
    totalLicenses: number;
    monthlyCost: number;
    expiringSoon: number;
    utilizationRate: number;
  }> {
    const allLicenses = await this.getAllLicenses();
    const expiring = await this.getExpiringLicenses(30);

    const totalLicenses = allLicenses.length;
    const expiringSoon = expiring.length;

    const monthlyCost = allLicenses.reduce((total, license) => {
      const cost = parseFloat(license.cost);
      switch (license.billingFrequency) {
        case "monthly":
          return total + cost;
        case "quarterly":
          return total + (cost / 3);
        case "annually":
          return total + (cost / 12);
        default:
          return total;
      }
    }, 0);

    const totalSeats = allLicenses.reduce((total, license) => total + license.totalSeats, 0);
    const usedSeats = allLicenses.reduce((total, license) => total + (license.usedSeats || 0), 0);
    const utilizationRate = totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;

    return {
      totalLicenses,
      monthlyCost: Math.round(monthlyCost),
      expiringSoon,
      utilizationRate,
    };
  }
}

export const storage = new DatabaseStorage();
