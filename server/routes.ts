import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLicenseSchema, insertTeamSchema, insertVendorSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Teams routes
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid team data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create team" });
      }
    }
  });

  // Vendors routes
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendors = await storage.getAllVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const vendorData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(vendorData);
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid vendor data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create vendor" });
      }
    }
  });

  // Licenses routes
  app.get("/api/licenses", async (req, res) => {
    try {
      const { search, teamId, vendorId, status } = req.query;
      
      if (search || teamId || vendorId || status) {
        const licenses = await storage.searchLicenses({
          search: search as string,
          teamId: teamId as string,
          vendorId: vendorId as string,
          status: status as string,
        });
        res.json(licenses);
      } else {
        const licenses = await storage.getAllLicenses();
        res.json(licenses);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch licenses" });
    }
  });

  app.get("/api/licenses/:id", async (req, res) => {
    try {
      const license = await storage.getLicense(req.params.id);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }
      res.json(license);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch license" });
    }
  });

  app.post("/api/licenses", async (req, res) => {
    try {
      const licenseData = insertLicenseSchema.parse(req.body);
      
      // Get or create vendor
      const vendor = await storage.getOrCreateVendor(req.body.vendorName);
      
      const license = await storage.createLicense({
        ...licenseData,
        vendorId: vendor.id,
      });
      res.status(201).json(license);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid license data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create license" });
      }
    }
  });

  app.put("/api/licenses/:id", async (req, res) => {
    try {
      const license = await storage.updateLicense(req.params.id, req.body);
      res.json(license);
    } catch (error) {
      res.status(500).json({ message: "Failed to update license" });
    }
  });

  app.delete("/api/licenses/:id", async (req, res) => {
    try {
      await storage.deleteLicense(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete license" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/metrics", async (req, res) => {
    try {
      const metrics = await storage.getLicenseMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get("/api/analytics/duplicates", async (req, res) => {
    try {
      const duplicates = await storage.getDuplicateLicenses();
      res.json(duplicates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch duplicates" });
    }
  });

  app.get("/api/analytics/expiring", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const licenses = await storage.getExpiringLicenses(days);
      res.json(licenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expiring licenses" });
    }
  });

  app.get("/api/teams/:teamId/licenses", async (req, res) => {
    try {
      const licenses = await storage.getLicensesByTeam(req.params.teamId);
      res.json(licenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch team licenses" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
