import { NextRequest, NextResponse } from "next/server";
import { predictLandslideFailure, LandslideFeatureVector } from "@/lib/ml/landslide-model";
import { EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segment_id") || "seg-002";

  const seg = EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === segmentId) || EAST_KHASI_HILLS_SEGMENTS[0];

  const features: LandslideFeatureVector = {
    rainfall_24h_mm: (seg.factors?.rainfall_mm || 25.0) * 1.8,
    slope_deg: seg.factors?.slope_deg || 22.0,
    soil_moisture_pct: Math.min(95, Math.max(30, (seg.factors?.rainfall_mm || 25.0) * 2.2)),
    gsi_vulnerability: seg.base_risk || 0.45,
    peak_ground_accel: 0.08,
    elevation_m: 980,
  };

  const prediction = predictLandslideFailure(features);

  return NextResponse.json({
    segment_id: seg.id,
    corridor_name: seg.name,
    input_telemetry: features,
    ml_forecast: prediction,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rainfall_24h_mm = 35.0,
      slope_deg = 24.0,
      soil_moisture_pct = 65.0,
      gsi_vulnerability = 0.50,
      peak_ground_accel = 0.08,
      elevation_m = 980,
      segment_id,
    } = body;

    const features: LandslideFeatureVector = {
      rainfall_24h_mm: Number(rainfall_24h_mm),
      slope_deg: Number(slope_deg),
      soil_moisture_pct: Number(soil_moisture_pct),
      gsi_vulnerability: Number(gsi_vulnerability),
      peak_ground_accel: Number(peak_ground_accel),
      elevation_m: Number(elevation_m),
    };

    const prediction = predictLandslideFailure(features);

    return NextResponse.json({
      success: true,
      segment_id,
      input_telemetry: features,
      ml_forecast: prediction,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "ML prediction failure" }, { status: 500 });
  }
}
