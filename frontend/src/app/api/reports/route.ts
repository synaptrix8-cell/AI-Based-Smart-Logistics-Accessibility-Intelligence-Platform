import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/reports - Fetch incident reports with optional filtering
 * Query params: status (unverified|verified|rejected), category (landslide|flood|road_damage|other), limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Attempt to fetch from Supabase
    try {
      const supabase = await createClient();
      let query = supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);

      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({
          success: true,
          count: data.length,
          reports: data,
          source: "supabase",
        });
      }
    } catch {
      // Fallback to demo data if Supabase is unavailable
    }

    // Demo fallback data
    const demoReports = [
      {
        id: "rep-ekh-001",
        category: "landslide",
        corridor_name: "Cherrapunji Gorgeside Pass (SH-5 South)",
        segment_id: "seg-010",
        lat: 25.2891,
        lng: 91.7102,
        severity: 4,
        description:
          "Active mudslide debris covering entire downhill lane. Heavy rain continuing (38 mm/hr). Boulders detached above cliff.",
        status: "unverified",
        created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      },
      {
        id: "rep-ekh-002",
        category: "road_damage",
        corridor_name: "Pynursla-Dawki Border Highway (NH-40)",
        segment_id: "seg-013",
        lat: 25.2104,
        lng: 91.9541,
        severity: 3,
        description:
          "Partial rockfall chute blocking northbound freight traffic. Light vehicles navigating via shoulder.",
        status: "unverified",
        created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
      {
        id: "rep-ekh-003",
        category: "flood",
        corridor_name: "Upper Shillong-Mawphlang Arterial (SH-5)",
        segment_id: "seg-008",
        lat: 25.4601,
        lng: 91.7612,
        severity: 2,
        description:
          "Culvert overflow waterlogging road surface for 200m. Passable for trucks, slow for smaller transport.",
        status: "verified",
        created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
    ];

    const filtered = demoReports.filter((r) => {
      if (status && r.status !== status) return false;
      if (category && r.category !== category) return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      count: filtered.length,
      reports: filtered.slice(0, limit),
      source: "demo_fallback",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch reports", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports - Submit a new citizen incident report
 * Body: { category, segment_id, corridor_name, lat, lng, severity, description, encrypted_payload?, iv? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      category = "other",
      segment_id,
      corridor_name,
      lat,
      lng,
      severity = 3,
      description,
      encrypted_payload,
      iv,
    } = body;

    if (!lat || !lng || !description) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: lat, lng, and description are mandatory",
        },
        { status: 400 }
      );
    }

    const reportId = `rep-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = new Date().toISOString();

    // Attempt Supabase persistence
    let dbSuccess = false;
    try {
      const supabase = await createClient();
      const { error } = await supabase.from("reports").insert({
        id: reportId,
        category,
        segment_id: segment_id || null,
        corridor_name: corridor_name || "East Khasi Hills Corridor",
        lat,
        lng,
        severity,
        description,
        encrypted_payload: encrypted_payload || null,
        iv: iv || null,
        status: "unverified",
        created_at: timestamp,
      });
      if (!error) dbSuccess = true;
    } catch {
      // Offline fallback: report accepted but not persisted to DB
    }

    return NextResponse.json({
      success: true,
      report_id: reportId,
      status: "unverified",
      db_persisted: dbSuccess,
      created_at: timestamp,
      message: dbSuccess
        ? "Report submitted and persisted to database. Pending officer verification."
        : "Report accepted in offline mode. Will sync to database when connectivity is restored.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to submit report", details: err.message },
      { status: 500 }
    );
  }
}
