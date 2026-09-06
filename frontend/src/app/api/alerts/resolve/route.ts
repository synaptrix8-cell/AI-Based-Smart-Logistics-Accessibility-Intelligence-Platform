import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ResolvedRecord {
  incident_id: string;
  corridor_id: string;
  resolved_by: string;
  resolved_at: string;
  formatted_date: string;
  notes: string;
}

// Server-side persistent storage for official hazard resolutions across page refreshes
const globalResolvedMap = new Map<string, ResolvedRecord>();
const globalClearedCorridors = new Set<string>();

export async function GET() {
  return NextResponse.json({
    resolved_incidents: Array.from(globalResolvedMap.values()),
    resolved_ids: Array.from(globalResolvedMap.keys()),
    cleared_corridors: Array.from(globalClearedCorridors),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support resetting simulation back to initial state
    if (body.action === "RESET") {
      globalResolvedMap.clear();
      globalClearedCorridors.clear();
      return NextResponse.json({
        success: true,
        message: "Simulation state reset to default.",
        resolved_incidents: [],
        resolved_ids: [],
        cleared_corridors: [],
      });
    }

    const {
      incident_id = "live-001",
      corridor_id = "seg-002",
      resolved_by = "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit",
      notes = "Debris cleared with earthmover. Pavement inspected and declared 100% safe for transit.",
    } = body;

    const resolvedAt = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const record: ResolvedRecord = {
      incident_id,
      corridor_id,
      resolved_by,
      resolved_at: resolvedAt,
      formatted_date: formattedDate,
      notes,
    };

    // Store in persistent server map
    if (incident_id) {
      globalResolvedMap.set(incident_id, record);
    }
    if (corridor_id) {
      globalClearedCorridors.add(corridor_id);
    }

    // Attempt to update in Supabase if configured
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
      resolved_incidents: Array.from(globalResolvedMap.values()),
      resolved_ids: Array.from(globalResolvedMap.keys()),
      cleared_corridors: Array.from(globalClearedCorridors),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to resolve hazard" },
      { status: 500 }
    );
  }
}
