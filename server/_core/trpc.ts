import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { sanitizeErrorMessage } from "./errorSanitizer";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Sanitize TRPCError messages too — provider hostnames sometimes end up
  // in thrown errors (Stripe webhooks, R2, etc.). Raw stays in server logs
  // via the per-procedure error handler; shape is what the client sees.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: sanitizeErrorMessage(error.message),
    };
  },
});

// Recursively sanitize any string field named "error" / "errorMessage" on
// a returned payload. The common pattern in this codebase is
//   return { status: "failed", error: error.message }
// which previously leaked provider URLs, keys, and 10KB HTML error pages.
// This middleware runs after every procedure and scrubs those fields
// centrally, so all 100+ error-returning mutations get clean output
// without per-site edits.
function sanitizeReturnedErrors(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((v) => sanitizeReturnedErrors(v, depth + 1));
  const obj = data as Record<string, unknown>;
  let mutated: Record<string, unknown> | null = null;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    const isErrorField = key === "error" || key === "errorMessage";
    if (isErrorField && typeof v === "string") {
      const cleaned = sanitizeErrorMessage(v);
      if (cleaned !== v) {
        mutated = mutated ?? { ...obj };
        mutated[key] = cleaned;
      }
    } else if (v && typeof v === "object") {
      const recursed = sanitizeReturnedErrors(v, depth + 1);
      if (recursed !== v) {
        mutated = mutated ?? { ...obj };
        mutated[key] = recursed;
      }
    }
  }
  return mutated ?? obj;
}

const sanitizeMiddleware = t.middleware(async ({ next }) => {
  const result = await next();
  if (result.ok) {
    return { ...result, data: sanitizeReturnedErrors(result.data) };
  }
  return result;
});

export const router = t.router;
// Every procedure goes through the sanitizer — attached at base so
// query + mutation + public + protected all get it without opt-in.
export const publicProcedure = t.procedure.use(sanitizeMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
