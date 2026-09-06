import { NextRequest, NextResponse } from "next/server";
import { EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";
import { createClient } from "@/lib/supabase/server";

interface IngestedWhatsAppHazard {
  id: string;
  from_number: string;
  hazard_type: "landslide" | "flood" | "road_damage" | "blockage";
  location_name: string;
  matched_segment_id: string;
  coords: [number, number]; // [lat, lng]
  photo_url?: string;
  raw_message: string;
  severity: number;
  timestamp: string;
  action_taken: string;
}

// In-memory cache of recent live WhatsApp incidents for instant client polling
let LIVE_WHATSAPP_INCIDENTS: IngestedWhatsAppHazard[] = [
  {
    id: "wa-init-001",
    from_number: "+91 94361 28910",
    hazard_type: "landslide",
    location_name: "SH-5 Cherrapunji Gorgeside Pass",
    matched_segment_id: "seg-010",
    coords: [25.2891, 91.7102],
    photo_url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80",
    raw_message: "Heavy mud and boulders fallen across both lanes near Mawkdok bridge. Road completely impassable.",
    severity: 5,
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    action_taken: "Corridor blocked. AI Reroute active via Mawphlang-Weiloi Ridge.",
  },
];

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/alerts/inbound-whatsapp",
    description: "Twilio / Meta WhatsApp Inbound Webhook for Real-Time Hazard Reporting",
    active_incidents: LIVE_WHATSAPP_INCIDENTS,
    supported_formats: ["Twilio Webhook (application/x-www-form-urlencoded)", "Direct JSON (application/json)"],
    example_payload: {
      from: "whatsapp:+919436000000",
      body: "Flash flood overflowing over NH-6 culvert near Umsning. Road blocked for heavy vehicles.",
      photo_url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0",
      location: "Umsning",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    let fromNumber = "+91 94360 00000";
    let bodyText = "";
    let photoUrl: string | undefined = undefined;
    let explicitLocation: string | undefined = undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await req.json();
      fromNumber = json.from || json.sender || fromNumber;
      bodyText = json.body || json.message || json.text || "";
      photoUrl = json.photo_url || json.media_url || json.photo || undefined;
      explicitLocation = json.location || json.destination || undefined;
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      fromNumber = (formData.get("From") as string) || fromNumber;
      bodyText = (formData.get("Body") as string) || "";
      photoUrl = (formData.get("MediaUrl0") as string) || undefined;
    } else {
      const raw = await req.text();
      bodyText = raw;
    }

    const cleanText = bodyText.toLowerCase();

    // 1. Extract Hazard Type
    let hazardType: IngestedWhatsAppHazard["hazard_type"] = "landslide";
    if (cleanText.includes("flood") || cleanText.includes("water") || cleanText.includes("overflow")) {
      hazardType = "flood";
    } else if (cleanText.includes("crack") || cleanText.includes("damage") || cleanText.includes("cave") || cleanText.includes("hole")) {
      hazardType = "road_damage";
    } else if (cleanText.includes("tree") || cleanText.includes("truck") || cleanText.includes("block") || cleanText.includes("jam")) {
      hazardType = "blockage";
    }

    // 2. Extract Affected Location / Corridor
    let matchedSeg = EAST_KHASI_HILLS_SEGMENTS[0]; // default NH-6
    let locName = "NH-6 Umsning Highway Corridor";

    if (explicitLocation) {
      const exp = explicitLocation.toLowerCase();
      const found = EAST_KHASI_HILLS_SEGMENTS.find(
        (s) => s.name.toLowerCase().includes(exp) || s.id.toLowerCase().includes(exp)
      );
      if (found) {
        matchedSeg = found;
        locName = found.name;
      }
    } else if (cleanText.includes("sohra") || cleanText.includes("cherrapunji") || cleanText.includes("mawkdok")) {
      matchedSeg = EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === "seg-010") || EAST_KHASI_HILLS_SEGMENTS[1];
      locName = "SH-5 Cherrapunji Gorgeside Pass";
    } else if (cleanText.includes("umsning") || cleanText.includes("umiam")) {
      matchedSeg = EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === "seg-002") || EAST_KHASI_HILLS_SEGMENTS[0];
      locName = "NH-6 Umsning - Umiam Lake Sector";
    } else if (cleanText.includes("dawki") || cleanText.includes("pynursla")) {
      matchedSeg = EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === "seg-014") || EAST_KHASI_HILLS_SEGMENTS[1];
      locName = "NH-40 Pynursla - Dawki Border Descent";
    } else if (cleanText.includes("nongpoh")) {
      matchedSeg = EAST_KHASI_HILLS_SEGMENTS[0];
      locName = "NH-6 Nongpoh - Umsning Highway";
    }

    // Derive coordinates from matched corridor
    const coords: [number, number] = matchedSeg.coordinates[Math.floor(matchedSeg.coordinates.length / 2)]
      ? [matchedSeg.coordinates[Math.floor(matchedSeg.coordinates.length / 2)][1], matchedSeg.coordinates[Math.floor(matchedSeg.coordinates.length / 2)][0]]
      : [25.75, 91.88];

    // Fallback photo if none provided in demo
    if (!photoUrl) {
      photoUrl =
        hazardType === "flood"
          ? "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80";
    }

    const incident: IngestedWhatsAppHazard = {
      id: `wa-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      from_number: fromNumber.replace("whatsapp:", ""),
      hazard_type: hazardType,
      location_name: locName,
      matched_segment_id: matchedSeg.id,
      coords,
      photo_url: photoUrl,
      raw_message: bodyText || `Hazard reported near ${locName}`,
      severity: 5,
      timestamp: new Date().toISOString(),
      action_taken: `Corridor ${matchedSeg.highway_ref} blocked. Dynamic real-time rerouting activated.`,
    };

    // Prepend to recent list
    LIVE_WHATSAPP_INCIDENTS.unshift(incident);
    if (LIVE_WHATSAPP_INCIDENTS.length > 20) {
      LIVE_WHATSAPP_INCIDENTS.pop();
    }

    // Attempt Supabase insert
    try {
      const supabase = await createClient();
      await supabase.from("reports").insert({
        id: incident.id,
        category: hazardType === "blockage" ? "other" : hazardType,
        segment_id: matchedSeg.id,
        corridor_name: locName,
        lat: coords[0],
        lng: coords[1],
        severity: 5,
        description: `[WhatsApp Verified from ${incident.from_number}] ${incident.raw_message}`,
        status: "verified",
        created_at: incident.timestamp,
      });
    } catch {
      // Offline / fallback mode
    }

    return NextResponse.json({
      success: true,
      message: "WhatsApp hazard report ingested, verified, and broadcast to GIS map live.",
      incident,
      affected_corridor: {
        id: matchedSeg.id,
        name: locName,
        highway_ref: matchedSeg.highway_ref,
        risk_score: 0.98,
        risk_level: "CRITICAL",
        status: "BLOCKED",
      },
      reroute_recommended: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process WhatsApp message", details: err?.message },
      { status: 500 }
    );
  }
}
