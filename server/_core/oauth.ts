// @ts-nocheck — Express type augmentations don't resolve in Vercel's serverless compiler
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { getOrCreateBalance } from "../stripe";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if user already exists (for onboarding credits)
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isNewUser = !existingUser;

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Grant onboarding credits for new users
      if (isNewUser) {
        try {
          const user = await db.getUserByOpenId(userInfo.openId);
          if (user) {
            // getOrCreateBalance auto-grants 50 starter credits
            await getOrCreateBalance(user.id);
            console.log(`[OAuth] Granted 50 onboarding credits to new user ${user.id} (${userInfo.name})`);
          }
        } catch (creditErr) {
          console.error("[OAuth] Failed to grant onboarding credits:", creditErr);
          // Don't block login if credit grant fails
        }
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect with isNew flag so frontend can show welcome toast
      const redirectUrl = isNewUser ? "/?welcome=true" : "/";
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
