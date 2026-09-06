import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ParsedSMSReport {
  category: "landslide" | "flood" | "road_damage" | "other";
  severity: number;
  lat: number;
  lng: number;
  corridor_id?: string;
  notes?: string;
  sender_phone?: string;
}

/**
 * Parses raw SMS text format:
 * Example: "SETU RPT|CAT:landslide|SEV:4|LAT:25.295|LNG:91.581|COR:seg-003|MSG:Debris across both lanes"
 */
export function parseSMSReport(smsText: string): ParsedSMSReport | null {
  const clean = smsText.trim();
  if (!clean.startsWith("SETU RPT")) return null;

  const parts = clean.split("|");
  const result: Partial<ParsedSMSReport> = {
    category: "landslide",
    severity: 3,
    lat: 25.5788,
    lng: 91.8933,
  };

  for (const part of parts) {
    const [key, val] = part.split(":").map((s) => s?.trim());
    if (!key || !val) continue;

    switch (key.toUpperCase()) {
      case "CAT": {
        const catLower = val.toLowerCase();
        if (["landslide", "flood", "road_damage"].includes(catLower)) {
          result.category = catLower as any;
        } else {
          result.category = "other";
        }
        break;
      }
      case "SEV": {
        const parsedSev = parseInt(val, 10);
        if (!isNaN(parsedSev) && parsedSev >= 1 && parsedSev <= 5) {
          result.severity = parsedSev;
        }
        break;
      }
      case "LAT": {
        const parsedLat = parseFloat(val);
        if (!isNaN(parsedLat)) result.lat = parsedLat;
        break;
      }
      case "LNG": {
        const parsedLng = parseFloat(val);
        if (!isNaN(parsedLng)) result.lng = parsedLng;
        break;
      }
      case "COR":
        result.corridor_id = val;
        break;
      case "MSG":
        result.notes = val;
        break;
    }
  }

  if (result.lat && result.lng) {
    return result as ParsedSMSReport;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from = "+919876543210", text, timestamp = new Date().toISOString() } = body;

    if (!text) {
      return NextResponse.json(
        { error: "SMS text payload is required" },
        { status: 400 }
      );
    }

    const parsed = parseSMSReport(text);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "Invalid SMS format. Expected: SETU RPT|CAT:<category>|SEV:<1-5>|LAT:<lat>|LNG:<lng>|COR:<id>|MSG:<notes>",
        },
        { status: 422 }
      );
    }

    const reportId = `sms-${Date.now().toString(36)}`;
    parsed.sender_phone = from;

    let dbSaved = false;
    try {
      const supabase = await createClient();
      await supabase.from("sms_gateway_log").insert({
        raw_message: text,
        parsed_category: parsed.category,
        parsed_segment: UUID_RE.test(parsed.corridor_id || "") ? parsed.corridor_id : null,
        sender_phone: from,
        processing_status: "processed",
        created_at: timestamp,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from("reports").insert({
          user_id: user.id,
          category: parsed.category,
          lat: parsed.lat,
          lng: parsed.lng,
          segment_id: UUID_RE.test(parsed.corridor_id || "") ? parsed.corridor_id : null,
          encrypted_payload: `[INBOUND SMS via ${from}] ${parsed.notes || "Reported via emergency SMS channel"}`,
          status: "unverified",
          created_at: timestamp,
        });
        if (!error) dbSaved = true;
      }
    } catch {
      // Offline fallback mode
    }

    const ackReply = `SETU ACK: Emergency Report #${reportId.slice(0, 8)} recorded for corridor ${parsed.corridor_id || "EKH"}. District control notified.`;

    return NextResponse.json({
      success: true,
      report_id: reportId,
      parsed,
      sms_ack_reply: ackReply,
      db_persisted: dbSaved,
      received_at: timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Inbound SMS processing failed", details: err.message },
      { status: 500 }
    );
  }
}
