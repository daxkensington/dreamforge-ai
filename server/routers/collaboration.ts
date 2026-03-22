/**
 * tRPC routes for persistent collaboration features:
 * chat, collaborators, activity log, invites.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, and, count, asc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  projectChatMessages,
  projectActivityLog,
  projectCollaborators,
  users,
  videoProjects,
} from "../../drizzle/schema";
import { getUserCollaboratorRole, getVideoProject, addCollaborator } from "../db";
import { createNotification } from "../routersPhase15";
import { broadcastChatFromServer, getOnlineUsers } from "../_core/websocket";

// ─── Access check helper ────────────────────────────────────────────────────

async function requireProjectAccess(
  projectId: number,
  userId: number,
  minRole: "viewer" | "editor" | "owner" = "viewer"
): Promise<"owner" | "editor" | "viewer"> {
  const project = await getVideoProject(projectId, userId);
  if (project) return "owner";
  const role = await getUserCollaboratorRole(projectId, userId);
  if (!role) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or not authorized" });
  }
  if (minRole === "editor" && role === "viewer") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Editors or higher required" });
  }
  if (minRole === "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can do this" });
  }
  return role;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const collaborationRouter = router({
  // ─── Chat ───────────────────────────────────────────────────────

  getProjectChat: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(), // id of oldest message for pagination
      })
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(input.projectId, ctx.user.id);
      const db = await getDb();
      if (!db) return { messages: [], nextCursor: undefined };

      const conditions = [eq(projectChatMessages.projectId, input.projectId)];
      if (input.cursor) {
        const { lt } = await import("drizzle-orm");
        conditions.push(lt(projectChatMessages.id, input.cursor));
      }

      const messages = await db
        .select({
          id: projectChatMessages.id,
          projectId: projectChatMessages.projectId,
          userId: projectChatMessages.userId,
          message: projectChatMessages.message,
          type: projectChatMessages.type,
          createdAt: projectChatMessages.createdAt,
          userName: users.name,
        })
        .from(projectChatMessages)
        .leftJoin(users, eq(projectChatMessages.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(projectChatMessages.id))
        .limit(input.limit + 1);

      const hasMore = messages.length > input.limit;
      if (hasMore) messages.pop();

      return {
        messages: messages.reverse(), // return in chronological order
        nextCursor: hasMore ? messages[0]?.id : undefined,
      };
    }),

  sendChatMessage: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        message: z.string().min(1).max(2000),
        type: z.enum(["text", "system", "action"]).default("text"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(input.projectId, ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(projectChatMessages).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        message: input.message,
        type: input.type,
      }).returning({ id: projectChatMessages.id });

      const msgId = result[0].id;

      // Also broadcast via WebSocket
      try {
        broadcastChatFromServer(String(input.projectId), ctx.user.id, {
          id: msgId,
          message: input.message,
          type: input.type,
          userName: ctx.user.name,
          userId: ctx.user.id,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // WS broadcast is best-effort
      }

      return { id: msgId };
    }),

  // ─── Collaborators ──────────────────────────────────────────────

  getCollaborators: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(input.projectId, ctx.user.id);
      const db = await getDb();
      if (!db) return [];

      const collabs = await db
        .select({
          id: projectCollaborators.id,
          userId: projectCollaborators.userId,
          role: projectCollaborators.role,
          userName: users.name,
          userEmail: users.email,
          createdAt: projectCollaborators.createdAt,
        })
        .from(projectCollaborators)
        .leftJoin(users, eq(projectCollaborators.userId, users.id))
        .where(eq(projectCollaborators.projectId, input.projectId))
        .orderBy(desc(projectCollaborators.createdAt));

      // Enrich with online status from WS
      const onlineUsers = getOnlineUsers(String(input.projectId));
      const onlineSet = new Set(onlineUsers.map((u) => u.userId));

      // Also include the project owner
      const project = await db
        .select({ userId: videoProjects.userId, userName: users.name, userEmail: users.email })
        .from(videoProjects)
        .leftJoin(users, eq(videoProjects.userId, users.id))
        .where(eq(videoProjects.id, input.projectId))
        .limit(1);

      const owner = project[0]
        ? {
            id: 0,
            userId: project[0].userId,
            role: "owner" as const,
            userName: project[0].userName,
            userEmail: project[0].userEmail,
            createdAt: null,
            isOnline: onlineSet.has(project[0].userId),
            color: onlineUsers.find((u) => u.userId === project[0]!.userId)?.color ?? null,
          }
        : null;

      return {
        owner,
        collaborators: collabs.map((c) => ({
          ...c,
          isOnline: onlineSet.has(c.userId),
          color: onlineUsers.find((u) => u.userId === c.userId)?.color ?? null,
        })),
      };
    }),

  inviteCollaborator: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        email: z.string().email(),
        role: z.enum(["viewer", "editor"]).default("editor"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only owner can invite
      const project = await getVideoProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only project owner can invite collaborators" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Find user by email
      const targetUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!targetUsers[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email address" });
      }

      if (targetUsers[0].id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot invite yourself" });
      }

      const result = await addCollaborator({
        projectId: input.projectId,
        userId: targetUsers[0].id,
        role: input.role,
        invitedBy: ctx.user.id,
      });

      // Log activity
      await db.insert(projectActivityLog).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        action: "member_joined",
        details: {
          invitedUserId: targetUsers[0].id,
          invitedUserName: targetUsers[0].name,
          role: input.role,
        },
      });

      // Notify the invited user
      try {
        await createNotification(
          targetUsers[0].id,
          "collaboration",
          "Project Invitation",
          `You've been invited to collaborate on "${project.title}" as ${input.role}`,
          { projectId: input.projectId }
        );
      } catch {}

      return { id: result.id, action: result.action, userName: targetUsers[0].name };
    }),

  updateCollaboratorRole: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        collaboratorId: z.number(),
        role: z.enum(["viewer", "editor"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only owner can change roles
      const project = await getVideoProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can change roles" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(projectCollaborators)
        .set({ role: input.role })
        .where(
          and(
            eq(projectCollaborators.id, input.collaboratorId),
            eq(projectCollaborators.projectId, input.projectId)
          )
        );

      return { success: true };
    }),

  // ─── Activity Log ───────────────────────────────────────────────

  getActivityLog: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(input.projectId, ctx.user.id);
      const db = await getDb();
      if (!db) return { entries: [], total: 0 };

      const totalResult = await db
        .select({ count: count() })
        .from(projectActivityLog)
        .where(eq(projectActivityLog.projectId, input.projectId));

      const entries = await db
        .select({
          id: projectActivityLog.id,
          projectId: projectActivityLog.projectId,
          userId: projectActivityLog.userId,
          action: projectActivityLog.action,
          details: projectActivityLog.details,
          createdAt: projectActivityLog.createdAt,
          userName: users.name,
        })
        .from(projectActivityLog)
        .leftJoin(users, eq(projectActivityLog.userId, users.id))
        .where(eq(projectActivityLog.projectId, input.projectId))
        .orderBy(desc(projectActivityLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        entries,
        total: totalResult[0]?.count ?? 0,
      };
    }),

  // ─── Log an activity entry (used internally and by clients) ─────

  logActivity: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        action: z.enum([
          "clip_added",
          "clip_deleted",
          "clip_moved",
          "settings_changed",
          "member_joined",
          "member_left",
        ]),
        details: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(input.projectId, ctx.user.id, "editor");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(projectActivityLog).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        action: input.action,
        details: input.details,
      }).returning({ id: projectActivityLog.id });

      return { id: result[0].id };
    }),
});
