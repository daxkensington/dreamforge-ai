export default async function handler(req: any, res: any) {
  try {
    // Test basic imports one by one
    const results: Record<string, string> = {};

    try {
      await import("express");
      results.express = "ok";
    } catch (e: any) {
      results.express = e.message;
    }

    try {
      await import("../server/_core/env");
      results.env = "ok";
    } catch (e: any) {
      results.env = e.message;
    }

    try {
      await import("../server/db");
      results.db = "ok";
    } catch (e: any) {
      results.db = e.message;
    }

    try {
      await import("../server/stripe");
      results.stripe = "ok";
    } catch (e: any) {
      results.stripe = e.message;
    }

    try {
      await import("../server/routers");
      results.routers = "ok";
    } catch (e: any) {
      results.routers = e.message;
    }

    res.status(200).json({ results, env: { NODE_ENV: process.env.NODE_ENV, hasDbUrl: !!process.env.DATABASE_URL, hasJwt: !!process.env.JWT_SECRET } });
  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
