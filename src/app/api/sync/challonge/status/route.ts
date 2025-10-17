import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!process.env.CHALLONGE_API_KEY;
  const hasSub = process.env.CHALLONGE_SUBDOMAIN !== undefined && process.env.CHALLONGE_SUBDOMAIN !== "";
  return NextResponse.json({ hasApiKey: hasKey, hasSubdomain: hasSub });
}
