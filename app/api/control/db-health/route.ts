import { NextResponse } from "next/server";
import { requireControlPlaneSession } from "@/lib/auth";
import { queryTenantLocalDb } from "@/lib/supabase/tenant";

export async function GET() {
  try {
    await requireControlPlaneSession("/control/db-health");

    const result = await queryTenantLocalDb<{ count: number; state: string }>(
      "SELECT count(*)::integer as count, state FROM pg_stat_activity GROUP BY state"
    );

    const activeConnections = result.rows.reduce((sum, row) => sum + Number(row.count), 0);

    return NextResponse.json({
      ok: true,
      activeConnections,
      states: result.rows,
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[db-health] Failed to retrieve database health:", errorMessage);
    return NextResponse.json(
      { error: "Failed to retrieve database health" },
      { status: 500 }
    );
  }
}
