import { NextRequest, NextResponse } from "next/server";
import { EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { riskThreshold = 0.7, rainThreshold = 30.0 } = body;

    // Scan corridors for triggered thresholds
    const triggeredCorridors = EAST_KHASI_HILLS_SEGMENTS.filter(
      (s) => s.risk_score >= riskThreshold || s.factors.rainfall_mm >= rainThreshold
    );

    const generatedAlerts = triggeredCorridors.map((s) => ({
      id: `trig-${s.id}-${Date.now().toString(36)}`,
      segment_id: s.id,
      corridor_name: s.name,
      highway_ref: s.highway_ref,
      severity: s.risk_score >= 0.8 ? "CRITICAL" : "HIGH",
      trigger_reason: `Automatic Threshold Exceeded: Risk index ${s.risk_score.toFixed(2)} (Limit: ${riskThreshold}) or Rain ${s.factors.rainfall_mm}mm/h (Limit: ${rainThreshold}mm/h)`,
      advisory: `Avoid ${s.highway_ref} ${s.name}. Setu Safe Route algorithm actively rerouting transport cargo around this sector.`,
      timestamp: new Date().toISOString(),
    }));

    // Persist to Supabase if connected
    try {
      const supabase = await createClient();
      for (const alert of generatedAlerts) {
        await supabase.from("risk_alerts").insert({
          id: alert.id,
          title: `⚠️ Auto Hazard: ${alert.corridor_name}`,
          message: alert.trigger_reason,
          severity: alert.severity,
          target_corridor: alert.segment_id,
          channels: ["sms", "push"],
          created_at: alert.timestamp,
        });
      }
    } catch {
      // Offline fallback mode
    }

    return NextResponse.json({
      success: true,
      evaluated_corridors_count: EAST_KHASI_HILLS_SEGMENTS.length,
      triggered_alerts_count: generatedAlerts.length,
      alerts: generatedAlerts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to evaluate automated triggers", details: err.message },
      { status: 500 }
    );
  }
}
