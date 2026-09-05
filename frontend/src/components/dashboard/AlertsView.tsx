"use client";

import { useState } from "react";
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
    corridor: "NH6: Umiam – Upper Shillong Descent",
    severity: "CRITICAL",
    message: "Debris and mud blocking northbound truck lane. Geotechnical risk index 0.74. All heavy goods vehicles diverted to Shillong Bypass.",
    channels: ["SMS", "WhatsApp", "Push"],
    recipients: 142,
    time: "18 mins ago",
  },
  {
    id: "alt-02",
    title: "⚠️ Extreme Fog & Torrential Rain",
    corridor: "SH5: Cherrapunji – Mawsmai Escarpment",
    severity: "HIGH",
    message: "Rainfall intensity at 44.5 mm/h. Visibility below 15 meters. Maintain speed below 25 km/h.",
    channels: ["SMS", "Push"],
    recipients: 98,
    time: "45 mins ago",
  },
  {
    id: "alt-03",
    title: "🌊 Riverbed Silt Inflow Advisory",
    corridor: "NH206: Dawki – Pynursla Border Connector",
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
      text: "[SMS RECV +919876543210] SETU RPT|CAT:landslide|SEV:4|LAT:25.81|LNG:91.86|COR:seg-003|MSG:Mud on NH6",
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

  const [testSMSText, setTestSMSText] = useState(
    "SETU RPT|CAT:landslide|SEV:5|LAT:25.280|LNG:91.750|COR:seg-011|MSG:Rockfall on Cherrapunji bypass"
  );
  const [isTestingSMS, setIsTestingSMS] = useState(false);

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
      const resp = await fetch("/api/alerts/inbound-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "+919436128899",
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
            text: `[INBOUND SMS RECV +919436128899] ${testSMSText}`,
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
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
          compressed 160-character SMS reports. Setu&apos;s inbound parser ingests these SMS payloads, verifies coordinates,
          and automatically forwards them to the Officials&apos; Verification Queue.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
          {/* Simulated SMS Transmitter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label className={styles.label}>Simulate Remote Driver SMS Transmission</label>
            <input
              type="text"
              className={styles.input}
              value={testSMSText}
              onChange={(e) => setTestSMSText(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}
            />
            <button
              type="button"
              className={styles.dispatchBtn}
              style={{ background: "#0A6847", borderColor: "#064E3B" }}
              onClick={handleSimulateInboundSMS}
              disabled={isTestingSMS}
            >
              <span>{isTestingSMS ? "Transmitting..." : "📨 Simulate Inbound Driver SMS"}</span>
            </button>
          </div>

          {/* Live Terminal Log */}
          <div>
            <label className={styles.label}>Gateway Activity Terminal</label>
            <div className={styles.terminalBox}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
