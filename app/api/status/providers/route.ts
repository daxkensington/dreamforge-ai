/** Public cached metadata/reachability report; never activates GPU workers. */
import { NextResponse } from "next/server";
import { ENV } from "../../../../server/_core/env";
import { buildProviderReport, createProviderReportCache } from "../../../../server/_core/providerStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const report = createProviderReportCache(() => buildProviderReport(ENV));

export async function GET() {
  return NextResponse.json(await report());
}
