/**
 * Self-serve account deletion (GDPR / PIPEDA).
 *
 * Anonymises the app user so unique constraints stay satisfied, scrubs
 * generation prompts and asset URLs, removes public gallery rows, kills
 * Auth.js sessions so they cannot sign back in, and cancels Stripe
 * subscriptions. Billing transaction rows stay for tax retention with no
 * remaining PII on the user record.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  users,
  generations,
  galleryItems,
  characters,
  brandKits,
  apiKeys,
  notifications,
  creditBalances,
  authUsers,
  authAccounts,
  authSessions,
  verificationTokens,
} from "../../drizzle/schema";
import { cancelStripeSubscriptionsForCustomer } from "../stripe";

export async function deleteUserAccount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");
  if (user.loginMethod === "deleted") throw new Error("Account already deleted");

  const email = user.email;

  const [balance] = await db
    .select({ stripeCustomerId: creditBalances.stripeCustomerId })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);
  if (balance?.stripeCustomerId) {
    await cancelStripeSubscriptionsForCustomer(balance.stripeCustomerId).catch((err) => {
      console.warn("[deleteAccount] Stripe cancel failed:", err?.message);
    });
  }

  await db
    .update(generations)
    .set({
      prompt: "[deleted]",
      negativePrompt: null,
      imageUrl: null,
      thumbnailUrl: null,
      metadata: { deleted: true },
    })
    .where(eq(generations.userId, userId));

  await db.delete(galleryItems).where(eq(galleryItems.userId, userId));
  await db.delete(characters).where(eq(characters.userId, userId));
  await db.delete(brandKits).where(eq(brandKits.userId, userId));
  await db.delete(apiKeys).where(eq(apiKeys.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));

  await db
    .update(creditBalances)
    .set({
      balance: 0,
      monthlyAllocation: 0,
      bonusCredits: 0,
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.userId, userId));

  if (email) {
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));
    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
    if (authUser) {
      await db.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      await db.delete(authAccounts).where(eq(authAccounts.userId, authUser.id));
      await db.delete(authUsers).where(eq(authUsers.id, authUser.id));
    }
  }

  await db
    .update(users)
    .set({
      name: "Deleted user",
      email: null,
      bio: null,
      institution: null,
      openId: `deleted:${userId}:${Date.now()}`,
      referralCode: null,
      loginMethod: "deleted",
      uncensoredUntil: null,
      digestEnabled: false,
      emailDigestEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
