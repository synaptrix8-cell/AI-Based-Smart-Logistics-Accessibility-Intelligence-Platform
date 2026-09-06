import { NextRequest, NextResponse } from "next/server";
import { triageFieldReport } from "@/lib/ml/vision-triage-model";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageUrl,
      category,
      description,
      lat,
      lng,
      reportedByRole = "driver",
    } = body;

    const result = triageFieldReport({
      imageUrl,
      category,
      description,
      lat: Number(lat) || 25.5788,
      lng: Number(lng) || 91.8933,
      reportedByRole,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in ML verification route:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error during ML verification",
      },
      { status: 500 }
    );
  }
}
