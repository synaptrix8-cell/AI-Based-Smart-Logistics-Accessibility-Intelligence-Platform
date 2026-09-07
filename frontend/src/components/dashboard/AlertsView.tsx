"use client";

import { useState, useEffect } from "react";
import { EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";
import styles from "@/app/dashboard/alerts/alerts.module.css";

interface ActiveAlert {
  id: string;
  title: string;
  corridor: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  message: string;
  channels: string[];
  recipients: number;
  time: string;
}

const INITIAL_ALERTS: ActiveAlert[] = [
  {
    id: "alt-01",
    title: "🚨 Active Mudslide & Road Sinking",
    corridor: "NH6: Umiam - Upper Shillong Descent",
    severity: "CRITICAL",
    message: "Debris and mud blocking northbound truck lane. Geotechnical risk index 0.74. All heavy goods vehicles diverted to Shillong Bypass.",
    channels: ["SMS", "WhatsApp", "Push"],
    recipients: 142,
    time: "18 mins ago",
  },
  {
    id: "alt-02",
    title: "⚠️ Extreme Fog & Torrential Rain",
    corridor: "SH5: Cherrapunji - Mawsmai Escarpment",
    severity: "HIGH",
    message: "Rainfall intensity at 44.5 mm/h. Visibility below 15 meters. Maintain speed below 25 km/h.",
    channels: ["SMS", "Push"],
    recipients: 98,
    time: "45 mins ago",
  },
  {
    id: "alt-03",
    title: "🌊 Riverbed Silt Inflow Advisory",
    corridor: "NH206: Dawki - Pynursla Border Connector",
    severity: "MEDIUM",
    message: "River Umngot approach road wet and slippery. Light commercial vehicles permitted with caution.",
    channels: ["Push"],
    recipients: 64,
    time: "2 hours ago",
  },
];

interface TerminalLog {
  id: string;
  type: "inbound" | "outbound" | "system";
  text: string;
  time: string;
}

export default function AlertsView() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>(INITIAL_ALERTS);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastCorridor, setBroadcastCorridor] = useState(EAST_KHASI_HILLS_SEGMENTS[0].id);
  const [broadcastSeverity, setBroadcastSeverity] = useState<"CRITICAL" | "HIGH" | "MEDIUM">("HIGH");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [channels, setChannels] = useState({ sms: true, whatsapp: true, push: true });
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([
    {
      id: "log-01",
      type: "inbound",
      text: "[INBOUND SMS • Emergency Shortcode 1077] SETU RPT|CAT:landslide|SEV:4|LAT:25.81|LNG:91.86|COR:seg-003|MSG:Mud on NH6",
      time: "01:14:22",
    },
    {
      id: "log-02",
      type: "system",
      text: "[SMS PARSER] Parsed category=landslide severity=4. Created pending report #sms-9f82k. SMS ACK dispatched.",
      time: "01:14:23",
    },
    {
      id: "log-03",
      type: "outbound",
      text: "[BROADCAST DISPATCH] Sent Web Push to 215 devices, SMS to 142 registered drivers in East Khasi Hills.",
      time: "01:28:05",
    },
  ]);

  // Live GPS Auto-Tracking State
  const [gpsLat, setGpsLat] = useState<number>(25.2891);
  const [gpsLng, setGpsLng] = useState<number>(91.7102);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>("Ready (Click to lock live device GPS)");
  const [activePreset, setActivePreset] = useState<string>("cherrapunji");

  // Interactive SMS Payload Fields
  const [smsCategory, setSmsCategory] = useState<"landslide" | "flood" | "road_damage">("landslide");
  const [smsSeverity, setSmsSeverity] = useState<number>(4);
  const [smsCorridorId, setSmsCorridorId] = useState<string>("seg-010");
  const [smsNotes, setSmsNotes] = useState<string>("Active mudslide debris blocking road");

  const [testSMSText, setTestSMSText] = useState<string>(
    "SETU RPT|CAT:landslide|SEV:4|LAT:25.289|LNG:91.710|COR:seg-010|MSG:Active mudslide debris blocking road"
  );
  const [isTestingSMS, setIsTestingSMS] = useState(false);

  // Automatically resolve nearest road segment from GPS
  function resolveNearestCorridor(lat: number, lng: number) {
    let best = EAST_KHASI_HILLS_SEGMENTS[0];
    let minD = Infinity;
    for (const seg of EAST_KHASI_HILLS_SEGMENTS) {
      for (const pt of seg.coordinates) {
        const d = Math.hypot(lat - pt[1], lng - pt[0]);
        if (d < minD) {
          minD = d;
          best = seg;
        }
      }
    }
    setSmsCorridorId(best.id);
    return best;
  }

  // 1-Tap Live Device GPS Detection
  const handleDetectGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Using mountain corridor presets.");
      return;
    }
    setIsLocating(true);
    setGpsStatus("Acquiring high-accuracy satellite lock...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = Number(pos.coords.latitude.toFixed(4));
        const cLng = Number(pos.coords.longitude.toFixed(4));
        const acc = Math.round(pos.coords.accuracy);
        setGpsLat(cLat);
        setGpsLng(cLng);
        setGpsAccuracy(acc);
        const resolved = resolveNearestCorridor(cLat, cLng);
        setGpsStatus(`🛰️ Live GPS Locked: Lat ${cLat}, Lng ${cLng} (±${acc}m) • ${resolved.name}`);
        setActivePreset("live_gps");
        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS error:", err);
        setGpsStatus("GPS low signal. Fallback to Cherrapunji Gorgeside active corridor.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Quick Preset Selection for Drivers
  const handleSelectPreset = (preset: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    corridorId: string;
    notes: string;
    category: "landslide" | "flood" | "road_damage";
    severity: number;
  }) => {
    setActivePreset(preset.id);
    setGpsLat(preset.lat);
    setGpsLng(preset.lng);
    setGpsAccuracy(null);
    setSmsCorridorId(preset.corridorId);
    setSmsCategory(preset.category);
    setSmsSeverity(preset.severity);
    setSmsNotes(preset.notes);
    setGpsStatus(`📍 Preset: ${preset.name} (${preset.lat}, ${preset.lng})`);
  };

  // Automatically code coordinates & parameters into 160-character SMS payload
  useEffect(() => {
    const payload = `SETU RPT|CAT:${smsCategory}|SEV:${smsSeverity}|LAT:${gpsLat.toFixed(3)}|LNG:${gpsLng.toFixed(3)}|COR:${smsCorridorId}|MSG:${smsNotes}`;
    setTestSMSText(payload);
  }, [smsCategory, smsSeverity, gpsLat, gpsLng, smsCorridorId, smsNotes]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;

    setIsBroadcasting(true);
    const activeChannels = Object.entries(channels)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    try {
      const resp = await fetch("/api/alerts/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          severity: broadcastSeverity,
          target_corridor: broadcastCorridor,
          channels: activeChannels,
        }),
      });

      const data = await resp.json();
      if (resp.ok) {
        const segName = EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === broadcastCorridor)?.name || "Corridor";
        const newAlert: ActiveAlert = {
          id: data.alert_id,
          title: broadcastTitle,
          corridor: segName,
          severity: broadcastSeverity,
          message: broadcastMessage,
          channels: activeChannels.map((c) => c.toUpperCase()),
          recipients: 142,
          time: "Just now",
        };

        setAlerts([newAlert, ...alerts]);
        setTerminalLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            type: "outbound",
            text: `[EMERGENCY DISPATCH] "${broadcastTitle}" broadcasted via ${activeChannels.join(", ")} to 142 drivers.`,
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);

        setNotificationToast(`Emergency Alert dispatched to 142 drivers via ${activeChannels.join(", ")}!`);
        setTimeout(() => setNotificationToast(null), 5000);
        setBroadcastTitle("");
        setBroadcastMessage("");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleSimulateInboundSMS = async () => {
    setIsTestingSMS(true);
    try {
      const gatewayShortcode = process.env.NEXT_PUBLIC_SMS_GATEWAY_PHONE || "1077";
      const resp = await fetch("/api/alerts/inbound-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Driver-Field-Terminal",
          text: testSMSText,
        }),
      });

      const data = await resp.json();
      if (resp.ok) {
        setTerminalLogs((prev) => [
          {
            id: `log-ack-${Date.now()}`,
            type: "system",
            text: `[OUTBOUND ACK] ${data.sms_ack_reply}`,
            time: new Date().toLocaleTimeString(),
          },
          {
            id: `log-sms-${Date.now()}`,
            type: "inbound",
            text: `[INBOUND SMS RECV • Emergency Gateway ${gatewayShortcode}] ${testSMSText}`,
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);

        // Interconnect: Register SMS directly into the Officials' Verification Queue
        try {
          if (typeof window !== "undefined") {
            const raw = localStorage.getItem("setu_submitted_reports");
            const list = raw ? JSON.parse(raw) : [];
            const seg = EAST_KHASI_HILLS_SEGMENTS.find(
              (s) => s.id === (data.parsed?.corridor_id || smsCorridorId)
            );
            const smsReport = {
              id: data.report_id || `sms-${Date.now()}`,
              category: data.parsed?.category || smsCategory,
              corridor_name: seg?.name || "East Khasi Hills Corridor",
              segment_id: data.parsed?.corridor_id || smsCorridorId,
              lat: data.parsed?.lat || gpsLat,
              lng: data.parsed?.lng || gpsLng,
              severity: data.parsed?.severity || smsSeverity,
              description: `[INBOUND SMS via Emergency Helpline ${gatewayShortcode}] ${data.parsed?.notes || smsNotes}`,
              status: "unverified",
              created_at: new Date().toISOString(),
            };

            if (!list.some((r: any) => r.id === smsReport.id)) {
              list.unshift(smsReport);
              localStorage.setItem("setu_submitted_reports", JSON.stringify(list));
              window.dispatchEvent(
                new CustomEvent("setu_new_report_submitted", { detail: smsReport })
              );
            }
          }
        } catch {}

        setNotificationToast("Inbound SMS parsed successfully & added to Officials' Verification Queue!");
        setTimeout(() => setNotificationToast(null), 5000);
      } else {
        alert(data.error || "Failed to parse SMS");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsTestingSMS(false);
    }
  };

  return (
    <div className={styles.content}>
      {notificationToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 1000,
            background: "#0A6847",
            color: "white",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          {notificationToast}
        </div>
      )}

      {/* Heading */}
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.pageHeading}>
            <span>🔔</span> Regional Emergency Alerts & Fallback
          </h1>
          <p className={styles.pageDesc}>
            MDoNER East Khasi Hills Control • Multi-Channel Emergency Dispatch & Low-Connectivity SMS/USSD Gateway
          </p>
        </div>
      </div>

      <div className={styles.dashboardGrid}>
        {/* Left Column: Outbound Dispatcher Form */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span>📢</span> Emergency Outbound Dispatcher
            </h2>
            <span className={styles.sectionBadge}>Multi-Channel Dispatch</span>
          </div>

          <form onSubmit={handleBroadcast} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Alert Title</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. Flash Flood Blockage on NH-6"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Target Sector / Corridor</label>
                <select
                  className={styles.select}
                  value={broadcastCorridor}
                  onChange={(e) => setBroadcastCorridor(e.target.value)}
                >
                  {EAST_KHASI_HILLS_SEGMENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.highway_ref}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Severity Level</label>
                <select
                  className={styles.select}
                  value={broadcastSeverity}
                  onChange={(e) => setBroadcastSeverity(e.target.value as any)}
                >
                  <option value="CRITICAL">🔴 Critical (Immediate Roadblock)</option>
                  <option value="HIGH">🟠 High (Heavy Mud/Rain Hazard)</option>
                  <option value="MEDIUM">🟡 Medium (Precautionary Caution)</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Broadcast Channels</label>
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={channels.sms}
                    onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                  />
                  <span>📱 Emergency SMS (142 drivers)</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={channels.whatsapp}
                    onChange={(e) => setChannels({ ...channels, whatsapp: e.target.checked })}
                  />
                  <span>💬 WhatsApp Group Relay</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={channels.push}
                    onChange={(e) => setChannels({ ...channels, push: e.target.checked })}
                  />
                  <span>🌐 Web PWA Push</span>
                </label>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Advisory Message & Instructions</label>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Details of the hazard, road status, and recommended alternate detours..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.dispatchBtn} disabled={isBroadcasting}>
              <span>{isBroadcasting ? "Broadcasting..." : "🚀 Broadcast Emergency Alert"}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Active Regional Bulletins */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span>🚨</span> Active Regional Bulletins ({alerts.length})
            </h2>
            <span className={styles.sectionBadge} style={{ background: "rgba(239, 68, 68, 0.1)", color: "#DC2626" }}>
              Live Feeds
            </span>
          </div>

          <div className={styles.alertsList}>
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className={`${styles.alertCard} ${
                  alt.severity === "CRITICAL" ? styles.alertCritical : styles.alertWarning
                }`}
              >
                <div className={styles.alertHeader}>
                  <span className={styles.alertTitle}>{alt.title}</span>
                  <span className={styles.alertTime}>{alt.time}</span>
                </div>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                  📍 {alt.corridor} • Dispatched via {alt.channels.join(", ")} to {alt.recipients} vehicles
                </div>
                <div className={styles.alertBody}>{alt.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Low-Connectivity SMS/USSD Fallback Gateway */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>📡</span> Low-Connectivity Inbound SMS/USSD Fallback Gateway
          </h2>
          <span className={styles.sectionBadge}>Offline Mountain Resilience</span>
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", margin: 0 }}>
          When mobile data (3G/4G/5G) is completely unavailable in deep valleys like Cherrapunji or Dawki, drivers send
          compressed 160-character SMS reports. Setu&apos;s GPS engine tracks the vehicle&apos;s satellite position, automatically
          codes latitude, longitude, and corridor markers into the payload, and forwards it to the Officials&apos; Verification Queue.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px", marginTop: "12px" }}>
          {/* Left Column: Live GPS Auto-Tracker & Driver SMS Composer */}
          <div className={styles.gpsBuilderCard}>
            {/* Live GPS Bar */}
            <div className={styles.gpsTrackerBar}>
              <div className={styles.gpsCoordsDisplay}>
                <span className={styles.gpsLivePulse} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                    {gpsLat.toFixed(4)}° N, {gpsLng.toFixed(4)}° E
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#15803D" }}>
                    {gpsAccuracy ? `Accuracy: ±${gpsAccuracy}m • ` : ""}{gpsStatus}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.gpsDetectBtn}
                onClick={handleDetectGPS}
                disabled={isLocating}
                title="Detect exact coordinates from device satellite GPS"
              >
                <span>{isLocating ? "🛰️ Acquiring Fix..." : "📍 1-Tap Auto-Detect GPS"}</span>
              </button>
            </div>

            {/* Regional Corridor Presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>
                Quick Valley Corridor Presets:
              </span>
              <div className={styles.presetsRow}>
                <button
                  type="button"
                  className={styles.presetChip}
                  data-active={activePreset === "cherrapunji"}
                  onClick={() =>
                    handleSelectPreset({
                      id: "cherrapunji",
                      name: "Cherrapunji Gorgeside (SH-5)",
                      lat: 25.2891,
                      lng: 91.7102,
                      corridorId: "seg-010",
                      notes: "Active mudslide debris blocking road",
                      category: "landslide",
                      severity: 4,
                    })
                  }
                >
                  ⛰️ Cherrapunji Gorgeside (SH-5)
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  data-active={activePreset === "dawki"}
                  onClick={() =>
                    handleSelectPreset({
                      id: "dawki",
                      name: "Pynursla-Dawki Highway (NH-40)",
                      lat: 25.2104,
                      lng: 91.9541,
                      corridorId: "seg-013",
                      notes: "Rockfall chute blocking northbound freight",
                      category: "landslide",
                      severity: 3,
                    })
                  }
                >
                  🪨 Dawki Border (NH-40)
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  data-active={activePreset === "umsning"}
                  onClick={() =>
                    handleSelectPreset({
                      id: "umsning",
                      name: "Umsning Descent (NH-6)",
                      lat: 25.748,
                      lng: 91.896,
                      corridorId: "seg-002",
                      notes: "Culvert overflowing across highway",
                      category: "flood",
                      severity: 4,
                    })
                  }
                >
                  🌊 Umsning Descent (NH-6)
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  data-active={activePreset === "upper_shillong"}
                  onClick={() =>
                    handleSelectPreset({
                      id: "upper_shillong",
                      name: "Upper Shillong Arterial (SH-5)",
                      lat: 25.4601,
                      lng: 91.7612,
                      corridorId: "seg-008",
                      notes: "Waterlogging 200m passable for trucks",
                      category: "flood",
                      severity: 2,
                    })
                  }
                >
                  🌧️ Upper Shillong (SH-5)
                </button>
              </div>
            </div>

            {/* Interactive Builder Form */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
              {/* Category */}
              <div>
                <label className={styles.label} style={{ fontSize: "0.72rem" }}>
                  Hazard Category
                </label>
                <div className={styles.pillGroup}>
                  <button
                    type="button"
                    className={styles.pillBtn}
                    data-active={smsCategory === "landslide"}
                    onClick={() => setSmsCategory("landslide")}
                  >
                    ⛰️ Landslide
                  </button>
                  <button
                    type="button"
                    className={styles.pillBtn}
                    data-active={smsCategory === "flood"}
                    onClick={() => setSmsCategory("flood")}
                  >
                    🌊 Flood
                  </button>
                  <button
                    type="button"
                    className={styles.pillBtn}
                    data-active={smsCategory === "road_damage"}
                    onClick={() => setSmsCategory("road_damage")}
                  >
                    🚧 Damage
                  </button>
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className={styles.label} style={{ fontSize: "0.72rem" }}>
                  Severity Level (1-5)
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={styles.severityBtn}
                      data-active={smsSeverity === lvl}
                      data-level={lvl}
                      onClick={() => setSmsSeverity(lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Corridor Selection & Description */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px" }}>
              <div>
                <label className={styles.label} style={{ fontSize: "0.72rem" }}>
                  Monitored Corridor
                </label>
                <select
                  className={styles.select}
                  value={smsCorridorId}
                  onChange={(e) => setSmsCorridorId(e.target.value)}
                  style={{ fontSize: "0.75rem", padding: "6px 8px" }}
                >
                  {EAST_KHASI_HILLS_SEGMENTS.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name} ({seg.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={styles.label} style={{ fontSize: "0.72rem" }}>
                  Brief Notes / Road Condition
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={smsNotes}
                  onChange={(e) => setSmsNotes(e.target.value)}
                  placeholder="e.g. Mudslide blocking downhill lane"
                  style={{ fontSize: "0.75rem", padding: "6px 8px" }}
                />
              </div>
            </div>

            {/* Auto-Coded 160-Character Monospace Payload Display */}
            <div className={styles.payloadBoxWrapper}>
              <div className={styles.payloadFooter}>
                <span style={{ fontWeight: 700, color: "var(--color-text-secondary)" }}>
                  Auto-Coded 160-Char SMS Payload (Ready to Transmit):
                </span>
                <span style={{ color: testSMSText.length <= 160 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>
                  {testSMSText.length} / 160 chars (Fits 1 Standard GSM-7 SMS)
                </span>
              </div>
              <div className={styles.payloadBox}>{testSMSText}</div>
            </div>

            {/* Dispatch Buttons */}
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.dispatchBtn}
                style={{ background: "#0A6847", borderColor: "#064E3B", flex: 1 }}
                onClick={handleSimulateInboundSMS}
                disabled={isTestingSMS}
              >
                <span>{isTestingSMS ? "Transmitting..." : "📨 Simulate Inbound Driver SMS"}</span>
              </button>

              <a
                href={`sms:${process.env.NEXT_PUBLIC_SMS_GATEWAY_PHONE || "1077"}?body=${encodeURIComponent(testSMSText)}`}
                className={styles.nativeSmsBtn}
                title="Opens your mobile phone's native SMS app addressed to the official Disaster Management Helpline (1077)"
              >
                <span>📱 Open Phone SMS App (1077)</span>
              </a>
            </div>
          </div>

          {/* Right Column: Live Gateway Terminal Activity */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className={styles.label} style={{ margin: 0 }}>
                Gateway Activity Terminal
              </label>
              <span style={{ fontSize: "0.68rem", color: "#16A34A", fontWeight: 700 }}>
                ● SDMA Emergency Gateway Online (Shortcode: 1077 / 1070)
              </span>
            </div>

            <div className={styles.terminalBox} style={{ minHeight: "360px", maxHeight: "420px" }}>
              {terminalLogs.map((log) => (
                <div key={log.id} className={styles.terminalLine}>
                  <span style={{ color: "#94A3B8" }}>[{log.time}] </span>
                  <span
                    className={
                      log.type === "inbound"
                        ? styles.terminalWarning
                        : log.type === "system"
                        ? styles.terminalSuccess
                        : ""
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              💡 <strong>How it works:</strong> The remote driver taps <em>1-Tap Auto-Detect GPS</em>. Setu converts satellite coordinates into the compressed SMS syntax. Upon SMS receipt, the gateway parser extracts the hazard, calculates road risk, dispatches an automated ACK, and injects the report directly into the official triage queue.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
