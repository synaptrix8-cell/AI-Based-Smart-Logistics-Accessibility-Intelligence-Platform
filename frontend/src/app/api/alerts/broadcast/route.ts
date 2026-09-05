import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, severity = "HIGH", target_corridor, channels = ["sms", "push"] } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      );
    }

    const alertId = `alt-${Date.now().toString(36)}`;
    const timestamp = new Date().toISOString();

    // 1. Log to Supabase risk_alerts table if available
    let dbSuccess = false;
    try {
      const supabase = await createClient();
      const { error } = await supabase.from("risk_alerts").insert({
        id: alertId,
        title,
        message,
        severity,
        target_corridor: target_corridor || "ALL_EAST_KHASI_HILLS",
        channels,
        created_at: timestamp,
      });
      if (!error) dbSuccess = true;
    } catch {
      // Offline fallback mode
    }

    // 2. Simulate Outbound Channels (SMS / WhatsApp / Web Push)
    const smsPayload = `[SETU EMERGENCY ALERT] ${severity}: ${title} - ${message}. Safe routing active: https://setu.ner`;
    const simulatedDispatches = {
      sms: {
        sent: channels.includes("sms"),
        recipient_count: 142, // Monitored truck drivers registered in East Khasi Hills
        payload: smsPayload.slice(0, 160),
      },
      whatsapp: {
        sent: channels.includes("whatsapp"),
        recipient_count: 88,
        status: "DELIVERED_VIA_WEBHOOK",
      },
      web_push: {
        sent: channels.includes("push"),
        recipient_count: 215,
        status: "BROADCAST_SENT",
      },
    };

    return NextResponse.json({
      success: true,
      alert_id: alertId,
      title,
      severity,
      broadcast_at: timestamp,
      dispatches: simulatedDispatches,
      db_persisted: dbSuccess,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to broadcast alert", details: err.message },
      { status: 500 }
    );
  }
}
