import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../../../server/routers";
import { createContext } from "../../../../server/_core/context";

// Every tRPC mutation flows through this handler. Image gen on a cold
// RunPod worker can take 80-90s; video gen via Replicate polling can take
// up to 180s. Vercel's default (~15s on Pro) would 504 those requests
// halfway through. 300s is Vercel Pro's max and covers worst-case.
// Trade-off: a hung mutation runs for up to 300s before Vercel kills it.
// That's acceptable given we already have per-mutation rate limits +
// provider-level timeouts — hangs are bounded by upstream providers, not
// this cap.
export const maxDuration = 300;
export const runtime = "nodejs";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });

export { handler as GET, handler as POST };
