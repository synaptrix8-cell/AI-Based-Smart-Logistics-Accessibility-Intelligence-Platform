import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { globalClearedCorridors, globalResolvedMap } from "@/app/api/alerts/resolve/route";

export interface VerifiedReportRecord {
  id: string;
  status: "verified" | "rejected";
  corridor_name?: string;
  segment_id?: string;
  lat?: number;
  lng?: number;
  severity?: number;
  description?: string;
  verified_at: string;
  notes?: string;
}

// In-memory server-side persistent store for report verifications across hard refreshes
const globalVerifiedReports = new Map<string, VerifiedReportRecord>();

export async function GET() {
  return NextResponse.json({
    success: true,
    verified_reports: Array.from(globalVerifiedReports.values()),
    verified_ids: Array.from(globalVerifiedReports.keys()),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "RESET") {
      globalVerifiedReports.clear();
      return NextResponse.json({
        success: true,
        message: "Verified reports reset.",
        verified_reports: [],
      });
    }

    const {
      id,
      status = "verified",
      corridor_name,
      segment_id,
      lat,
      lng,
      severity = 3,
      description,
      notes = "Verified by district duty officer via incident triage console",
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing report id" }, { status: 400 });
    }

    const record: VerifiedReportRecord = {
      id,
      status,
      corridor_name,
      segment_id,
      lat,
      lng,
      severity,
      description,
      verified_at: new Date().toISOString(),
      notes,
    };

    globalVerifiedReports.set(id, record);

    // Un-clear corridor if it was previously cleared, because an active verified hazard is now present
    if (segment_id) {
      globalClearedCorridors.delete(segment_id);
      globalResolvedMap.delete(id);
      globalResolvedMap.delete(`inc-${id}`);
    }

    // Attempt Supabase update if configured
    try {
      const supabase = await createClient();
      await supabase
        .from("reports")
        .update({
          status,
          verified_at: record.verified_at,
        })
        .eq("id", id);
    } catch {
      // Offline fallback
    }

    return NextResponse.json({
      success: true,
      message: `Report ${id} marked as ${status}.`,
      record,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to update verification", details: err.message },
      { status: 500 }
    );
  }
}
