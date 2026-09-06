import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      incident_id,
      corridor_id = "seg-002",
      resolved_by = "District PWD & SDRF Quick Response Team",
      notes = "Debris cleared with earthmover. Pavement inspected and declared 100% safe for multi-axle freight.",
    } = body;

    const resolvedAt = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Attempt to update in Supabase if configured
    try {
      const supabase = await createClient();
      if (incident_id && !incident_id.startsWith("seed-") && !incident_id.startsWith("live-")) {
        await supabase
          .from("reports")
          .update({
            status: "resolved",
            verified_at: resolvedAt,
          })
          .eq("id", incident_id);
      }
    } catch (err) {
      console.warn("Supabase update skipped (using live in-memory response):", err);
    }

    return NextResponse.json({
      success: true,
      message: "Hazard marked as resolved and corridor declared open.",
      incident_id,
      corridor_id,
      resolved_by,
      resolved_at: resolvedAt,
      formatted_date: formattedDate,
      notes,
      corridor_status: "CLEAR",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to resolve hazard" },
      { status: 500 }
    );
  }
}
